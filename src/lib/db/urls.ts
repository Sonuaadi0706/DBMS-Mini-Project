/** Build service URLs from separate platform secrets without committing credentials. */
export function appDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const ownerUrl = process.env.MIGRATION_DATABASE_URL;
  const password = process.env.APP_DB_PASSWORD;
  if (!ownerUrl || !password) throw new Error('DATABASE_URL is not set (see .env.example)');
  const url = new URL(ownerUrl);
  url.username = 'pp_app';
  url.password = password;
  return url.toString();
}

export function mongoDatabaseUrl(): string {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  const host = process.env.MONGODB_HOST;
  const user = process.env.MONGODB_USER;
  const password = process.env.MONGODB_PASSWORD;
  if (!host || !user || !password) throw new Error('MONGODB_URI is not set (see .env.example)');
  const db = process.env.MONGODB_DB ?? 'projectpulse';
  return `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:27017/${encodeURIComponent(db)}?authSource=admin`;
}
