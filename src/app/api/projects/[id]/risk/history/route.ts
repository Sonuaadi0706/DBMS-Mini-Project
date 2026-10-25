import { api, intParam } from '@/lib/api/route';
import { forbidden } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { requireProjectParticipant } from '@/lib/auth/access';
import { query } from '@/lib/db/pg';
import { riskTrend } from '@/lib/risk';

export const GET = api<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser();
  const a = await requireProjectParticipant(user, intParam(id));
  if (!(a.isGuide || a.isReviewer || a.isAdmin)) throw forbidden('Risk history is available to the guide, reviewers and admin.');
  const history = await query(
    `SELECT risk_id, risk_score, risk_level, reason, breakdown, calculated_at FROM risk_assessments WHERE project_id = $1 ORDER BY calculated_at DESC, risk_id DESC`, [a.projectId]);
  return { history, trend: await riskTrend(a.projectId) };
});
