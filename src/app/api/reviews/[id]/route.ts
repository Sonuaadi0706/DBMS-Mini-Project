import { api, intParam, readJson } from '@/lib/api/route';
import { ApiError, forbidden, notFound } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { requireProjectParticipant } from '@/lib/auth/access';
import { query, withTransaction } from '@/lib/db/pg';
import { ReviewPatch } from '@/lib/validation/schemas';

/**
 * The reviewer records comments and rubric scores. A reviewer (not the guide) also records a recommendation
 * here. The guide's decision is final and moves the milestone, so it goes through /api/milestones/:id/decision.
 */
export const PATCH = api<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const reviewId = intParam(id);
  const [r] = await query<{ milestone_id: number; reviewer_id: number; decision: string; project_id: number }>(
    `SELECT r.milestone_id, r.reviewer_id, r.decision, m.project_id FROM reviews r JOIN milestones m ON m.milestone_id = r.milestone_id WHERE r.review_id = $1`, [reviewId]);
  if (!r) throw notFound('Review not found.');
  const access = await requireProjectParticipant(user, r.project_id);
  if (r.reviewer_id !== user.userId) throw forbidden('Only the reviewer who owns this review can change it.');
  const b = ReviewPatch.parse(await readJson(req));
  if (b.decision && access.isGuide) throw new ApiError(422, 'use_milestone_decision', 'The guide decides through the milestone decision, which also updates the milestone.', { decision: 'Use the milestone decision' });
  if (b.decision && r.decision !== 'pending') throw new ApiError(409, 'decided', 'This review already has a decision.');

  await withTransaction(user.userId, async (c) => {
    if (b.scores) {
      await c.query(`DELETE FROM review_scores WHERE review_id = $1`, [reviewId]);
      for (const s of b.scores) {
        await c.query(`INSERT INTO review_scores(review_id, criterion, max_score, score) VALUES ($1,$2,$3,$4)`, [reviewId, s.criterion, s.maxScore, s.score]);
      }
    }
    // total_score is always derived from the rubric (0-100), never typed in by hand.
    await c.query(
      `UPDATE reviews SET
              comments = COALESCE($2, comments),
              decision = COALESCE($3, decision),
              review_date = CASE WHEN $3::text IS NOT NULL THEN CURRENT_DATE ELSE review_date END,
              total_score = (SELECT ROUND(100 * SUM(score) / NULLIF(SUM(max_score), 0), 2) FROM review_scores WHERE review_id = $1)
        WHERE review_id = $1`, [reviewId, b.comments ?? null, b.decision ?? null]);
  });
  return { ok: true };
});
