import { api, intParam, readJson } from '@/lib/api/route';
import { ApiError } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { projectIdOfTask, requireTeamMember } from '@/lib/auth/access';
import { withTransaction } from '@/lib/db/pg';
import { AssignmentBody } from '@/lib/validation/schemas';

async function lockOpenTask(c: import('pg').PoolClient, taskId: number) {
  const { rows: [t] } = await c.query(`SELECT status FROM tasks WHERE task_id = $1 FOR UPDATE`, [taskId]);
  if (t.status === 'verified') throw new ApiError(409, 'locked', 'A verified task can no longer be reassigned.');
}

export const POST = api<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const taskId = intParam(id);
  await requireTeamMember(user, (await projectIdOfTask(taskId)).projectId);
  const b = AssignmentBody.parse(await readJson(req));
  await withTransaction(user.userId, async (c) => {
    await lockOpenTask(c, taskId);
    if (b.assignmentType === 'owner') {
      // A task has exactly one owner: the previous owner becomes a collaborator.
      await c.query(`UPDATE task_assignments SET assignment_type = 'collaborator' WHERE task_id = $1 AND assignment_type = 'owner' AND user_id <> $2`, [taskId, b.userId]);
    } else {
      const { rows: [o] } = await c.query(`SELECT 1 FROM task_assignments WHERE task_id = $1 AND user_id = $2 AND assignment_type = 'owner'`, [taskId, b.userId]);
      if (o) throw new ApiError(409, 'only_owner', 'Pick another owner first; a task needs its owner.');
    }
    await c.query(
      `INSERT INTO task_assignments(task_id, user_id, assignment_type, assigned_by) VALUES ($1,$2,$3,$4)
       ON CONFLICT (task_id, user_id) DO UPDATE SET assignment_type = EXCLUDED.assignment_type`,
      [taskId, b.userId, b.assignmentType, user.userId]);
  });
  return { ok: true };
}, 201);

export const DELETE = api<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const taskId = intParam(id);
  await requireTeamMember(user, (await projectIdOfTask(taskId)).projectId);
  const userId = Number(new URL(req.url).searchParams.get('userId'));
  if (!Number.isInteger(userId) || userId <= 0) throw new ApiError(400, 'bad_request', 'userId is required.');
  await withTransaction(user.userId, async (c) => {
    await lockOpenTask(c, taskId);
    const res = await c.query(`DELETE FROM task_assignments WHERE task_id = $1 AND user_id = $2`, [taskId, userId]);
    if (!res.rowCount) throw new ApiError(404, 'not_found', 'That person is not assigned to this task.');
  });
  return { ok: true };
});
