import { api, intParam } from '@/lib/api/route';
import { requireUser } from '@/lib/auth/session';
import { requireProjectParticipant } from '@/lib/auth/access';
import { peerSummaryStaff, peerSummaryStudent } from '@/lib/data/peer';

export const GET = api<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser();
  const a = await requireProjectParticipant(user, intParam(id));
  if (a.isGuide || a.isReviewer || a.isAdmin) return { view: 'staff', ...(await peerSummaryStaff(a.projectId)) };
  return { view: 'self', ...(await peerSummaryStudent(a.projectId, user.userId)) };
});
