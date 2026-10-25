import { api, intParam, readJson } from '@/lib/api/route';
import { forbidden } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { projectIdOfTask, requireProjectParticipant } from '@/lib/auth/access';
import { withTransaction } from '@/lib/db/pg';
import { TaskStatusBody } from '@/lib/validation/schemas';
import { refreshRiskSafely } from '@/lib/risk';

/**
 * The API decides WHO may move a task; the database decides whether the move itself is legal
 * (status_transitions + trigger). Team members move work forward; only the guide verifies it or sends it back.
 */
export const POST = api<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const taskId = intParam(id);
  const access = await requireProjectParticipant(user, (await projectIdOfTask(taskId)).projectId);
  const { status } = TaskStatusBody.parse(await readJson(req));

  if (status === 'verified') {
    if (!access.isGuide) throw forbidden('Only the project\'s guide can verify a task.');
  } else if (!access.isMember && !(access.isGuide && status === 'in_progress')) {
    throw forbidden('Only the team can move its tasks.');
  }

  await withTransaction(user.userId, async (c) => {
    await c.query(`SELECT 1 FROM tasks WHERE task_id = $1 FOR UPDATE`, [taskId]);
    if (status === 'verified') {
      await c.query(`UPDATE tasks SET status = 'verified', verified_by = $2, verified_at = now() WHERE task_id = $1`, [taskId, user.userId]);
    } else {
      await c.query(`UPDATE tasks SET status = $2 WHERE task_id = $1`, [taskId, status]);
    }
  });
  await refreshRiskSafely(access.projectId);
  return { status };
});
