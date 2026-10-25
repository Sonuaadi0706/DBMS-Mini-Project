import { api, intParam, readJson } from '@/lib/api/route';
import { ApiError } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { requirePlanEditor } from '@/lib/auth/access';
import { assertPlannable, startProjectIfApproved } from '@/lib/auth/plan';
import { withTransaction } from '@/lib/db/pg';
import { ApplyTemplate } from '@/lib/validation/schemas';
import { refreshRiskSafely } from '@/lib/risk';

// Milestones + their mandatory deliverable types are created together or not at all.
export const POST = api<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const projectId = intParam(id);
  const access = await requirePlanEditor(user, projectId);
  assertPlannable(access);
  const b = ApplyTemplate.parse(await readJson(req));
  const count = await withTransaction(user.userId, async (c) => {
    const { rows: [existing] } = await c.query(`SELECT COUNT(*)::int AS n FROM milestones WHERE project_id = $1`, [projectId]);
    if (existing.n > 0) throw new ApiError(409, 'has_milestones', 'This project already has milestones. Edit them instead.');
    const { rows: [tpl] } = await c.query(`SELECT 1 FROM project_templates WHERE template_id = $1 AND is_active`, [b.templateId]);
    if (!tpl) throw new ApiError(404, 'not_found', 'Template not found.');
    await startProjectIfApproved(c, projectId);
    // Due dates are counted from the chosen start date (default: the project's start date, else today).
    await c.query(
      `UPDATE projects SET template_id = $2, start_date = COALESCE($3::date, start_date, CURRENT_DATE) WHERE project_id = $1`,
      [projectId, b.templateId, b.startDate ?? null]);
    const ins = await c.query(
      `INSERT INTO milestones(project_id, sequence_no, title, due_date, weightage)
       SELECT p.project_id, tm.sequence_no, tm.title, p.start_date + tm.offset_days, tm.weightage
         FROM projects p JOIN template_milestones tm ON tm.template_id = $2 WHERE p.project_id = $1`,
      [projectId, b.templateId]);
    await c.query(
      `INSERT INTO milestone_required_deliverables(milestone_id, deliverable_type)
       SELECT m.milestone_id, unnest(tm.required_deliverable_types)
         FROM milestones m JOIN template_milestones tm ON tm.sequence_no = m.sequence_no AND tm.template_id = $2
        WHERE m.project_id = $1`, [projectId, b.templateId]);
    return ins.rowCount ?? 0;
  });
  await refreshRiskSafely(projectId);
  return { milestonesCreated: count };
}, 201);
