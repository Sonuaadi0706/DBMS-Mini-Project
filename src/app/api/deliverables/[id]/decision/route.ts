import { z } from 'zod';
import { api, intParam, readJson } from '@/lib/api/route';
import { ApiError } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { loadDeliverable, requireProjectGuide } from '@/lib/auth/access';
import { withTransaction } from '@/lib/db/pg';

const Body = z.object({ action: z.enum(['accept', 'reject']) });

// The guide accepts good deliverables and returns the rest before deciding the milestone.
export const POST = api<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const ctx = await loadDeliverable(intParam(id));
  await requireProjectGuide(user, ctx.projectId);
  const { action } = Body.parse(await readJson(req));
  if (!['submitted', 'under_review'].includes(ctx.milestoneStatus)) throw new ApiError(409, 'bad_state', 'The milestone has not been submitted for review.');
  const to = action === 'accept' ? 'accepted' : 'rejected';
  await withTransaction(user.userId, (c) => c.query(`UPDATE deliverables SET status = $2 WHERE deliverable_id = $1`, [ctx.deliverableId, to]));
  return { status: to };
});
