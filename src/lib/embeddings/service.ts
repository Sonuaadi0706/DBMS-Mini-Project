import { query, withTransaction } from '@/lib/db/pg';
import { chunkText, embed, MODEL_NAME, toVectorLiteral } from './index';
import { bestSection, clamp01, config, isFlagged, projectScore, SECTIONS, type Section, type SectionSimilarity } from './scoring';

/**
 * Semantic similarity screening (spec 12). What is embedded: title, abstract, problem statement, objectives and
 * scope (long text in ~200-word chunks). Stored in project_embeddings (pgvector, HNSW, cosine). A pair of
 * proposals is flagged for FACULTY REVIEW; the system never declares plagiarism.
 *
 * Deliberate choice: sections are compared like-for-like (title with title, abstract with abstract ...), which
 * is what the section weights assume, and cheaper than comparing everything with everything.
 */
interface ProjectText {
  project_id: number; course_id: number; title: string; abstract: string | null; problem_statement: string | null;
  objectives: string | null; scope: string | null;
}

const text = (v: string | null) => (v ?? '').trim();

export function sectionTexts(p: ProjectText): { section: Section; text: string }[] {
  return SECTIONS.map((s) => ({ section: s, text: text(p[s]) })).filter((x) => x.text.length > 0);
}

async function loadProject(projectId: number): Promise<ProjectText> {
  const [p] = await query<ProjectText>(
    `SELECT project_id, course_id, title, abstract, problem_statement, objectives, scope FROM projects WHERE project_id = $1`, [projectId]);
  if (!p) throw new Error(`Project ${projectId} not found`);
  return p;
}

/** (Re)embed a proposal. Upserts per (project, section, chunk, model), then removes chunks that no longer exist. */
export async function embedProject(projectId: number): Promise<number> {
  const p = await loadProject(projectId);
  const parts = sectionTexts(p).flatMap(({ section, text: t }) => chunkText(t).map((chunk, i) => ({ section, i, chunk })));
  const vectors = await embed(parts.map((x) => x.chunk));            // model work happens before the transaction
  await withTransaction(null, async (c) => {
    for (const [k, part] of parts.entries()) {
      await c.query(
        `INSERT INTO project_embeddings(project_id, course_id, section_type, chunk_index, chunk_text, embedding, model_name, is_current)
         VALUES ($1,$2,$3,$4,$5,$6::vector,$7,TRUE)
         ON CONFLICT (project_id, section_type, chunk_index, model_name)
         DO UPDATE SET chunk_text = EXCLUDED.chunk_text, embedding = EXCLUDED.embedding, course_id = EXCLUDED.course_id,
                       is_current = TRUE, created_at = now()`,
        [projectId, p.course_id, part.section, part.i, part.chunk, toVectorLiteral(vectors[k]), MODEL_NAME]);
    }
    await c.query(
      `DELETE FROM project_embeddings WHERE project_id = $1 AND model_name = $2 AND section_type <> 'document_chunk'
          AND NOT ((section_type || ':' || chunk_index) = ANY($3::text[]))`,
      [projectId, MODEL_NAME, parts.map((x) => `${x.section}:${x.i}`)]);
  });
  return parts.length;
}

/** Rejected or superseded proposals must not be matched against new ones. */
export async function setEmbeddingsCurrent(projectId: number, current: boolean): Promise<void> {
  await query(`UPDATE project_embeddings SET is_current = $2 WHERE project_id = $1`, [projectId, current]);
}

interface SourceSection { section: Section; chunks: { text: string; vector: string }[] }
interface SectionHit { similarity: number; sourceExcerpt: string; matchedExcerpt: string }
export type PairHits = Map<number, Map<Section, SectionHit>>;   // matched project id -> section -> best hit

/**
 * The core retrieval (spec Q6): for every chunk of the source, the nearest current chunks of the SAME section in
 * the SAME course (metadata filter + vector search in one query). `<=>` is cosine DISTANCE, so similarity = 1 - distance.
 */
