import { query } from '@/lib/db/pg';

export interface AdminUser {
  user_id: number; name: string; email: string; status: string; identifier: string | null; dept_name: string | null; dept_id: number | null;
  roles: string[]; last_login_at: string | null; locked: boolean;
}

export const listUsers = () => query<AdminUser>(
  `SELECT u.user_id, u.name, u.email::text AS email, u.status, u.identifier, d.dept_name, u.dept_id, u.last_login_at,
          (u.locked_until IS NOT NULL AND u.locked_until > now()) AS locked,
          COALESCE(array_agg(r.role_name ORDER BY r.role_id) FILTER (WHERE r.role_name IS NOT NULL), '{}') AS roles
     FROM users u LEFT JOIN departments d ON d.dept_id = u.dept_id
     LEFT JOIN user_roles ur ON ur.user_id = u.user_id LEFT JOIN roles r ON r.role_id = ur.role_id
    GROUP BY u.user_id, d.dept_name ORDER BY u.name`);

export const listDepartments = () => query<{ dept_id: number; dept_code: string; dept_name: string; courses: number; users: number }>(
  `SELECT d.dept_id, d.dept_code, d.dept_name, (SELECT COUNT(*)::int FROM courses c WHERE c.dept_id = d.dept_id) AS courses,
          (SELECT COUNT(*)::int FROM users u WHERE u.dept_id = d.dept_id) AS users FROM departments d ORDER BY d.dept_code`);

export const listAdminCourses = () => query<{ course_id: number; dept_id: number; dept_code: string; course_code: string; course_name: string; semester: string; academic_year: string; is_active: boolean; teams: number }>(
  `SELECT c.course_id, c.dept_id, d.dept_code, c.course_code, c.course_name, c.semester, c.academic_year, c.is_active,
          (SELECT COUNT(*)::int FROM teams t WHERE t.course_id = c.course_id) AS teams
     FROM courses c JOIN departments d ON d.dept_id = c.dept_id ORDER BY c.academic_year DESC, c.course_name`);

export interface AdminTemplate {
  template_id: number; name: string; description: string | null; is_active: boolean; course_id: number | null; used_by: number;
  milestones: { title: string; offsetDays: number; weightage: number; requiredDeliverableTypes: string[] }[];
}

export const listAdminTemplates = () => query<AdminTemplate>(
  `SELECT t.template_id, t.name, t.description, t.is_active, t.course_id,
          (SELECT COUNT(*)::int FROM projects p WHERE p.template_id = t.template_id) AS used_by,
          COALESCE((SELECT json_agg(json_build_object('title', m.title, 'offsetDays', m.offset_days, 'weightage', m.weightage::float,
                      'requiredDeliverableTypes', m.required_deliverable_types) ORDER BY m.sequence_no)
                      FROM template_milestones m WHERE m.template_id = t.template_id), '[]') AS milestones
     FROM project_templates t ORDER BY t.name`);
