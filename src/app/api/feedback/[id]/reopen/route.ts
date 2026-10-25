import { api, intParam, readJson } from '@/lib/api/route';
import { requireUser } from '@/lib/auth/session';
import { withTransaction } from '@/lib/db/pg';
import { FeedbackReopen } from '@/lib/validation/schemas';
import { badState, feedbackFor, requireFeedbackGuide, syncThread } from '@/lib/docs/feedback-actions';

// Guide sends a resolved item back to the student, optionally saying why.
export const POST = api<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const { fb, access } = await feedbackFor(user, intParam(id));
  requireFeedbackGuide(access);
  const { comment } = FeedbackReopen.parse(await readJson(req));
  await withTransaction(user.userId, async (c) => {
    const { rows: [f] } = await c.query(`SELECT resolution_status FROM feedback_items WHERE feedback_id = $1 FOR UPDATE`, [fb.feedbackId]);
    if (f.resolution_status !== 'resolved') throw badState({ ...fb, status: f.resolution_status }, 'reopened (only resolved items can be reopened)');
    await c.query(`UPDATE feedback_items SET resolution_status = 'reopened' WHERE feedback_id = $1`, [fb.feedbackId]);
  });
  await syncThread(user, fb, access, 'reopened', comment);
  return { status: 'reopened' };
});
