import { beforeAll, describe, expect, it } from 'vitest';
import { BASE, em, login, serverUp, type Client } from './helpers';
import { sql } from './stores';

/** ADM-01 / AUTH-06: users, roles, departments, courses, templates. Changes data (restored after a mutating run). */
const enabled = (await serverUp()) && process.env.ALLOW_MUTATING_TESTS === '1';
const d = enabled ? describe : describe.skip;

const NEW_PW = 'Temp1234x';
const rawLogin = (email: string, password: string) => fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });

d('admin setup', () => {
  let admin: Client, guide1: Client, s1: Client;
  let newUser: number;

  beforeAll(async () => { [admin, guide1, s1] = await Promise.all([login(em.admin), login(em.guide(1)), login(em.student(1))]); });

  it('only admins reach the admin API or pages', async () => {
    for (const path of ['/api/admin/users', '/api/admin/departments', '/api/admin/courses', '/api/admin/templates']) {
      expect((await guide1.get(path)).status, path).toBe(403);
      expect((await s1.get(path)).status, path).toBe(403);
    }
    expect((await guide1.raw('/admin/users')).status).toBe(404);
    expect((await admin.raw('/admin/users')).status).toBe(200);
    expect((await admin.raw('/admin/templates')).status).toBe(200);
  });

  it('create user: password policy, unique email, hash only; the new user can sign in', async () => {
    const base = { name: 'Zoya Test', email: 'zoya.test@projectpulse.test', roles: ['student'] };
    const weak = await admin.post('/api/admin/users', { ...base, password: 'short' });
    expect(weak.status).toBe(422);
    expect(weak.body.error.fields.password).toBeTruthy();
    expect((await admin.post('/api/admin/users', { ...base, password: 'Temp1234x', roles: [] })).status).toBe(422);
    const ok = await admin.post('/api/admin/users', { ...base, password: NEW_PW });
    expect(ok.status).toBe(201);
    newUser = ok.body.userId;
    const dup = await admin.post('/api/admin/users', { ...base, email: 'ZOYA.TEST@projectpulse.test', password: NEW_PW });
    expect(dup.status).toBe(409);
    expect(dup.body.error.message).toContain('already registered');                       // citext: case-insensitive unique
    const hash = (await sql(`SELECT password_hash FROM users WHERE user_id = $1`, [newUser]))[0].password_hash as string;
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
    expect(hash).not.toContain(NEW_PW);
    expect(JSON.stringify((await admin.get('/api/admin/users')).body)).not.toMatch(/password|\$2a\$/);
    expect((await rawLogin(base.email, NEW_PW)).status).toBe(200);
    // role changes are audited with the admin's id
    const audit = await sql(`SELECT user_id FROM audit_logs WHERE entity_type = 'user_roles' AND action = 'INSERT' AND entity_id = $1`, [String(newUser)]);
    expect(audit.length).toBeGreaterThan(0);
    expect(audit[0].user_id).not.toBeNull();
  });

  it('suspending an account stops it at once; admins cannot lock themselves out; password reset works', async () => {
    const victim = await login(null).then(async () => {
      const res = await rawLogin('zoya.test@projectpulse.test', NEW_PW);
      return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
    });
    const me = (cookie: string) => fetch(`${BASE}/api/auth/me`, { headers: { Cookie: cookie } }).then((r) => r.status);
    expect(await me(victim)).toBe(200);
    expect((await admin.patch(`/api/admin/users/${newUser}`, { status: 'suspended' })).status).toBe(200);
    expect(await me(victim)).toBe(401);                                                 // the open session died immediately
    expect((await rawLogin('zoya.test@projectpulse.test', NEW_PW)).status).toBe(401);
    const adminId = (await admin.get('/api/auth/me')).body.user.userId;
    expect((await admin.patch(`/api/admin/users/${adminId}`, { status: 'inactive' })).status).toBe(409);
    expect((await admin.patch(`/api/admin/users/${newUser}`, { status: 'active', newPassword: 'weak' })).status).toBe(422);
    expect((await admin.patch(`/api/admin/users/${newUser}`, { status: 'active', newPassword: 'Another99pw' })).status).toBe(200);
    expect((await rawLogin('zoya.test@projectpulse.test', NEW_PW)).status).toBe(401);   // old password is gone
    expect((await rawLogin('zoya.test@projectpulse.test', 'Another99pw')).status).toBe(200);
  });

  it('roles: add works; a role that is in use, the last role, and your own admin role cannot be removed', async () => {
    const role = (id: number, r: string, op = 'remove') => admin.post(`/api/admin/users/${id}/roles`, { role: r, op });
    expect((await role(newUser, 'reviewer', 'add')).status).toBe(200);
    expect((await role(newUser, 'reviewer')).status).toBe(200);
    const s1Id = (await s1.get('/api/auth/me')).body.user.userId, g1Id = (await guide1.get('/api/auth/me')).body.user.userId;
    const adminId = (await admin.get('/api/auth/me')).body.user.userId;
    expect((await role(s1Id, 'student')).body.error.message).toContain('in a team');
    expect((await role(g1Id, 'faculty_guide')).body.error.message).toContain('allocated');
    expect((await role(adminId, 'admin')).status).toBe(409);
    expect((await role(newUser, 'student')).body.error.code).toBe('last_role');
    expect((await role(newUser, 'nonsense')).status).toBe(422);
  });

  it('departments and courses: unique, validated, and protected while in use', async () => {
    const dept = await admin.post('/api/admin/departments', { code: 'ece', name: 'Electronics and Communication' });
    expect(dept.status).toBe(201);
    expect((await admin.post('/api/admin/departments', { code: 'ECE', name: 'Something else' })).body.error.message).toContain('code already exists');
    expect((await admin.patch(`/api/admin/departments/${dept.body.deptId}`, { code: 'ECE', name: 'Electronics and Communication Engineering' })).status).toBe(200);
    const list = (await admin.get('/api/admin/departments')).body.departments;
    expect(list.find((x: any) => x.dept_code === 'ECE').dept_name).toContain('Engineering');
    const cse = list.find((x: any) => x.dept_code === 'CSE');
    const blocked = await admin.del(`/api/admin/departments/${cse.dept_id}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.message).toContain('still referenced');                  // ON DELETE RESTRICT (23001)

    const course = { deptId: dept.body.deptId, code: 'EC-P', name: 'Embedded Mini Project', semester: 'Sem 6', academicYear: '2026-2027' };
    expect((await admin.post('/api/admin/courses', { ...course, academicYear: '2026/27' })).status).toBe(422);
    const created = await admin.post('/api/admin/courses', course);
    expect(created.status).toBe(201);
    expect((await admin.post('/api/admin/courses', course)).status).toBe(409);
    expect((await admin.patch(`/api/admin/courses/${created.body.courseId}`, { isActive: false })).status).toBe(200);
    expect((await admin.get('/api/courses')).body.courses.some((c: any) => c.course_code === 'EC-P')).toBe(false);   // archived courses are not offered
    expect((await admin.del(`/api/admin/courses/${created.body.courseId}`)).status).toBe(200);
    expect((await admin.del(`/api/admin/departments/${dept.body.deptId}`)).status).toBe(200);
    const dbms = (await admin.get('/api/courses')).body.courses.find((c: any) => c.course_code === 'CS-DBMS-P').course_id;
    expect((await admin.del(`/api/admin/courses/${dbms}`)).status).toBe(409);          // has teams
  });

  it('templates: weightage <= 100, replace milestones, deactivating hides it from teams', async () => {
    const tpl = (extra: object = {}) => ({ name: 'Quick Plan', description: 'Two steps', isActive: true, milestones: [
      { title: 'Plan', offsetDays: 7, weightage: 40, requiredDeliverableTypes: ['proposal'] }, { title: 'Deliver', offsetDays: 30, weightage: 60, requiredDeliverableTypes: ['final_report', 'presentation'] }], ...extra });
    const heavy = await admin.post('/api/admin/templates', tpl({ milestones: [{ title: 'A', offsetDays: 1, weightage: 70, requiredDeliverableTypes: [] }, { title: 'B', offsetDays: 2, weightage: 40, requiredDeliverableTypes: [] }] }));
    expect(heavy.status).toBe(422);
    expect(heavy.body.error.fields.milestones).toContain('more than 100');
    expect((await admin.post('/api/admin/templates', tpl({ milestones: [] }))).status).toBe(422);
    const ok = await admin.post('/api/admin/templates', tpl());
    expect(ok.status).toBe(201);
    expect((await admin.post('/api/admin/templates', tpl())).status).toBe(409);
    const shown = () => admin.get('/api/templates').then((r) => r.body.templates.find((t: any) => t.name === 'Quick Plan'));
    expect((await shown()).milestones).toBe(2);
    expect((await admin.patch(`/api/admin/templates/${ok.body.templateId}`, tpl({ milestones: [{ title: 'Only step', offsetDays: 20, weightage: 100, requiredDeliverableTypes: ['final_report'] }] }))).status).toBe(200);
    expect((await shown()).milestones).toBe(1);
    const rows = await sql(`SELECT title, required_deliverable_types FROM template_milestones WHERE template_id = $1`, [ok.body.templateId]);
    expect(rows).toEqual([{ title: 'Only step', required_deliverable_types: ['final_report'] }]);
    expect((await admin.patch(`/api/admin/templates/${ok.body.templateId}`, tpl({ isActive: false }))).status).toBe(200);
    expect(await shown()).toBeUndefined();
  });
});
