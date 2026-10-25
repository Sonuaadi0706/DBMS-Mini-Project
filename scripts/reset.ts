import { Client } from 'pg';
import { adminDatabaseUrl } from './lib/env';
import { migrate } from './migrate';

// Drops only the `projectpulse` schema (extensions live in `public` and are kept), then re-migrates.
async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to reset a production database');
  const url = adminDatabaseUrl();
  const c = new Client({ connectionString: url });
  try {
    await c.connect();
  } catch {
    // database does not exist yet: nothing to drop, migrate() will create it
    await migrate();
    return;
  }
  console.log('Dropping schema projectpulse ...');
  await c.query('DROP SCHEMA IF EXISTS projectpulse CASCADE');
  await c.end();
  await migrate();
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
