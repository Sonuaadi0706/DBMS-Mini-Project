import { api, intParam } from '@/lib/api/route';
import { ApiError } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { projectIdOfMilestone, requireTeamMember } from '@/lib/auth/access';
import { withTransaction } from '@/lib/db/pg';
import { confirmDocument, createPendingDocument, discardDocument, recordAttachment, versionDoc } from '@/lib/docs/documents';
import { insertVersion, OPEN_FOR_UPLOADS } from '@/lib/docs/flows';
import { DeliverableFields, prepareVersion, readUpload, type PreparedVersion } from '@/lib/docs/upload';
import { deleteStored } from '@/lib/storage';
import { refreshRiskSafely } from '@/lib/risk';

/**
 * Atomic milestone submission (spec 9.5). In ONE PostgreSQL transaction:
 *   1 lock + verify the milestone      4 milestone status -> submitted
 *   2 deliverable metadata             5 review requests for the guide / reviewers
 *   3 document version                 6 audit row
 * Any error rolls back all six steps. The file written to disk and the pending MongoDB document are
 * outside PostgreSQL, so they are removed again (compensation) when the transaction fails.
 *
 * Test hook: header `x-test-fail-at: N` makes step N fail on purpose. It only works when
 * ENABLE_TEST_HOOKS=1 and never in production, so the rollback can be demonstrated on demand.
 */
const hookStep = (req: Request): number | null => {
  if (process.env.ENABLE_TEST_HOOKS !== '1' || process.env.NODE_ENV === 'production') return null;
  const n = Number(req.headers.get('x-test-fail-at'));
  return Number.isInteger(n) && n >= 1 && n <= 6 ? n : null;
};

export const POST = api<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const milestoneId = intParam(id);
  const projectId = await projectIdOfMilestone(milestoneId);
  await requireTeamMember(user, projectId);

  const u = await readUpload(req);
  const failAt = hookStep(req);
  const wantsNew = Boolean(u.file || u.fields.linkUrl || u.fields.deliverableType || u.fields.title);

  let meta: ReturnType<typeof DeliverableFields.parse> | undefined;
  let v: PreparedVersion | undefined;
  let mongoId: string | null = null;
  try {
    if (wantsNew) {
      meta = DeliverableFields.parse(u.fields);
      v = await prepareVersion(u);                     // stores the file, if one was sent
      mongoId = String(await createPendingDocument({
        projectId, milestoneId, deliverableType: meta.deliverableType, title: meta.title,
        version: versionDoc(v, 1, user.userId), extractedText: v.extractedText,
      }));
    }

    const step = (n: number) => { if (failAt === n) throw new ApiError(500, 'test_hook', `Test hook: simulated failure at step ${n}.`); };

    const result = await withTransaction(user.userId, async (c) => {
      // 1. lock the milestone (a second concurrent submit waits here) and verify it can be submitted
      step(1);
      const { rows: [m] } = await c.query(`SELECT status FROM milestones WHERE milestone_id = $1 FOR UPDATE`, [milestoneId]);
      if (!OPEN_FOR_UPLOADS.includes(m.status)) {
        throw new ApiError(409, 'bad_state', m.status === 'planned' ? 'Start the milestone before submitting it.' : `This milestone is already ${m.status.replace('_', ' ')}.`);
      }

      // 2. deliverable metadata
      step(2);
      let newDeliverableId: number | null = null;
      if (meta && v) {
        const { rows: [d] } = await c.query(
          `INSERT INTO deliverables(milestone_id, deliverable_type, title, repo_link, evidence_url, mongo_doc_id, status, submitted_by, submitted_at)
           VALUES ($1,$2,$3,$4,$5,$6,'submitted',$7, now()) RETURNING deliverable_id`,
          [milestoneId, meta.deliverableType, meta.title, meta.repoLink || null, meta.evidenceUrl || null, mongoId, user.userId]);
        newDeliverableId = d.deliverable_id;

        // 3. document version (version_number is assigned by a trigger). A bad payload fails HERE, e.g. a
        //    negative file_size_bytes violates a CHECK, and everything above is rolled back.
        step(3);
        await insertVersion(c, d.deliverable_id, v, user.userId);
      }
      // Drafts the team prepared earlier are submitted together with the milestone.
      const flipped = await c.query(
        `UPDATE deliverables SET status = 'submitted', submitted_at = now()
          WHERE milestone_id = $1 AND status = 'draft'
            AND EXISTS (SELECT 1 FROM document_versions dv WHERE dv.deliverable_id = deliverables.deliverable_id)`, [milestoneId]);
      const { rows: [cnt] } = await c.query(`SELECT COUNT(*)::int AS n FROM deliverables WHERE milestone_id = $1 AND status = 'submitted'`, [milestoneId]);
      if (cnt.n === 0) {
        throw new ApiError(422, 'nothing_to_submit', 'Attach at least one deliverable (file or link) before submitting.', { file: 'Attach a file or provide a link' });
      }

      // 4. milestone status
      step(4);
      await c.query(`UPDATE milestones SET status = 'submitted', submitted_at = now() WHERE milestone_id = $1`, [milestoneId]);

      // 5. review requests: one pending review per allocated guide / reviewer (none twice)
      step(5);
      const reviews = await c.query(
        `INSERT INTO reviews(milestone_id, reviewer_id, review_type)
         SELECT $1, ga.user_id, 'milestone' FROM guide_allocations ga
          WHERE ga.project_id = $2
            AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.milestone_id = $1 AND r.reviewer_id = ga.user_id AND r.decision = 'pending')`,
        [milestoneId, projectId]);

      // 6. audit row
      step(6);
      await c.query(
        `INSERT INTO audit_logs(user_id, action, entity_type, entity_id, new_values) VALUES ($1,'MILESTONE_SUBMITTED','milestone',$2,$3::jsonb)`,
        [user.userId, String(milestoneId), JSON.stringify({ newDeliverableId, draftsSubmitted: flipped.rowCount, reviewRequests: reviews.rowCount })]);

      return { newDeliverableId, draftsSubmitted: flipped.rowCount ?? 0, reviewRequests: reviews.rowCount ?? 0 };
    });

    // Committed. Confirm the Mongo document (best effort: `npm run mongo:reconcile` repairs a miss).
    if (mongoId && result.newDeliverableId && v) {
      await confirmDocument(mongoId, result.newDeliverableId).catch((e) => console.error('Confirming Mongo document failed', e));
      await recordAttachment({ projectId, deliverableId: result.newDeliverableId, v, uploadedBy: user.userId }).catch((e) => console.error('Recording attachment failed', e));
    }
    await refreshRiskSafely(projectId);
    return { status: 'submitted', ...result };
  } catch (e) {
    // Compensation for the two things PostgreSQL could not roll back.
    await discardDocument(mongoId);
    await deleteStored(v?.stored?.key);
    throw e;
  }
});
