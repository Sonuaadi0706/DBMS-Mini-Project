import cliProgress from 'cli-progress';
import { MongoClient } from 'mongodb';
import { COLLECTIONS, initCollections } from '../db/mongo/collections';
import { mongoDatabaseUrl } from '../src/lib/db/urls';

async function main() {
  const client = await new MongoClient(mongoDatabaseUrl(), { serverSelectionTimeoutMS: 4000 }).connect();
  try {
    const db = client.db(process.env.MONGODB_DB ?? 'projectpulse');
    const names = Object.keys(COLLECTIONS);
    const bar = new cliProgress.SingleBar({ noTTYOutput: Boolean(process.env.FORCE_PROGRESS), notTTYSchedule: 150, format: 'mongo init [{bar}] {value}/{total} {name}', hideCursor: true }, cliProgress.Presets.shades_classic);
    bar.start(names.length, 0, { name: '' });
    await initCollections(db, (name) => bar.increment(1, { name }));
    bar.stop();
    console.log(`Collections ready: ${names.join(', ')}`);
  } finally {
    await client.close();
  }
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
