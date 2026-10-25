import { api, intParam } from '@/lib/api/route';
import { requireUser } from '@/lib/auth/session';
import { projectIdOfMilestone, requireTeamMember } from '@/lib/auth/access';
import { assertPlannable, startProjectIfApproved } from '@/lib/auth/plan';
import { withTransaction } from '@/lib/db/pg';
import { refreshRiskSafely } from '@/lib/risk';

// planned | revision_requested | rejected -> in_progress. The DB transition table rejects anything else.
export const POST = api<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser();
  const milestoneId = intParam(id);
  const access = await requireTeamMember(user, await projectIdOfMilestone(milestoneId));
  assertPlannable(access);
  await withTransaction(user.userId, async (c) => {
    await startProjectIfApproved(c, access.projectId);
    await c.query(`UPDATE milestones SET status = 'in_progress' WHERE milestone_id = $1`, [milestoneId]);
  });
  await refreshRiskSafely(access.projectId);
  return { status: 'in_progress' };
});
