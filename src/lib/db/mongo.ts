import { MongoClient, type Db } from 'mongodb';

// One connection per server process, kept on globalThis so Next.js hot reload does not leak clients.
const g = globalThis as unknown as { __ppMongo?: Promise<MongoClient> };

export function mongoClient(): Promise<MongoClient> {
  if (!g.__ppMongo) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not set (see .env.example)');
    g.__ppMongo = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 })
      .connect()
      .catch((e) => { g.__ppMongo = undefined; throw e; }); // allow a retry after a failed connect
  }
  return g.__ppMongo;
}

export async function mongoDb(): Promise<Db> {
  return (await mongoClient()).db(process.env.MONGODB_DB ?? 'projectpulse');
}
