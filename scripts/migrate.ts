import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import cliProgress from 'cli-progress';
import { adminDatabaseUrl } from './lib/env';

const MIGRATIONS_DIR = path.resolve(__dirname, '../db/migrations');

/** SQL string literal: 'it''s'. Only used for the pp_app password substitution in 013. */
function sqlLiteral(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

/** Create the target database if it does not exist yet (connects to the `postgres` maintenance DB). */
async function ensureDatabase(url: string): Promise<void> {
  const u = new URL(url);
  const dbName = decodeURIComponent(u.pathname.slice(1));
  const maint = new URL(url);
  maint.pathname = '/postgres';
  const c = new Client({ connectionString: maint.toString() });
  await c.connect();
  try {
    const { rowCount } = await c.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (!rowCount) {
      await c.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`); // identifier, not data
      console.log(`Created database ${dbName}`);
    }
  } finally {
    await c.end();
  }
}

export async function migrate(): Promise<void> {
  const url = adminDatabaseUrl();
  await ensureDatabase(url);

  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => /^\d+_.*\.sql$/.test(f)).sort();
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    // 001 creates this table too, but the runner needs it before 001 can be recorded.
    await client.query(`CREATE SCHEMA IF NOT EXISTS projectpulse;
      CREATE TABLE IF NOT EXISTS projectpulse.schema_migrations (
        version VARCHAR(60) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    const { rows } = await client.query('SELECT version FROM projectpulse.schema_migrations');
    const applied = new Set(rows.map((r) => r.version as string));
    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log('Database is up to date.');
      return;
    }

    const bar = new cliProgress.SingleBar({ noTTYOutput: Boolean(process.env.FORCE_PROGRESS), notTTYSchedule: 10, format: 'migrating [{bar}] {value}/{total}  {file}', hideCursor: true },
      cliProgress.Presets.shades_classic,
    );
    bar.start(pending.length, 0, { file: '' });
    for (const file of pending) {
      bar.update({ file });
      let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      if (sql.includes(":'APP_DB_PASSWORD'")) {
        const pw = process.env.APP_DB_PASSWORD;
        if (!pw) {
          bar.increment(1, { file: `${file} (skipped: APP_DB_PASSWORD not set)` });
          console.warn(`\nSkipping ${file}: set APP_DB_PASSWORD to create the pp_app role.`);
          continue;
        }
        sql = sql.replaceAll(":'APP_DB_PASSWORD'", sqlLiteral(pw));
      }
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO projectpulse.schema_migrations(version) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        bar.stop();
        console.error(`\nMigration ${file} failed and was rolled back.`);
        throw err;
      }
      bar.increment(1, { file });
    }
    bar.stop();
    console.log(`Applied ${pending.length} migration(s).`);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  migrate().catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  });
}
