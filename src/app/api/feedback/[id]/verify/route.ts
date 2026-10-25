import { api, intParam } from '@/lib/api/route';
import { requireUser } from '@/lib/auth/session';
import { withTransaction } from '@/lib/db/pg';
import { badState, feedbackFor, requireFeedbackGuide, syncThread } from '@/lib/docs/feedback-actions';

// Guide confirms the fix. A trigger then marks the student's feedback evidence as verified.
export const POST = api<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser();
  const { fb, access } = await feedbackFor(user, intParam(id));
  requireFeedbackGuide(access);
  await withTransaction(user.userId, async (c) => {
    const { rows: [f] } = await c.query(`SELECT resolution_status FROM feedback_items WHERE feedback_id = $1 FOR UPDATE`, [fb.feedbackId]);
    if (f.resolution_status !== 'resolved') throw badState({ ...fb, status: f.resolution_status }, 'verified (only resolved items can be verified)');
    await c.query(`UPDATE feedback_items SET resolution_status = 'verified', verified_by = $2, verified_at = now() WHERE feedback_id = $1`, [fb.feedbackId, user.userId]);
  });
  await syncThread(user, fb, access, 'verified');
  return { status: 'verified' };
});
