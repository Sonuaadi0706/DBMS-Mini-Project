import { Pool, types, type PoolClient, type QueryResultRow } from 'pg';

// DATE columns stay plain 'YYYY-MM-DD' strings. The default parser builds a local-time Date, which
// shifts calendar dates by a day depending on the server time zone.
types.setTypeParser(1082, (v: string) => v);

// One pool per server process. Kept on globalThis so Next.js hot-reload does not leak pools.
const g = globalThis as unknown as { __ppPool?: Pool };

export function pool(): Pool {
  if (!g.__ppPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set (see .env.example)');
    g.__ppPool = new Pool({
      connectionString: url,
      max: 10,
      options: `-c search_path=${process.env.DB_SEARCH_PATH ?? 'projectpulse,public'}`,
    });
  }
  return g.__ppPool;
}

/** Parameterised query. Never build `sql` by concatenating user input. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const { rows } = await pool().query<T>(sql, params);
  return rows;
}

/**
 * Run `fn` in one transaction. `app.current_user_id` is set LOCAL to the transaction so the audit
 * triggers can attribute every row they write to the acting user.
 */
export async function withTransaction<T>(
  userId: number | null,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId == null ? '' : String(userId)]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
