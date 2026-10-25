import { api, intParam, readJson } from '@/lib/api/route';
import { ApiError } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { projectIdOfMilestone, requirePlanEditor } from '@/lib/auth/access';
import { withTransaction } from '@/lib/db/pg';
import { MilestonePatch } from '@/lib/validation/schemas';

const COLUMNS = { title: 'title', description: 'description', startDate: 'start_date', dueDate: 'due_date', weightage: 'weightage' } as const;

export const PATCH = api<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const milestoneId = intParam(id);
  const projectId = await projectIdOfMilestone(milestoneId);
  await requirePlanEditor(user, projectId);
  const body = MilestonePatch.parse(await readJson(req));
  const sets: string[] = []; const values: unknown[] = [milestoneId];
  for (const [key, col] of Object.entries(COLUMNS)) {
    const v = (body as Record<string, unknown>)[key];
    if (v !== undefined) { values.push(v); sets.push(`${col} = $${values.length}`); }
  }
  if (!sets.length) return { ok: true };
  await withTransaction(user.userId, async (c) => {
    const { rows: [m] } = await c.query(`SELECT status FROM milestones WHERE milestone_id = $1 FOR UPDATE`, [milestoneId]);
    if (['submitted', 'under_review', 'approved'].includes(m.status)) {
      throw new ApiError(409, 'locked', `A ${m.status.replace('_', ' ')} milestone can no longer be edited.`);
    }
    await c.query(`UPDATE milestones SET ${sets.join(', ')} WHERE milestone_id = $1`, values);
  });
  return { ok: true };
});
