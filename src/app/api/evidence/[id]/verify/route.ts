import { api, intParam } from '@/lib/api/route';
import { ApiError, notFound } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { requireProjectGuide } from '@/lib/auth/access';
import { query, withTransaction } from '@/lib/db/pg';
import { refreshRiskSafely } from '@/lib/risk';

// Only verified evidence counts towards contribution and the imbalance risk factor (spec 9.4).
export const POST = api<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser();
  const evidenceId = intParam(id);
  const [e] = await query<{ project_id: number; verified_flag: boolean }>(`SELECT project_id, verified_flag FROM contribution_evidence WHERE evidence_id = $1`, [evidenceId]);
  if (!e) throw notFound('Evidence not found.');
  await requireProjectGuide(user, e.project_id);
  if (e.verified_flag) throw new ApiError(409, 'already_verified', 'This evidence is already verified.');
  await withTransaction(user.userId, (c) => c.query(
    `UPDATE contribution_evidence SET verified_flag = TRUE, verified_by = $2, verified_at = now() WHERE evidence_id = $1`, [evidenceId, user.userId]));
  await refreshRiskSafely(e.project_id);
  return { ok: true };
});
