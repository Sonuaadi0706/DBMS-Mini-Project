import cliProgress from 'cli-progress';
import './lib/env';
import { backfill } from '../src/lib/embeddings/backfill';
import { pool, query } from '../src/lib/db/pg';

// npm run embed:backfill [-- --all]   (first run downloads the ~25 MB embedding model; needs internet)
async function main() {
  const bar = new cliProgress.SingleBar({ noTTYOutput: Boolean(process.env.FORCE_PROGRESS), notTTYSchedule: 150, format: 'embeddings [{bar}] {value}/{total} {label}', hideCursor: true }, cliProgress.Presets.shades_classic);
  bar.start(1, 0, { label: 'loading model (first run downloads it)' });
  let started = false;
  const r = await backfill({
    all: process.argv.includes('--all'),
    onProgress: (done, total, label) => { if (!started) { bar.setTotal(total); started = true; } bar.update(done, { label }); },
  });
  bar.stop();
  console.log(`Embedded ${r.embedded} proposal(s); screened ${r.screened}; ${r.flaggedPairs} pair(s) flagged for faculty review.`);
  const rows = await query<{ source: string; matched: string; score: string; decision: string }>(
    `SELECT s.title AS source, m.title AS matched, sr.similarity_score AS score, sr.faculty_decision AS decision
       FROM similarity_reviews sr JOIN projects s ON s.project_id = sr.source_project_id JOIN projects m ON m.project_id = sr.matched_project_id ORDER BY sr.similarity_score DESC`);
  if (rows.length) console.table(rows.map((x) => ({ proposal: x.source.slice(0, 34), possibly_overlaps_with: x.matched.slice(0, 34), score: Number(x.score), decision: x.decision })));
  await pool().end();
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
