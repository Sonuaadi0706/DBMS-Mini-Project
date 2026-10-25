import { api, intParam } from '@/lib/api/route';
import { requireUser } from '@/lib/auth/session';
import { requireProjectParticipant } from '@/lib/auth/access';
import { projectDocStats } from '@/lib/docs/stats';

// A1 (versions) and A3 (completeness) for the team and staff. A4 (open feedback themes) is staff-only: its counts
// would otherwise reveal feedback assigned to teammates.
export const GET = api<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser();
  const a = await requireProjectParticipant(user, intParam(id));
  return projectDocStats(a.projectId, a.isGuide || a.isReviewer || a.isAdmin);
});
