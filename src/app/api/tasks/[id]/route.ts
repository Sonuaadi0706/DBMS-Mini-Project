import { api, intParam, readJson } from '@/lib/api/route';
import { ApiError } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { projectIdOfTask, requireTeamMember } from '@/lib/auth/access';
import { withTransaction } from '@/lib/db/pg';
import { TaskPatch } from '@/lib/validation/schemas';

const COLUMNS = {
  title: 'title', description: 'description', effortHours: 'effort_hours', priority: 'priority',
  plannedStartDate: 'planned_start_date', plannedCompletionDate: 'planned_completion_date', dueDate: 'due_date',
} as const;

export const PATCH = api<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const taskId = intParam(id);
  await requireTeamMember(user, (await projectIdOfTask(taskId)).projectId);
  const body = TaskPatch.parse(await readJson(req));
  const sets: string[] = []; const values: unknown[] = [taskId];
  for (const [key, col] of Object.entries(COLUMNS)) {
    const v = (body as Record<string, unknown>)[key];
    if (v !== undefined) { values.push(v); sets.push(`${col} = $${values.length}`); }
  }
  if (!sets.length) return { ok: true };
  await withTransaction(user.userId, async (c) => {
    const { rows: [t] } = await c.query(`SELECT status FROM tasks WHERE task_id = $1 FOR UPDATE`, [taskId]);
    if (t.status === 'verified') throw new ApiError(409, 'locked', 'A verified task can no longer be edited.');
    await c.query(`UPDATE tasks SET ${sets.join(', ')} WHERE task_id = $1`, values);
  });
  return { ok: true };
});

// Only a task nobody has started can be deleted (mistakes); anything with progress stays for the record.
export const DELETE = api<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser();
  const taskId = intParam(id);
  await requireTeamMember(user, (await projectIdOfTask(taskId)).projectId);
  await withTransaction(user.userId, async (c) => {
    const { rows: [t] } = await c.query(`SELECT status FROM tasks WHERE task_id = $1 FOR UPDATE`, [taskId]);
    if (t.status !== 'todo') throw new ApiError(409, 'started', 'Only a task that has not been started can be deleted.');
    await c.query(`DELETE FROM tasks WHERE task_id = $1`, [taskId]);
  });
  return { ok: true };
});
