import { api, readJson } from '@/lib/api/route';
import { forbidden } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { withTransaction } from '@/lib/db/pg';
import { listTeams } from '@/lib/data/queries';
import { TeamCreate } from '@/lib/validation/schemas';

export const GET = api(async () => {
  const user = await requireUser();
  return { teams: await listTeams(user) };
});

// Admin creates a team with its members (first = leader). A student creates a team and becomes its leader.
export const POST = api(async (req) => {
  const user = await requireUser();
  const isAdmin = user.roles.includes('admin');
  if (!isAdmin && !user.roles.includes('student')) throw forbidden('Only students and admins can create teams.');
  const body = TeamCreate.parse(await readJson(req));
  const members = isAdmin ? body.memberIds : [user.userId];
  const teamId = await withTransaction(user.userId, async (c) => {
    const { rows: [t] } = await c.query(
      `INSERT INTO teams(course_id, team_name, created_by) VALUES ($1,$2,$3) RETURNING team_id`,
      [body.courseId, body.teamName, user.userId]);
    for (const [i, uid] of members.entries()) {
      await c.query(
        `INSERT INTO team_members(team_id, course_id, user_id, member_role) VALUES ($1,$2,$3,$4)`,
        [t.team_id, body.courseId, uid, i === 0 ? 'leader' : 'member']);
    }
    return t.team_id as number;
  });
  return { teamId };
}, 201);
