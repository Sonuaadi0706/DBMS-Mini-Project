import { api, intParam, readJson } from '@/lib/api/route';
import { ApiError } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { projectIdOfMilestone, requireProjectGuide } from '@/lib/auth/access';
import { withTransaction } from '@/lib/db/pg';
import { MilestoneDecision } from '@/lib/validation/schemas';
import { refreshRiskSafely } from '@/lib/risk';

const REVIEW_DECISION = { approve: 'approved', request_revision: 'revision_requested', reject: 'rejected' } as const;

/**
 * Guide actions on a milestone: start reviewing (submitted -> under_review) or decide it.
 * Approval is refused by a database trigger while mandatory deliverable types are missing.
 */
export const POST = api<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const milestoneId = intParam(id);
  const access = await requireProjectGuide(user, await projectIdOfMilestone(milestoneId));
  const { action, comments } = MilestoneDecision.parse(await readJson(req));

  const status = await withTransaction(user.userId, async (c) => {
    const { rows: [m] } = await c.query(`SELECT status FROM milestones WHERE milestone_id = $1 FOR UPDATE`, [milestoneId]);
    if (action === 'review') {
      if (m.status !== 'submitted') throw new ApiError(409, 'bad_state', 'Only a submitted milestone can be taken into review.');
      await c.query(`UPDATE milestones SET status = 'under_review' WHERE milestone_id = $1`, [milestoneId]);
      // The guide gets a pending review record to fill in (unless one already exists).
      await c.query(
        `INSERT INTO reviews(milestone_id, reviewer_id)
         SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM reviews WHERE milestone_id = $1 AND reviewer_id = $2 AND decision = 'pending')`,
        [milestoneId, user.userId]);
      return 'under_review';
    }
    if (m.status !== 'under_review') throw new ApiError(409, 'bad_state', 'Start the review before deciding this milestone.');
    const to = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'revision_requested';
    if (action === 'approve') {
      await c.query(`UPDATE deliverables SET status = 'accepted' WHERE milestone_id = $1 AND status = 'submitted'`, [milestoneId]);
    }
    // For revision / rejection nothing is changed automatically: the guide returns individual deliverables
    // through /api/deliverables/:id/decision, and the rest stay submitted.
    await c.query(
      `UPDATE milestones SET status = $2::text,
              approved_by = CASE WHEN $2::text = 'approved' THEN $3::int END,
              approved_at = CASE WHEN $2::text = 'approved' THEN now() END,
              approval_comments = $4
        WHERE milestone_id = $1`, [milestoneId, to, user.userId, comments || null]);
    const decision = REVIEW_DECISION[action];
    const upd = await c.query(
      `UPDATE reviews SET decision = $3, comments = $4, review_date = CURRENT_DATE
        WHERE milestone_id = $1 AND reviewer_id = $2 AND decision = 'pending'`, [milestoneId, user.userId, decision, comments || null]);
    if (!upd.rowCount) {
      await c.query(
        `INSERT INTO reviews(milestone_id, reviewer_id, decision, comments, review_date) VALUES ($1,$2,$3,$4,CURRENT_DATE)`,
        [milestoneId, user.userId, decision, comments || null]);
    }
    return to;
  });
  await refreshRiskSafely(access.projectId);
  return { status };
});