async function matchSections(courseId: number, excludeProjectId: number | null, source: SourceSection[]): Promise<PairHits> {
  const hits: PairHits = new Map();
  await withTransaction(null, async (c) => {
    await c.query('SET LOCAL hnsw.ef_search = 100');                 // wider HNSW search for better recall (demo setting)
    for (const s of source) {
      for (const chunk of s.chunks) {
        const { rows } = await c.query(
          `SELECT e.project_id, e.chunk_text, 1 - (e.embedding <=> $1::vector) AS similarity
             FROM project_embeddings e
            WHERE e.is_current AND e.course_id = $2 AND e.project_id <> $3 AND e.section_type = $4 AND e.model_name = $5
            ORDER BY e.embedding <=> $1::vector
            LIMIT 30`, [chunk.vector, courseId, excludeProjectId ?? 0, s.section, MODEL_NAME]);
        for (const r of rows) {
          const sections = hits.get(r.project_id) ?? new Map<Section, SectionHit>();
          const best = sections.get(s.section);
          const sim = Number(r.similarity);
          if (!best || sim > best.similarity) sections.set(s.section, { similarity: sim, sourceExcerpt: chunk.text, matchedExcerpt: r.chunk_text });
          hits.set(r.project_id, sections);
        }
      }
    }
  });
  return hits;
}

function summarise(hits: PairHits) {
  const c = config();
  return [...hits.entries()].map(([projectId, sections]) => {
    const sims: SectionSimilarity[] = [...sections.entries()].map(([section, h]) => ({ section, similarity: h.similarity }));
    const score = projectScore(sims);
    const best = bestSection(sims)!;
    return { projectId, score, sims, flagged: isFlagged(score, sims, c), best, hit: sections.get(best.section)! };
  }).sort((a, b) => b.score - a.score);
}

export interface ScreenResult { matchedProjectId: number; score: number; matchedSection: Section }

/**
 * Compare a (already embedded) proposal with the others in its course and store the flagged pairs for faculty
 * review. An existing faculty decision is never overwritten; pending pairs that are no longer flagged are removed.
 */
export async function screenProject(projectId: number): Promise<ScreenResult[]> {
  const p = await loadProject(projectId);
  const rows = await query<{ section_type: Section; chunk_text: string; vec: string }>(
    `SELECT section_type, chunk_text, embedding::text AS vec FROM project_embeddings
      WHERE project_id = $1 AND model_name = $2 AND section_type <> 'document_chunk' ORDER BY section_type, chunk_index`, [projectId, MODEL_NAME]);
  const source: SourceSection[] = SECTIONS.map((s) => ({ section: s, chunks: rows.filter((r) => r.section_type === s).map((r) => ({ text: r.chunk_text, vector: r.vec })) })).filter((s) => s.chunks.length > 0);
  const flagged = summarise(await matchSections(p.course_id, projectId, source)).filter((m) => m.flagged).slice(0, config().topK);

  await withTransaction(null, async (c) => {
    for (const m of flagged) {
      await c.query(
        `INSERT INTO similarity_reviews(source_project_id, matched_project_id, similarity_score, matched_section, source_excerpt, matched_excerpt)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (source_project_id, matched_project_id)
         DO UPDATE SET similarity_score = EXCLUDED.similarity_score, matched_section = EXCLUDED.matched_section,
                       source_excerpt = EXCLUDED.source_excerpt, matched_excerpt = EXCLUDED.matched_excerpt`,
        [projectId, m.projectId, clamp01(m.score).toFixed(4), m.best.section, m.hit.sourceExcerpt.slice(0, 600), m.hit.matchedExcerpt.slice(0, 600)]);
    }
    await c.query(`DELETE FROM similarity_reviews WHERE source_project_id = $1 AND faculty_decision = 'pending' AND matched_project_id <> ALL($2::int[])`,
      [projectId, flagged.map((m) => m.projectId)]);
  });
  return flagged.map((m) => ({ matchedProjectId: m.projectId, score: m.score, matchedSection: m.best.section }));
}

