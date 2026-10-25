import { api, readJson } from '@/lib/api/route';
import { requireAdmin } from '@/lib/auth/admin';
import { query } from '@/lib/db/pg';
import { listAdminCourses } from '@/lib/data/admin';
import { CourseBody } from '@/lib/validation/schemas';

export const GET = api(async () => { await requireAdmin(); return { courses: await listAdminCourses() }; });
export const POST = api(async (req) => {
  await requireAdmin();
  const b = CourseBody.parse(await readJson(req));
  const [c] = await query<{ course_id: number }>(
    `INSERT INTO courses(dept_id, course_code, course_name, semester, academic_year) VALUES ($1,$2,$3,$4,$5) RETURNING course_id`,
    [b.deptId, b.code, b.name, b.semester, b.academicYear]);
  return { courseId: c.course_id };
}, 201);
