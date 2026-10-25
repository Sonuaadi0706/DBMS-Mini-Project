import { api, intParam, readJson } from '@/lib/api/route';
import { notFound } from '@/lib/api/errors';
import { requireAdmin } from '@/lib/auth/admin';
import { withTransaction } from '@/lib/db/pg';
import { TemplateBody } from '@/lib/validation/schemas';

// Replaces the template's details and milestone list. Projects already built from it keep their own milestones
// (applying a template copies it), so editing a template never changes running projects.
export const PATCH = api<{ id: string }>(async (req, { id }) => {
  const admin = await requireAdmin();
  const templateId = intParam(id);
  const b = TemplateBody.parse(await readJson(req));
  await withTransaction(admin.userId, async (c) => {
    const r = await c.query(`UPDATE project_templates SET name = $2, description = $3, course_id = $4, is_active = $5 WHERE template_id = $1`,
      [templateId, b.name, b.description || null, b.courseId ?? null, b.isActive]);
    if (!r.rowCount) throw notFound('Template not found.');
    await c.query(`DELETE FROM template_milestones WHERE template_id = $1`, [templateId]);
    for (const [i, m] of b.milestones.entries()) {
      await c.query(`INSERT INTO template_milestones(template_id, sequence_no, title, offset_days, weightage, required_deliverable_types) VALUES ($1,$2,$3,$4,$5,$6)`,
        [templateId, i + 1, m.title, m.offsetDays, m.weightage, m.requiredDeliverableTypes]);
    }
  });
  return { ok: true };
});
