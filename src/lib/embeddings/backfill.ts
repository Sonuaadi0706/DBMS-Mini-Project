import { query } from '@/lib/db/pg';
import { embedProject, screenProject, setEmbeddingsCurrent } from './service';

export interface BackfillResult { embedded: number; screened: number; flaggedPairs: number }

/**
 * Embeds every non-draft proposal and screens the ones that are still awaiting a decision (submitted or in
 * revision). `all: true` screens every proposal against the others, which also creates reviews for approved ones.
 */
export async function backfill(opts: { all?: boolean; onProgress?: (done: number, total: number, label: string) => void } = {}): Promise<BackfillResult> {
  const projects = await query<{ project_id: number; status: string; title: string }>(
    `SELECT project_id, status, title FROM projects WHERE status <> 'draft' ORDER BY project_id`);
  const toScreen = projects.filter((p) => opts.all || ['submitted', 'revision_requested'].includes(p.status));
  const total = projects.length + toScreen.length;
  let done = 0, flaggedPairs = 0;
  for (const p of projects) {
    await embedProject(p.project_id);
    if (['rejected', 'archived'].includes(p.status)) await setEmbeddingsCurrent(p.project_id, false);
    opts.onProgress?.(++done, total, `embedding ${p.title.slice(0, 28)}`);
  }
  for (const p of toScreen) {
    flaggedPairs += (await screenProject(p.project_id)).length;
    opts.onProgress?.(++done, total, `screening ${p.title.slice(0, 28)}`);
  }
  return { embedded: projects.length, screened: toScreen.length, flaggedPairs };
}
