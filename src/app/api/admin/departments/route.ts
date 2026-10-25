import { api, readJson } from '@/lib/api/route';
import { requireAdmin } from '@/lib/auth/admin';
import { query } from '@/lib/db/pg';
import { listDepartments } from '@/lib/data/admin';
import { DepartmentBody } from '@/lib/validation/schemas';

export const GET = api(async () => { await requireAdmin(); return { departments: await listDepartments() }; });
export const POST = api(async (req) => {
  await requireAdmin();
  const b = DepartmentBody.parse(await readJson(req));
  const [d] = await query<{ dept_id: number }>(`INSERT INTO departments(dept_code, dept_name) VALUES ($1,$2) RETURNING dept_id`, [b.code, b.name]);
  return { deptId: d.dept_id };
}, 201);
