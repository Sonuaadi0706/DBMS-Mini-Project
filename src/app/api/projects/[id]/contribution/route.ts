import { api, intParam } from '@/lib/api/route';
import { requireUser } from '@/lib/auth/session';
import { requireProjectParticipant } from '@/lib/auth/access';
import { contributionFor } from '@/lib/data/contribution';

// Guide, reviewers and admin see the whole team; a student sees ONLY their own row (CON-04).
export const GET = api<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser();
  const a = await requireProjectParticipant(user, intParam(id));
  const onlyMine = a.isMember && !a.isGuide && !a.isReviewer && !a.isAdmin;
  return { members: await contributionFor(a.projectId, onlyMine ? user.userId : null), scope: onlyMine ? 'self' : 'team' };
});
