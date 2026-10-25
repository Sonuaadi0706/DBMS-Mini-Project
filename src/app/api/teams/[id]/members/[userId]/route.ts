import { api, intParam, readJson } from '@/lib/api/route';
import { ApiError } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { requireTeamManager } from '@/lib/auth/team-access';
import { query, withTransaction } from '@/lib/db/pg';
import { MemberPatch } from '@/lib/validation/schemas';

export const PATCH = api<{ id: string; userId: string }>(async (req, p) => {
  const user = await requireUser();
  const teamId = intParam(p.id); const memberId = intParam(p.userId, 'userId');
  await requireTeamManager(user, teamId);
  const body = MemberPatch.parse(await readJson(req));
  const rows = await query(`UPDATE team_members SET responsibility = $3 WHERE team_id = $1 AND user_id = $2 RETURNING user_id`,
    [teamId, memberId, body.responsibility]);
  if (!rows.length) throw new ApiError(404, 'not_found', 'That person is not in this team.');
  return { ok: true };
});

export const DELETE = api<{ id: string; userId: string }>(async (_req, p) => {
  const user = await requireUser();
  const teamId = intParam(p.id); const memberId = intParam(p.userId, 'userId');
  await requireTeamManager(user, teamId);
  const [m] = await query<{ member_role: string }>(`SELECT member_role FROM team_members WHERE team_id = $1 AND user_id = $2`, [teamId, memberId]);
  if (!m) throw new ApiError(404, 'not_found', 'That person is not in this team.');
  if (m.member_role === 'leader' && !user.roles.includes('admin')) {
    throw new ApiError(409, 'leader', 'The team leader cannot be removed. Ask an admin to change the leader.');
  }
  const [open] = await query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM task_assignments ta JOIN tasks t ON t.task_id = ta.task_id
       JOIN milestones ms ON ms.milestone_id = t.milestone_id JOIN projects p ON p.project_id = ms.project_id
      WHERE p.team_id = $1 AND ta.user_id = $2 AND t.status <> 'verified'`, [teamId, memberId]);
  if (open.n > 0) throw new ApiError(409, 'has_tasks', `They still have ${open.n} unfinished task(s). Reassign them first.`);
  await withTransaction(user.userId, (c) => c.query(`DELETE FROM team_members WHERE team_id = $1 AND user_id = $2`, [teamId, memberId]));
  return { ok: true };
});
