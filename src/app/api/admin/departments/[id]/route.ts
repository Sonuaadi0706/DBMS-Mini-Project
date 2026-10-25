import { api, intParam, readJson } from '@/lib/api/route';
import { notFound } from '@/lib/api/errors';
import { requireAdmin } from '@/lib/auth/admin';
import { query } from '@/lib/db/pg';
import { DepartmentBody } from '@/lib/validation/schemas';

export const PATCH = api<{ id: string }>(async (req, { id }) => {
  await requireAdmin();
  const b = DepartmentBody.parse(await readJson(req));
  const r = await query(`UPDATE departments SET dept_code = $2, dept_name = $3 WHERE dept_id = $1 RETURNING dept_id`, [intParam(id), b.code, b.name]);
  if (!r.length) throw notFound('Department not found.');
  return { ok: true };
});

// ON DELETE RESTRICT: a department that still has courses cannot be removed (the API turns that into a friendly 409).
export const DELETE = api<{ id: string }>(async (_req, { id }) => {
  await requireAdmin();
  const r = await query(`DELETE FROM departments WHERE dept_id = $1 RETURNING dept_id`, [intParam(id)]);
  if (!r.length) throw notFound('Department not found.');
  return { ok: true };
});
