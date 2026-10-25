import { api, intParam, readJson } from '@/lib/api/route';
import { forbidden, notFound } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { requireProjectParticipant } from '@/lib/auth/access';
import { query, withTransaction } from '@/lib/db/pg';
import { appendMessage, safely } from '@/lib/docs/threads';
import { FeedbackCreate } from '@/lib/validation/schemas';

// The reviewer raises a feedback item and assigns it to ONE student of the team (DB trigger checks membership).
export const POST = api<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const reviewId = intParam(id);
  const [r] = await query<{ reviewer_id: number; milestone_id: number; project_id: number }>(
    `SELECT r.reviewer_id, r.milestone_id, m.project_id FROM reviews r JOIN milestones m ON m.milestone_id = r.milestone_id WHERE r.review_id = $1`, [reviewId]);
  if (!r) throw notFound('Review not found.');
  const access = await requireProjectParticipant(user, r.project_id);
  if (!(access.isGuide || access.isReviewer)) throw forbidden('Only the guide or a reviewer can raise feedback.');
  const b = FeedbackCreate.parse(await readJson(req));
  const feedbackId = await withTransaction(user.userId, async (c) => {
    const { rows: [f] } = await c.query(
      `INSERT INTO feedback_items(review_id, created_by, assigned_user_id, description, severity, due_date)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING feedback_id`,
      [reviewId, user.userId, b.assignedUserId, b.description, b.severity, b.dueDate ?? null]);
    return f.feedback_id as number;
  });
  await safely(() => appendMessage({
    feedbackId, projectId: r.project_id, milestoneId: r.milestone_id, theme: b.theme, status: 'open',
    message: { authorId: user.userId, authorName: user.name, role: access.isGuide ? 'faculty_guide' : 'reviewer', text: b.description, at: new Date() },
  }));
  return { feedbackId };
}, 201);
