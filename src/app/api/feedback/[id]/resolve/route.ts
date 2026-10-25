import { api, intParam, readJson } from '@/lib/api/route';
import { ApiError } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { withTransaction } from '@/lib/db/pg';
import { FeedbackResolve } from '@/lib/validation/schemas';
import { badState, feedbackFor, requireAssignee, syncThread } from '@/lib/docs/feedback-actions';

// The assigned student marks the item resolved. It is not "done" until the guide verifies it.
// (An unverified resolution creates UNVERIFIED contribution evidence through a trigger.)
export const POST = api<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const { fb, access } = await feedbackFor(user, intParam(id));
  requireAssignee(user, fb);
  const { responseText } = FeedbackResolve.parse(await readJson(req));
  await withTransaction(user.userId, async (c) => {
    const { rows: [f] } = await c.query(`SELECT resolution_status, response_text FROM feedback_items WHERE feedback_id = $1 FOR UPDATE`, [fb.feedbackId]);
    if (!['open', 'in_progress', 'reopened'].includes(f.resolution_status)) throw badState({ ...fb, status: f.resolution_status }, 'resolved');
    if (!responseText && !f.response_text) throw new ApiError(422, 'validation', 'Explain what you changed before resolving.', { responseText: 'Write a short response' });
    await c.query(
      `UPDATE feedback_items SET resolution_status = 'resolved', resolved_at = now(), response_text = COALESCE($2, response_text) WHERE feedback_id = $1`,
      [fb.feedbackId, responseText ?? null]);
  });
  await syncThread(user, fb, access, 'resolved', responseText);
  return { status: 'resolved' };
});
