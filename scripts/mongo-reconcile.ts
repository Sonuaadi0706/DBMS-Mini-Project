import cliProgress from 'cli-progress';
import { Client } from 'pg';
import { MongoClient, ObjectId } from 'mongodb';
import { adminDatabaseUrl, requireEnv } from './lib/env';

/**
 * Repairs the MongoDB side after a crash between "SQL committed" and "Mongo updated" (spec 7):
 *  1. removes `pending` documents older than one hour (their SQL transaction never committed);
 *  2. rebuilds each document's `versions[]` and link to the deliverable from PostgreSQL, the system of record.
 */
async function main() {
  const pg = new Client({ connectionString: adminDatabaseUrl() });
  const mongo = await new MongoClient(requireEnv('MONGODB_URI'), { serverSelectionTimeoutMS: 4000 }).connect();
  await pg.connect();
  try {
    await pg.query('SET search_path = projectpulse, public');
    const docs = mongo.db(process.env.MONGODB_DB ?? 'projectpulse').collection('documents');

    const orphans = await docs.deleteMany({ state: 'pending', createdAt: { $lt: new Date(Date.now() - 3600_000) } });
    console.log(`Removed ${orphans.deletedCount} orphan pending document(s).`);

    const { rows: dels } = await pg.query(
      `SELECT d.deliverable_id, d.milestone_id, d.deliverable_type, d.title, d.mongo_doc_id, m.project_id
         FROM deliverables d JOIN milestones m USING (milestone_id) WHERE d.mongo_doc_id IS NOT NULL ORDER BY d.deliverable_id`);
    const bar = new cliProgress.SingleBar({ noTTYOutput: Boolean(process.env.FORCE_PROGRESS), notTTYSchedule: 150, format: 'reconcile [{bar}] {value}/{total}', hideCursor: true }, cliProgress.Presets.shades_classic);
    bar.start(dels.length, 0);
    let fixed = 0;
    for (const d of dels) {
      const { rows: vs } = await pg.query(
        `SELECT version_number, uploaded_by, uploaded_at, change_summary, file_url, file_name, file_size_bytes
           FROM document_versions WHERE deliverable_id = $1 ORDER BY version_number`, [d.deliverable_id]);
      if (vs.length) {
        const versions = vs.map((v) => ({ versionNumber: v.version_number, uploadedBy: v.uploaded_by, uploadedAt: v.uploaded_at,
          changeSummary: v.change_summary, fileUrl: v.file_url, fileName: v.file_name, sizeBytes: v.file_size_bytes == null ? null : Number(v.file_size_bytes) }));
        const res = await docs.updateOne({ _id: new ObjectId(d.mongo_doc_id) },
          { $set: { versions, deliverableId: d.deliverable_id, projectId: d.project_id, milestoneId: d.milestone_id, state: 'confirmed' } });
        if (res.modifiedCount) fixed++;
      }
      bar.increment();
    }
    bar.stop();
    console.log(`Checked ${dels.length} deliverable(s); updated ${fixed} Mongo document(s).`);
  } finally {
    await pg.end(); await mongo.close();
  }
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
