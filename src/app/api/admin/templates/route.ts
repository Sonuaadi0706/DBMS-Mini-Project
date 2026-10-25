import { api, readJson } from '@/lib/api/route';
import { requireAdmin } from '@/lib/auth/admin';
import { withTransaction } from '@/lib/db/pg';
import { listAdminTemplates } from '@/lib/data/admin';
import { TemplateBody } from '@/lib/validation/schemas';

export const GET = api(async () => { await requireAdmin(); return { templates: await listAdminTemplates() }; });

// A template and all of its milestones are created together or not at all.
export const POST = api(async (req) => {
  const admin = await requireAdmin();
  const b = TemplateBody.parse(await readJson(req));
  const id = await withTransaction(admin.userId, async (c) => {
    const { rows: [t] } = await c.query(
      `INSERT INTO project_templates(course_id, name, description, is_active, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING template_id`,
      [b.courseId ?? null, b.name, b.description || null, b.isActive, admin.userId]);
    for (const [i, m] of b.milestones.entries()) {
      await c.query(`INSERT INTO template_milestones(template_id, sequence_no, title, offset_days, weightage, required_deliverable_types) VALUES ($1,$2,$3,$4,$5,$6)`,
        [t.template_id, i + 1, m.title, m.offsetDays, m.weightage, m.requiredDeliverableTypes]);
    }
    return t.template_id as number;
  });
  return { templateId: id };
}, 201);