/** After a submit / resubmit: embed, then screen. Never throws; the proposal was already submitted. */
export async function embedAndScreenSafely(projectId: number): Promise<void> {
  try {
    await embedProject(projectId);
    await screenProject(projectId);
  } catch (e) {
    console.error('Similarity screening failed (run npm run embed:backfill later):', e);
  }
}

/** Per-section comparison of two proposals, computed live from the stored vectors, for the faculty screen. */
export function similarityBreakdown(sourceId: number, matchedId: number) {
  return query<{ section_type: Section; similarity: string; source_text: string; matched_text: string }>(
    `SELECT DISTINCT ON (a.section_type) a.section_type, 1 - (a.embedding <=> b.embedding) AS similarity,
            a.chunk_text AS source_text, b.chunk_text AS matched_text
       FROM project_embeddings a
       JOIN project_embeddings b ON b.project_id = $2 AND b.section_type = a.section_type AND b.model_name = a.model_name
      WHERE a.project_id = $1 AND a.section_type <> 'document_chunk'
      ORDER BY a.section_type, a.embedding <=> b.embedding`, [sourceId, matchedId]);
}

/**
 * Student hint: would this DRAFT be flagged against what already exists in the course? The draft is embedded on
 * the fly (nothing is stored) and only a yes/no leaves this function, so no other team's data can leak.
 */
export async function draftOverlaps(projectId: number): Promise<boolean> {
  const p = await loadProject(projectId);
  const parts = sectionTexts(p).flatMap(({ section, text: t }) => chunkText(t).map((chunk) => ({ section, chunk })));
  if (parts.length === 0) return false;
  const vectors = await embed(parts.map((x) => x.chunk));
  const source: SourceSection[] = SECTIONS.map((s) => ({
    section: s, chunks: parts.map((x, i) => ({ ...x, i })).filter((x) => x.section === s).map((x) => ({ text: x.chunk, vector: toVectorLiteral(vectors[x.i]) })),
  })).filter((s) => s.chunks.length > 0);
  return summarise(await matchSections(p.course_id, projectId, source)).some((m) => m.flagged);
}

export interface SearchHit { project_id: number; title: string; team_name: string; course_name: string; section: Section | 'document_chunk'; similarity: number; excerpt: string }

/** Free-text semantic search for faculty (SIM-05): "find proposals about ..." by meaning, not keywords. */
export async function searchByText(queryText: string, courseIds: number[] | null, k: number): Promise<SearchHit[]> {
  const [vec] = await embed([queryText]);
  const rows = await query<{ project_id: number; title: string; team_name: string; course_name: string; section_type: SearchHit['section']; chunk_text: string; similarity: string }>(
    `SELECT e.project_id, p.title, t.team_name, c.course_name, e.section_type, e.chunk_text, 1 - (e.embedding <=> $1::vector) AS similarity
       FROM project_embeddings e JOIN projects p ON p.project_id = e.project_id JOIN teams t ON t.team_id = p.team_id JOIN courses c ON c.course_id = e.course_id
      WHERE e.is_current AND e.model_name = $3 AND ($2::int[] IS NULL OR e.course_id = ANY($2::int[]))
      ORDER BY e.embedding <=> $1::vector LIMIT 60`, [toVectorLiteral(vec), courseIds, MODEL_NAME]);
  const best = new Map<number, SearchHit>();
  for (const r of rows) {
    const sim = Number(r.similarity);
    if (!best.has(r.project_id) || sim > best.get(r.project_id)!.similarity) {
      best.set(r.project_id, { project_id: r.project_id, title: r.title, team_name: r.team_name, course_name: r.course_name, section: r.section_type, similarity: sim, excerpt: r.chunk_text.slice(0, 300) });
    }
  }
  return [...best.values()].sort((a, b) => b.similarity - a.similarity).slice(0, k);
}
