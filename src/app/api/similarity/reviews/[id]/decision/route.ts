import { api, intParam, readJson } from '@/lib/api/route';
import { forbidden, notFound } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { requireProjectGuide } from '@/lib/auth/access';
import { query, withTransaction } from '@/lib/db/pg';
import { SimilarityDecision } from '@/lib/validation/schemas';

/**
 * Faculty records the final call on a possible overlap. The system only flags; a person decides (spec 12).
 * The database checks the transition is legal (pending/escalated -> a decision) and writes the audit row.
 */
export const POST = api<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const similarityId = intParam(id);
  const [r] = await query<{ source_project_id: number }>(`SELECT source_project_id FROM similarity_reviews WHERE similarity_id = $1`, [similarityId]);
  if (!r) throw notFound('Similarity review not found.');
  // The guide of the source proposal decides; an admin may as well. Reviewers can read but not decide.
  if (!user.roles.includes('admin')) {
    try { await requireProjectGuide(user, r.source_project_id); } catch { throw forbidden('Only the guide of this proposal (or an admin) can record the decision.'); }
  }
  const b = SimilarityDecision.parse(await readJson(req));
  await withTransaction(user.userId, async (c) => {
    await c.query(`SELECT 1 FROM similarity_reviews WHERE similarity_id = $1 FOR UPDATE`, [similarityId]);
    await c.query(
      `UPDATE similarity_reviews SET faculty_decision = $2, comments = $3, reviewed_by = $4, decided_at = now() WHERE similarity_id = $1`,
      [similarityId, b.decision, b.comments || null, user.userId]);
  });
  return { decision: b.decision };
});
