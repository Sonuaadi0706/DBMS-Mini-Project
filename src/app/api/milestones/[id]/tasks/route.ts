import { api, intParam, readJson } from '@/lib/api/route';
import { ApiError } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { projectIdOfMilestone, requireProjectParticipant, requireTeamMember } from '@/lib/auth/access';
import { assertPlannable } from '@/lib/auth/plan';
import { query, withTransaction } from '@/lib/db/pg';
import { TaskCreate } from '@/lib/validation/schemas';

export const GET = api<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser();
  const milestoneId = intParam(id);
  await requireProjectParticipant(user, await projectIdOfMilestone(milestoneId));
  const tasks = await query(
    `SELECT task_id, title, status, priority, effort_hours, due_date FROM tasks WHERE milestone_id = $1 ORDER BY due_date, task_id`, [milestoneId]);
  return { tasks };
});

// Task + owner + collaborators are created together. Assignees must belong to the team (DB trigger).
export const POST = api<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const milestoneId = intParam(id);
  const access = await requireTeamMember(user, await projectIdOfMilestone(milestoneId));
  assertPlannable(access);
  const b = TaskCreate.parse(await readJson(req));
  const taskId = await withTransaction(user.userId, async (c) => {
    const { rows: [m] } = await c.query(`SELECT status FROM milestones WHERE milestone_id = $1`, [milestoneId]);
    if (['approved', 'submitted', 'under_review'].includes(m.status)) {
      throw new ApiError(409, 'locked', `Tasks cannot be added to a ${m.status.replace('_', ' ')} milestone.`);
    }
    const { rows: [t] } = await c.query(
      `INSERT INTO tasks(milestone_id, title, description, effort_hours, priority, planned_start_date,
                         planned_completion_date, due_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING task_id`,
      [milestoneId, b.title, b.description, b.effortHours, b.priority, b.plannedStartDate ?? null,
        b.plannedCompletionDate, b.dueDate ?? b.plannedCompletionDate, user.userId]);
    await c.query(`INSERT INTO task_assignments(task_id, user_id, assignment_type, assigned_by) VALUES ($1,$2,'owner',$3)`, [t.task_id, b.ownerId, user.userId]);
    for (const uid of new Set(b.collaboratorIds)) {
      if (uid === b.ownerId) continue;
      await c.query(`INSERT INTO task_assignments(task_id, user_id, assignment_type, assigned_by) VALUES ($1,$2,'collaborator',$3)`, [t.task_id, uid, user.userId]);
    }
    return t.task_id as number;
  });
  return { taskId };
}, 201);
