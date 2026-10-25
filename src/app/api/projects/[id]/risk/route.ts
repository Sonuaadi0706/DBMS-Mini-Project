import { api, intParam } from '@/lib/api/route';
import { requireUser } from '@/lib/auth/session';
import { requireProjectParticipant } from '@/lib/auth/access';
import { latestSnapshot } from '@/lib/risk';

// Staff see the full breakdown; the team sees level, score and the plain-English reasons (permission matrix 4.1).
export const GET = api<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser();
  const a = await requireProjectParticipant(user, intParam(id));
  const s = await latestSnapshot(a.projectId);
  if (!s) return { risk: null };
  const staff = a.isGuide || a.isReviewer || a.isAdmin;
  return { risk: { score: Number(s.risk_score), level: s.risk_level, reason: s.reason, calculatedAt: s.calculated_at, ...(staff ? { breakdown: s.breakdown } : {}) } };
});
