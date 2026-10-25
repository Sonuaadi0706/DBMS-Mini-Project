import { api, intParam } from '@/lib/api/route';
import { ApiError, forbidden } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { projectIdOfMilestone, requireProjectParticipant } from '@/lib/auth/access';
import { withTransaction } from '@/lib/db/pg';

// A guide or reviewer allocated to the project opens a review of a milestone (one open review each).
export const POST = api<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser();
  const milestoneId = intParam(id);
  const a = await requireProjectParticipant(user, await projectIdOfMilestone(milestoneId));
  if (!a.isGuide && !a.isReviewer) throw forbidden('Only the guide or a reviewer of this project can review a milestone.');
  const reviewId = await withTransaction(user.userId, async (c) => {
    const { rows: [m] } = await c.query(`SELECT status FROM milestones WHERE milestone_id = $1`, [milestoneId]);
    if (m.status === 'planned') throw new ApiError(409, 'bad_state', 'Nothing to review yet: the milestone has not started.');
    const { rows: [open] } = await c.query(`SELECT review_id FROM reviews WHERE milestone_id = $1 AND reviewer_id = $2 AND decision = 'pending'`, [milestoneId, user.userId]);
    if (open) return open.review_id as number;
    const { rows: [r] } = await c.query(`INSERT INTO reviews(milestone_id, reviewer_id) VALUES ($1,$2) RETURNING review_id`, [milestoneId, user.userId]);
    return r.review_id as number;
  });
  return { reviewId };
}, 201);
