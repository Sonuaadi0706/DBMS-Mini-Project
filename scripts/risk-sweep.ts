import cliProgress from 'cli-progress';
import { Client } from 'pg';
import { adminDatabaseUrl } from './lib/env';

/** Same work as POST /api/jobs/risk-sweep, from the terminal, with a progress bar. */
async function main() {
  const db = new Client({ connectionString: adminDatabaseUrl() });
  await db.connect();
  try {
    await db.query('SET search_path = projectpulse, public');
    const { rows: [{ flagged }] } = await db.query('SELECT fn_flag_overdue_milestones() AS flagged');
    const { rows: projects } = await db.query(`SELECT project_id FROM projects WHERE status IN ('approved','in_progress') ORDER BY project_id`);
    const bar = new cliProgress.SingleBar({ noTTYOutput: Boolean(process.env.FORCE_PROGRESS), notTTYSchedule: 150, format: 'risk sweep [{bar}] {value}/{total} projects', hideCursor: true }, cliProgress.Presets.shades_classic);
    bar.start(projects.length, 0);
    for (const p of projects) { await db.query('CALL sp_recalculate_risk($1)', [p.project_id]); bar.increment(); }
    bar.stop();
    console.log(`New overdue flags: ${flagged}`);
    const { rows } = await db.query(
      `SELECT p.title, r.risk_level, r.risk_score FROM v_latest_risk r JOIN projects p USING (project_id) ORDER BY r.risk_score DESC`);
    console.table(rows.map((r) => ({ project: r.title.slice(0, 40), level: r.risk_level, score: Number(r.risk_score) })));
  } finally {
    await db.end();
  }
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
