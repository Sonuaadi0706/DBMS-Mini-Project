import { api, intParam } from '@/lib/api/route';
import { ApiError } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { loadDeliverable, requireTeamMember } from '@/lib/auth/access';
import { withTransaction } from '@/lib/db/pg';
import { mongoDb } from '@/lib/db/mongo';
import { deleteStored } from '@/lib/storage';
import { ObjectId } from 'mongodb';

// Only a draft can be removed (a mistake). The delete is audited by a trigger; submitted work is never deleted.
export const DELETE = api<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser();
  const ctx = await loadDeliverable(intParam(id));
  await requireTeamMember(user, ctx.projectId);
  const files = await withTransaction(user.userId, async (c) => {
    const { rows: [d] } = await c.query(`SELECT status FROM deliverables WHERE deliverable_id = $1 FOR UPDATE`, [ctx.deliverableId]);
    if (!d || d.status !== 'draft') throw new ApiError(409, 'locked', 'Only a draft deliverable can be deleted.');
    const { rows: vs } = await c.query(`SELECT version_id, file_url FROM document_versions WHERE deliverable_id = $1`, [ctx.deliverableId]);
    // Their (still unverified) upload evidence goes with them.
    await c.query(`DELETE FROM contribution_evidence WHERE source_table = 'document_versions' AND source_id = ANY($1::int[]) AND NOT verified_flag`, [vs.map((v) => v.version_id)]);
    await c.query(`DELETE FROM deliverables WHERE deliverable_id = $1`, [ctx.deliverableId]);
    return vs.map((v) => v.file_url as string);
  });
  // After the commit: remove the files and the Mongo document (best effort).
  await Promise.all(files.map((f) => deleteStored(f)));
  if (ctx.mongoDocId) {
    try { await (await mongoDb()).collection('documents').deleteOne({ _id: new ObjectId(ctx.mongoDocId) }); } catch (e) { console.error('Mongo cleanup failed', e); }
  }
  return { ok: true };
});
