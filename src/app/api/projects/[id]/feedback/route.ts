import { api, intParam } from '@/lib/api/route';
import { requireUser } from '@/lib/auth/session';
import { requireProjectParticipant } from '@/lib/auth/access';
import { listFeedback } from '@/lib/data/queries';

export const GET = api<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser();
  const projectId = intParam(id);
  const a = await requireProjectParticipant(user, projectId);
  // Students see only the feedback assigned to them; staff see everything for the project.
  const onlyMine = a.isMember && !a.isGuide && !a.isReviewer && !a.isAdmin;
  return { feedback: await listFeedback(projectId, onlyMine ? user.userId : null) };
});
