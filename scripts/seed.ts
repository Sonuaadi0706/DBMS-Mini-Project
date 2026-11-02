import { Client } from 'pg';
import cliProgress from 'cli-progress';
import { adminDatabaseUrl, requireEnv } from './lib/env';
import { demoUsers, seedReference, seedUsers } from '../db/seeds/reference';
import { seedScenarios } from '../db/seeds/scenarios';
import { seedMongo } from '../db/seeds/mongo';
import { backfill } from '../src/lib/embeddings/backfill';
import { pool } from '../src/lib/db/pg';

// Reference data, demo users and the six team scenarios (Alpha to Foxtrot), all in one transaction.
const SCENARIO_STEPS = 12; // 9 scenario steps + 3 MongoDB steps
async function main() {
  const password = requireEnv('SEED_DEFAULT_PASSWORD');
  const client = new Client({ connectionString: adminDatabaseUrl() });
  await client.connect();
  try {
    await client.query('SET search_path = projectpulse, public');
    const { rows: [{ n }] } = await client.query('SELECT COUNT(*)::int AS n FROM users');
    if (n > 0) throw new Error('Database already has users. Run `npm run db:reset` before seeding.');

    const users = demoUsers();
    const bar = new cliProgress.SingleBar({ noTTYOutput: Boolean(process.env.FORCE_PROGRESS), notTTYSchedule: 150, format: 'seeding [{bar}] {value}/{total} {step}', hideCursor: true },
      cliProgress.Presets.shades_classic);
    bar.start(users.length + 1 + SCENARIO_STEPS, 0, { step: 'reference data' });
    await client.query('BEGIN');
    const ref = await seedReference(client);
    bar.increment(1, { step: 'users' });
    const ids = await seedUsers(client, ref.deptId, password, () => bar.increment(1, { step: 'users' }));
    await seedScenarios(client, ids, ref, (label) => bar.increment(1, { step: label }));
    await client.query('COMMIT');

    // MongoDB is populated from the committed PostgreSQL rows. If it is unavailable the SQL demo
    // still works; documents and discussion threads will be missing until `npm run db:seed` is re-run.
    let mongoNote = '';
    try {
      const m = await seedMongo(client, requireEnv('MONGODB_URI'), process.env.MONGODB_DB ?? 'projectpulse', (l) => bar.increment(1, { step: l }));
      mongoNote = `MongoDB: ${m.documents} documents, ${m.threads} feedback threads, 3 meeting notes.`;
    } catch (e) {
      mongoNote = `WARNING: MongoDB was not seeded (${(e as Error).message}).`;
    }
    bar.stop();
    console.log(`\n${mongoNote}`);

    // Vectors for the submitted proposals (spec 17.1). Needs the embedding model (downloaded on first use);
    // set SEED_EMBEDDINGS=0 to skip. The SQL / Mongo demo works without it, only similarity screening is empty.
    if (process.env.SEED_EMBEDDINGS !== '0') {
      const ebar = new cliProgress.SingleBar({ noTTYOutput: Boolean(process.env.FORCE_PROGRESS), notTTYSchedule: 150, format: 'embeddings [{bar}] {value}/{total} {label}', hideCursor: true }, cliProgress.Presets.shades_classic);
      try {
        ebar.start(1, 0, { label: 'loading model' });
        let started = false;
        const r = await backfill({ onProgress: (done, total, label) => { if (!started) { ebar.setTotal(total); started = true; } ebar.update(done, { label }); } });
        ebar.stop();
        console.log(`Embeddings: ${r.embedded} proposal(s) embedded, ${r.flaggedPairs} pair(s) flagged for faculty review.`);
      } catch (e) {
        ebar.stop();
        console.warn(`WARNING: embeddings were not created (${(e as Error).message}). Run \`npm run embed:backfill\` when the model can be downloaded.`);
      }
      await pool().end();
    }

    const { rows } = await client.query(
      `SELECT team_name, project_status, progress_pct, overdue_tasks, missing_evidence, unresolved_feedback,
              risk_score, risk_level FROM v_faculty_risk_dashboard ORDER BY risk_score DESC`);
    console.log('\nFaculty risk dashboard (latest assessment):');
    console.table(rows);

    console.log('\nDemo accounts (password = SEED_DEFAULT_PASSWORD from your .env):');
    for (const u of users) console.log(`  ${u.email.padEnd(32)} ${u.roles.join(', ')}`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
