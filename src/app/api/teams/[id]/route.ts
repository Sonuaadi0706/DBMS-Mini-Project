import { api, intParam } from '@/lib/api/route';
import { requireUser } from '@/lib/auth/session';
import { requireTeamAccess } from '@/lib/auth/team-access';
import { getTeamMembers } from '@/lib/data/queries';

export const GET = api<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser();
  const teamId = intParam(id);
  const access = await requireTeamAccess(user, teamId);
  return { team: { teamId, courseId: access.courseId, teamName: access.teamName }, members: await getTeamMembers(teamId) };
});
