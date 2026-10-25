import path from 'node:path';
import dotenv from 'dotenv';

// Scripts run outside Next.js, so load .env ourselves. Values never come from source code.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name} (see .env.example)`);
  return v;
}

/** URL used by migrations/seed: the owner role. Falls back to DATABASE_URL. */
export function adminDatabaseUrl(): string {
  return process.env.MIGRATION_DATABASE_URL || requireEnv('DATABASE_URL');
}
