import { api, intParam } from '@/lib/api/route';
import { requireUser } from '@/lib/auth/session';
import { requireProjectParticipant } from '@/lib/auth/access';
import { listEvidence } from '@/lib/data/queries';

export const GET = api<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const projectId = intParam(id);
  const a = await requireProjectParticipant(user, projectId);
  const v = new URL(req.url).searchParams.get('verified');
  // A student sees only their own evidence; the guide, reviewers and admin see the whole team.
  const onlyMine = a.isMember && !a.isGuide && !a.isReviewer && !a.isAdmin;
  return { evidence: await listEvidence(projectId, onlyMine ? user.userId : null, v === null ? null : v === 'true') };
});
