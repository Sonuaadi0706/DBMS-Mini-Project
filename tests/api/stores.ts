import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { MongoClient } from 'mongodb';
import { adminDatabaseUrl } from '../../scripts/lib/env';

/** Direct database access for assertions ("is the row really gone?"). Uses the owner connection. */
export async function sql<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const c = new Client({ connectionString: adminDatabaseUrl() });
  await c.connect();
  try {
    await c.query('SET search_path = projectpulse, public');
    return (await c.query(text, params)).rows as T[];
  } finally {
    await c.end();
  }
}

export async function mongo<T>(fn: (db: import('mongodb').Db) => Promise<T>): Promise<T> {
  const c = await new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 4000 }).connect();
  try { return await fn(c.db(process.env.MONGODB_DB ?? 'projectpulse')); } finally { await c.close(); }
}

/** Every file under the upload folder except the seeded ones (seed/). */
export function uploadedFiles(): string[] {
  const base = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_PATH ?? './storage/uploads');
  const out: string[] = [];
  const walk = (d: string) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) { if (full !== path.join(base, 'seed')) walk(full); } else out.push(full);
    }
  };
  walk(base);
  return out.sort();
}
