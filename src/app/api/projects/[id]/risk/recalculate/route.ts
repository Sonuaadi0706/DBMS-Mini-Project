import { api, intParam } from '@/lib/api/route';
import { ApiError, forbidden } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { requireProjectParticipant } from '@/lib/auth/access';
import { recalculateRisk } from '@/lib/risk';

// The project's guide (or an admin) can refresh the assessment on demand.
export const POST = api<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser();
  const a = await requireProjectParticipant(user, intParam(id));
  if (!(a.isGuide || a.isAdmin)) throw forbidden('Only the guide or an admin can recalculate risk.');
  if (!['approved', 'in_progress'].includes(a.status)) throw new ApiError(409, 'not_active', 'Risk is only assessed for approved or running projects.');
  const s = await recalculateRisk(a.projectId);
  return { risk: { score: Number(s.risk_score), level: s.risk_level, reason: s.reason, breakdown: s.breakdown, calculatedAt: s.calculated_at } };
});
