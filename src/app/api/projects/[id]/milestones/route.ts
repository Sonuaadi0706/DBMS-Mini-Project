import { api, intParam, readJson } from '@/lib/api/route';
import { requireUser } from '@/lib/auth/session';
import { requirePlanEditor, requireProjectParticipant } from '@/lib/auth/access';
import { assertPlannable, startProjectIfApproved } from '@/lib/auth/plan';
import { withTransaction } from '@/lib/db/pg';
import { listMilestones } from '@/lib/data/queries';
import { MilestoneCreate } from '@/lib/validation/schemas';
import { refreshRiskSafely } from '@/lib/risk';

export const GET = api<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser();
  const projectId = intParam(id);
  await requireProjectParticipant(user, projectId);
  return { milestones: await listMilestones(projectId) };
});

export const POST = api<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const projectId = intParam(id);
  const access = await requirePlanEditor(user, projectId);
  assertPlannable(access);
  const b = MilestoneCreate.parse(await readJson(req));
  const milestoneId = await withTransaction(user.userId, async (c) => {
    await startProjectIfApproved(c, projectId);
    const { rows: [m] } = await c.query(
      `INSERT INTO milestones(project_id, sequence_no, title, description, start_date, due_date, weightage)
       VALUES ($1, (SELECT COALESCE(MAX(sequence_no), 0) + 1 FROM milestones WHERE project_id = $1), $2,$3,$4,$5,$6)
       RETURNING milestone_id`,
      [projectId, b.title, b.description, b.startDate ?? null, b.dueDate, b.weightage]);
    for (const t of new Set(b.requiredDeliverables)) {
      await c.query(`INSERT INTO milestone_required_deliverables(milestone_id, deliverable_type) VALUES ($1,$2)`, [m.milestone_id, t]);
    }
    return m.milestone_id as number;
  }); // the "total weightage <= 100" constraint trigger is checked here, at COMMIT
  await refreshRiskSafely(projectId);
  return { milestoneId };
}, 201);
