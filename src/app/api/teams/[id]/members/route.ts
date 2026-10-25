import { api, intParam, readJson } from '@/lib/api/route';
import { requireUser } from '@/lib/auth/session';
import { requireTeamManager } from '@/lib/auth/team-access';
import { withTransaction } from '@/lib/db/pg';
import { MemberAdd } from '@/lib/validation/schemas';

export const POST = api<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const teamId = intParam(id);
  const team = await requireTeamManager(user, teamId);
  const body = MemberAdd.parse(await readJson(req));
  await withTransaction(user.userId, async (c) => {
    // The first member of an empty team becomes its leader (one leader per team is a DB rule).
    const { rows: [l] } = await c.query(`SELECT 1 FROM team_members WHERE team_id = $1 AND member_role = 'leader'`, [teamId]);
    await c.query(
      `INSERT INTO team_members(team_id, course_id, user_id, member_role, responsibility) VALUES ($1,$2,$3,$4,$5)`,
      [teamId, team.courseId, body.userId, l ? 'member' : 'leader', body.responsibility]);
  });
  return { ok: true };
}, 201);
