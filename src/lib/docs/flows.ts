import { ApiError } from '@/lib/api/errors';
import { withTransaction } from '@/lib/db/pg';
import { deleteStored } from '@/lib/storage';
import type { CurrentUser } from '@/lib/auth/session';
import { confirmDocument, createPendingDocument, discardDocument, pushVersion, recordAttachment, versionDoc } from './documents';
import { DeliverableFields, prepareVersion, type UploadRequest } from './upload';

const log = (what: string) => (e: unknown) => console.error(`${what} failed (run npm run mongo:reconcile):`, e);

/** Milestones accept new work only while the team is working on them. */
export const OPEN_FOR_UPLOADS = ['in_progress', 'revision_requested'];

/**
 * New deliverable (draft) with its first version.
 * Order matters (spec 7): file -> pending Mongo doc -> SQL transaction -> confirm. Any failure before the commit
 * removes the file and the pending document again.
 */
export async function createDeliverableFlow(user: CurrentUser, projectId: number, milestoneId: number, u: UploadRequest) {
  const meta = DeliverableFields.parse(u.fields);
  const v = await prepareVersion(u);
  let mongoId: string | null = null;
  try {
    mongoId = String(await createPendingDocument({
      projectId, milestoneId, deliverableType: meta.deliverableType, title: meta.title,
      version: versionDoc(v, 1, user.userId), extractedText: v.extractedText,
    }));
    const deliverableId = await withTransaction(user.userId, async (c) => {
      const { rows: [m] } = await c.query(`SELECT status FROM milestones WHERE milestone_id = $1 FOR UPDATE`, [milestoneId]);
      if (!OPEN_FOR_UPLOADS.includes(m.status)) throw new ApiError(409, 'not_open', 'Start the milestone before adding deliverables.');
      const { rows: [d] } = await c.query(
        `INSERT INTO deliverables(milestone_id, deliverable_type, title, repo_link, evidence_url, mongo_doc_id, submitted_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING deliverable_id`,
        [milestoneId, meta.deliverableType, meta.title, meta.repoLink || null, meta.evidenceUrl || null, mongoId, user.userId]);
      await insertVersion(c, d.deliverable_id, v, user.userId);
      return d.deliverable_id as number;
    });
    await confirmDocument(mongoId, deliverableId).catch(log('Confirming Mongo document'));
    await recordAttachment({ projectId, deliverableId, v, uploadedBy: user.userId }).catch(log('Recording attachment'));
    return { deliverableId };
  } catch (e) {
    await discardDocument(mongoId);
    await deleteStored(v.stored?.key);
    throw e;
  }
}

export async function insertVersion(c: import('pg').PoolClient, deliverableId: number, v: import('./upload').PreparedVersion, userId: number) {
  const { rows: [r] } = await c.query(
    `INSERT INTO document_versions(deliverable_id, change_summary, file_name, file_url, file_size_bytes, checksum_sha256, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING version_id, version_number`,
    [deliverableId, v.changeSummary, v.fileName, v.fileUrl, v.sizeBytes, v.checksum, userId]);
  return r as { version_id: number; version_number: number };
}

/** Another version of a draft (or returned) deliverable. A returned (rejected) one goes back to draft. */
export async function addVersionFlow(user: CurrentUser, ctx: { deliverableId: number; projectId: number; mongoDocId: string | null; milestoneId: number; title: string; deliverableType: string }, u: UploadRequest) {
  const v = await prepareVersion(u);
  try {
    const row = await withTransaction(user.userId, async (c) => {
      const { rows: [d] } = await c.query(
        `SELECT d.status, m.status AS milestone_status FROM deliverables d JOIN milestones m ON m.milestone_id = d.milestone_id
          WHERE d.deliverable_id = $1 FOR UPDATE OF d`, [ctx.deliverableId]);
      if (!['draft', 'rejected'].includes(d.status)) throw new ApiError(409, 'locked', 'Only a draft or returned deliverable can get a new version.');
      if (!OPEN_FOR_UPLOADS.includes(d.milestone_status)) throw new ApiError(409, 'not_open', 'The milestone is not open for changes.');
      if (d.status === 'rejected') await c.query(`UPDATE deliverables SET status = 'draft' WHERE deliverable_id = $1`, [ctx.deliverableId]);
      return insertVersion(c, ctx.deliverableId, v, user.userId);
    });
    const dv = versionDoc(v, row.version_number, user.userId);
    if (ctx.mongoDocId) await pushVersion(ctx.mongoDocId, dv, v.extractedText).catch(log('Appending version to Mongo'));
    await recordAttachment({ projectId: ctx.projectId, deliverableId: ctx.deliverableId, v, uploadedBy: user.userId }).catch(log('Recording attachment'));
    return { versionId: row.version_id, versionNumber: row.version_number };
  } catch (e) {
    await deleteStored(v.stored?.key);
    throw e;
  }
}
