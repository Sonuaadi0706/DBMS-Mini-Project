import { query } from '@/lib/db/pg';
import { forbidden, notFound } from '@/lib/api/errors';
import type { CurrentUser } from './session';

export interface TeamAccess { teamId: number; courseId: number; teamName: string; isAdmin: boolean; isMember: boolean; isLeader: boolean; isGuide: boolean }

async function load(user: CurrentUser, teamId: number): Promise<TeamAccess> {
  const [r] = await query<{ course_id: number; team_name: string; is_member: boolean; is_leader: boolean; is_guide: boolean }>(
    `SELECT t.course_id, t.team_name,
            EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = t.team_id AND tm.user_id = $2) AS is_member,
            EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = t.team_id AND tm.user_id = $2 AND tm.member_role = 'leader') AS is_leader,
            EXISTS (SELECT 1 FROM guide_allocations ga JOIN projects p ON p.project_id = ga.project_id
                     WHERE p.team_id = t.team_id AND ga.user_id = $2) AS is_guide
       FROM teams t WHERE t.team_id = $1`, [teamId, user.userId]);
  if (!r) throw notFound('Team not found.');
  return { teamId, courseId: r.course_id, teamName: r.team_name, isAdmin: user.roles.includes('admin'),
    isMember: r.is_member, isLeader: r.is_leader, isGuide: r.is_guide };
}

/** Read access: admin, team member, or someone allocated to the team's project. Others see 404. */
export async function requireTeamAccess(user: CurrentUser, teamId: number): Promise<TeamAccess> {
  const a = await load(user, teamId);
  if (!(a.isAdmin || a.isMember || a.isGuide)) throw notFound('Team not found.');
  return a;
}

/** Write access: admin or the team's leader. */
export async function requireTeamManager(user: CurrentUser, teamId: number): Promise<TeamAccess> {
  const a = await requireTeamAccess(user, teamId);
  if (!(a.isAdmin || a.isLeader)) throw forbidden('Only the team leader or an admin can change the team.');
  return a;
}
