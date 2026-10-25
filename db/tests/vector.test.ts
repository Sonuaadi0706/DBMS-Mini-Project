import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { closeTx, openTx } from './helpers';

/**
 * pgvector and full-text search against the seeded embeddings (T-27, T-28). Needs `npm run db:seed` (which
 * creates the embeddings); skipped otherwise. No embedding model is needed: it reuses the stored vectors.
 */
let c: Client;
let ready = false;
beforeAll(async () => {
  c = await openTx();
  const { rows } = await c.query(`SELECT COUNT(*)::int AS n FROM project_embeddings`);
  ready = rows[0].n > 0;
});
afterAll(async () => closeTx(c));

describe('vector storage and search', () => {
  it('stores 384-dimensional vectors with a unique (project, section, chunk, model) key', async (ctx) => {
    if (!ready) return ctx.skip();
    const { rows } = await c.query(`SELECT DISTINCT vector_dims(embedding) AS d FROM project_embeddings`);
    expect(rows).toEqual([{ d: 384 }]);
    const dup = await c.query(`SELECT COUNT(*)::int AS n FROM (SELECT 1 FROM project_embeddings GROUP BY project_id, section_type, chunk_index, model_name HAVING COUNT(*) > 1) x`);
    expect(dup.rows[0].n).toBe(0);
  });

  it('cosine similarity = 1 - distance: a vector is identical to itself, and vectors are unit length', async (ctx) => {
    if (!ready) return ctx.skip();
    const { rows } = await c.query(`SELECT 1 - (embedding <=> embedding) AS self_sim, vector_norm(embedding) AS norm FROM project_embeddings LIMIT 1`);
    expect(Number(rows[0].self_sim)).toBeCloseTo(1, 5);
    expect(Number(rows[0].norm)).toBeCloseTo(1, 4);
  });

  it('T-27: unfiltered nearest-neighbour search uses the HNSW index', async (ctx) => {
    if (!ready) return ctx.skip();
    const { rows: [src] } = await c.query(`SELECT embedding::text AS v FROM project_embeddings WHERE section_type = 'title' ORDER BY project_id LIMIT 1`);
    await c.query('SET LOCAL enable_seqscan = off');                  // a table this small would otherwise be scanned directly
    const plan = (await c.query(`EXPLAIN SELECT project_id FROM project_embeddings ORDER BY embedding <=> $1::vector LIMIT 5`, [src.v])).rows.map((r) => r['QUERY PLAN']).join('\n');
    expect(plan).toContain('idx_embeddings_hnsw');
  });

  it('T-27: the filtered query (course + section) answers exactly like a full scan', async (ctx) => {
    if (!ready) return ctx.skip();
    const { rows: [src] } = await c.query(`SELECT embedding::text AS v, course_id, project_id FROM project_embeddings WHERE section_type = 'title' ORDER BY project_id LIMIT 1`);
    const nearest = `SELECT project_id FROM project_embeddings WHERE is_current AND course_id = $2 AND section_type = 'title' AND project_id <> $3
                      ORDER BY embedding <=> $1::vector LIMIT 3`;
    await c.query('SET LOCAL hnsw.ef_search = 100');
    const viaPlanner = (await c.query(nearest, [src.v, src.course_id, src.project_id])).rows.map((r) => r.project_id);
    await c.query('SET LOCAL enable_indexscan = off'); await c.query('SET LOCAL enable_bitmapscan = off');
    const exact = (await c.query(nearest, [src.v, src.course_id, src.project_id])).rows.map((r) => r.project_id);
    expect(viaPlanner).toEqual(exact);
    expect(viaPlanner.length).toBeGreaterThan(0);
  });

  it('the metadata filter keeps other courses out of the results', async (ctx) => {
    if (!ready) return ctx.skip();
    const { rows } = await c.query(
      `SELECT DISTINCT e.course_id FROM project_embeddings a JOIN project_embeddings e ON e.course_id = a.course_id
        WHERE a.project_id = (SELECT project_id FROM projects WHERE title LIKE 'FestFlow%') AND e.is_current`);
    expect(rows).toHaveLength(1);                                     // FestFlow's course only; Alpha / Echo are never candidates for it
  });
});

describe('T-28 full-text search (GIN index)', () => {
  it('"event" finds Alpha, Echo and Foxtrot, ranked, and only them', async () => {
    const { rows } = await c.query(
      `SELECT p.title, ts_rank(to_tsvector('english', coalesce(p.title,'') || ' ' || coalesce(p.abstract,'') || ' ' || coalesce(p.problem_statement,'')), q) AS rank
         FROM projects p, plainto_tsquery('english', $1) q
        WHERE to_tsvector('english', coalesce(p.title,'') || ' ' || coalesce(p.abstract,'') || ' ' || coalesce(p.problem_statement,'')) @@ q
        ORDER BY rank DESC`, ['event']);
    const titles = rows.map((r) => r.title.split(':')[0]).sort();
    expect(titles).toEqual(['CampusConnect', 'CollegeEvents Hub', 'FestFlow']);
    expect(Number(rows[0].rank)).toBeGreaterThanOrEqual(Number(rows[2].rank));
  });
  it('uses the GIN index when sequential scans are off', async () => {
    await c.query('SET LOCAL enable_seqscan = off');
    const plan = (await c.query(
      `EXPLAIN SELECT project_id FROM projects WHERE to_tsvector('english', coalesce(title,'') || ' ' || coalesce(abstract,'') || ' ' || coalesce(problem_statement,'')) @@ plainto_tsquery('english', 'event')`)).rows.map((r) => r['QUERY PLAN']).join('\n');
    expect(plan).toContain('idx_projects_fts');
  });
});
