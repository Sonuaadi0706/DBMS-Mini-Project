/**
 * How a pile of section-level similarities becomes ONE project-level number (spec 12.1 step 4). Pure functions
 * (no database, no model), so the rule is easy to test and to explain in a viva.
 */
export const SECTION_WEIGHTS = { title: 0.15, abstract: 0.30, problem_statement: 0.30, objectives: 0.15, scope: 0.10 } as const;
export type Section = keyof typeof SECTION_WEIGHTS;
export const SECTIONS = Object.keys(SECTION_WEIGHTS) as Section[];

export const SECTION_LABEL: Record<Section, string> = {
  title: 'Title', abstract: 'Abstract', problem_statement: 'Problem statement', objectives: 'Objectives', scope: 'Scope',
};

export const config = () => ({
  threshold: Number(process.env.SIMILARITY_THRESHOLD ?? 0.8),   // project-level score that flags a pair for review
  sectionLimit: 0.9,                                             // ...or any single section at least this similar
  topK: Number(process.env.SIMILARITY_TOP_K ?? 5),
});

export interface SectionSimilarity { section: Section; similarity: number }

/** Weighted mean of the best similarity per section, over the sections both proposals have. 0..1. */
export function projectScore(sims: SectionSimilarity[]): number {
  let weighted = 0, weights = 0;
  for (const s of sims) { const w = SECTION_WEIGHTS[s.section]; weighted += w * s.similarity; weights += w; }
  return weights === 0 ? 0 : Math.min(1, Math.max(0, weighted / weights));
}

/** Flag for faculty review: overall score at or above the threshold, OR any single section very close. */
export function isFlagged(score: number, sims: SectionSimilarity[], c = config()): boolean {
  return score >= c.threshold || sims.some((s) => s.similarity >= c.sectionLimit);
}

/** The section that matches best (reported as `matched_section`). */
export function bestSection(sims: SectionSimilarity[]): SectionSimilarity | undefined {
  return [...sims].sort((a, b) => b.similarity - a.similarity)[0];
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
