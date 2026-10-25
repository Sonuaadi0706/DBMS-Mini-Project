import { api, intParam, readJson } from '@/lib/api/route';
import { requireUser } from '@/lib/auth/session';
import { withTransaction } from '@/lib/db/pg';
import { FeedbackResponse } from '@/lib/validation/schemas';
import { badState, feedbackFor, requireAssignee, syncThread } from '@/lib/docs/feedback-actions';

// The assigned student answers; an open / reopened item moves to in_progress.
export const POST = api<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const { fb, access } = await feedbackFor(user, intParam(id));
  requireAssignee(user, fb);
  const { responseText } = FeedbackResponse.parse(await readJson(req));
  const status = await withTransaction(user.userId, async (c) => {
    const { rows: [f] } = await c.query(`SELECT resolution_status FROM feedback_items WHERE feedback_id = $1 FOR UPDATE`, [fb.feedbackId]);
    if (!['open', 'in_progress', 'reopened'].includes(f.resolution_status)) throw badState({ ...fb, status: f.resolution_status }, 'answered');
    await c.query(
      `UPDATE feedback_items SET response_text = $2,
              resolution_status = CASE WHEN resolution_status = 'in_progress' THEN resolution_status ELSE 'in_progress' END
        WHERE feedback_id = $1`, [fb.feedbackId, responseText]);
    return 'in_progress';
  });
  await syncThread(user, fb, access, status, responseText);
  return { status };
});
