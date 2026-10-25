import { api, intParam, readJson } from '@/lib/api/route';
import { notFound } from '@/lib/api/errors';
import { requireAdmin } from '@/lib/auth/admin';
import { query } from '@/lib/db/pg';
import { CoursePatch } from '@/lib/validation/schemas';

export const PATCH = api<{ id: string }>(async (req, { id }) => {
  await requireAdmin();
  const b = CoursePatch.parse(await readJson(req));
  const r = await query(`UPDATE courses SET course_name = COALESCE($2, course_name), is_active = COALESCE($3, is_active) WHERE course_id = $1 RETURNING course_id`,
    [intParam(id), b.name ?? null, b.isActive ?? null]);
  if (!r.length) throw notFound('Course not found.');
  return { ok: true };
});

export const DELETE = api<{ id: string }>(async (_req, { id }) => {
  await requireAdmin();
  const r = await query(`DELETE FROM courses WHERE course_id = $1 RETURNING course_id`, [intParam(id)]);   // RESTRICT if teams exist
  if (!r.length) throw notFound('Course not found.');
  return { ok: true };
});
