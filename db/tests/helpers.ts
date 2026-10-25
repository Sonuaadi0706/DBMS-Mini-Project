import { Client } from 'pg';
import { adminDatabaseUrl } from '../../scripts/lib/env';

/** Every test runs inside BEGIN ... ROLLBACK so the database is never changed by the suite. */
export async function openTx(): Promise<Client> {
  const c = new Client({ connectionString: adminDatabaseUrl() });
  await c.connect();
  await c.query('BEGIN');
  await c.query('SET search_path = projectpulse, public');
  return c;
}

export async function closeTx(c: Client): Promise<void> {
  await c.query('ROLLBACK');
  await c.end();
}

/** Run a statement that must fail; roll back to a savepoint so the test transaction survives. */
export async function expectDbError(
  c: Client,
  sql: string,
  params: unknown[] = [],
  messagePart?: string,
): Promise<{ code?: string; message: string }> {
  await c.query('SAVEPOINT expect_fail');
  try {
    await c.query(sql, params);
  } catch (e) {
    await c.query('ROLLBACK TO SAVEPOINT expect_fail');
    const err = e as { code?: string; message: string };
    if (messagePart && !err.message.includes(messagePart)) {
      throw new Error(`Expected error containing "${messagePart}" but got: ${err.message}`);
    }
    return err;
  }
  await c.query('RELEASE SAVEPOINT expect_fail');
  throw new Error(`Expected statement to fail but it succeeded: ${sql}`);
}

async function one<T = number>(c: Client, sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await c.query(sql, params);
  return Object.values(rows[0])[0] as T;
}

export interface Fixture {
  deptId: number; courseId: number;
  admin: number; guide: number; reviewer: number; s1: number; s2: number; s3: number;
  teamId: number; projectId: number;
}

async function mkUser(c: Client, name: string, role: string): Promise<number> {
  const id = await one<number>(c,
    `INSERT INTO users(name, email, password_hash) VALUES ($1, $2, 'bcrypt-hash-placeholder') RETURNING user_id`,
    [name, `${name.toLowerCase().replace(/\s/g, '.')}.${Math.random().toString(36).slice(2, 7)}@t.test`]);
  await c.query(
    `INSERT INTO user_roles(user_id, role_id) SELECT $1, role_id FROM roles WHERE role_name = $2`, [id, role]);
  return id;
}

/** Minimal world: 1 course, 3 students (2 in the team), guide, reviewer, admin, approved project. */
export async function buildFixture(c: Client): Promise<Fixture> {
  const deptId = await one<number>(c, `INSERT INTO departments(dept_code, dept_name) VALUES ('T'||floor(random()*1e6)::int, 'Test Dept '||random()) RETURNING dept_id`);
  const courseId = await one<number>(c,
    `INSERT INTO courses(dept_id, course_code, course_name, semester, academic_year)
     VALUES ($1, 'TC-'||floor(random()*1e6)::int, 'Test Course', 'Sem 5', '2026-2027') RETURNING course_id`, [deptId]);
  const admin = await mkUser(c, 'Ada Admin', 'admin');
  const guide = await mkUser(c, 'Gita Guide', 'faculty_guide');
  const reviewer = await mkUser(c, 'Ravi Reviewer', 'reviewer');
  const s1 = await mkUser(c, 'Sam One', 'student');
  const s2 = await mkUser(c, 'Sia Two', 'student');
  const s3 = await mkUser(c, 'Sol Three', 'student');
  const teamId = await one<number>(c,
    `INSERT INTO teams(course_id, team_name, created_by) VALUES ($1, 'Team T', $2) RETURNING team_id`, [courseId, s1]);
  await c.query(`INSERT INTO team_members(team_id, course_id, user_id, member_role) VALUES ($1,$2,$3,'leader'), ($1,$2,$4,'member')`,
    [teamId, courseId, s1, s2]);
  const projectId = await one<number>(c,
    `INSERT INTO projects(team_id, course_id, title, abstract, problem_statement, objectives, scope, domain,
                          status, start_date, created_by)
     VALUES ($1, $2, 'Test Project Alpha',
             'An abstract that is comfortably longer than fifty characters for the check.',
             'A problem statement longer than thirty characters.', 'Objectives', 'Scope', 'EdTech',
             'in_progress', CURRENT_DATE - 60, $3) RETURNING project_id`, [teamId, courseId, s1]);
  await c.query(`INSERT INTO guide_allocations(project_id, user_id, allocation_role) VALUES ($1,$2,'guide')`, [projectId, guide]);
  return { deptId, courseId, admin, guide, reviewer, s1, s2, s3, teamId, projectId };
}

export async function addMilestone(c: Client, projectId: number, seq: number, opts: {
  dueOffset: number; status?: string; weightage?: number; required?: string[];
}): Promise<number> {
  const id = await one<number>(c,
    `INSERT INTO milestones(project_id, sequence_no, title, due_date, status, weightage)
     VALUES ($1, $2, $3, CURRENT_DATE + $4::int, 'planned', $5) RETURNING milestone_id`,
    [projectId, seq, `Milestone ${seq}`, opts.dueOffset, opts.weightage ?? 20]);
  for (const t of opts.required ?? []) {
    await c.query(`INSERT INTO milestone_required_deliverables(milestone_id, deliverable_type) VALUES ($1,$2)`, [id, t]);
  }
  return id;
}

export async function addTask(c: Client, milestoneId: number, o: {
  dueOffset: number; effort?: number; owner?: number; status?: string; createdBy?: number;
}): Promise<number> {
  const id = await one<number>(c,
    `INSERT INTO tasks(milestone_id, title, effort_hours, planned_completion_date, due_date)
     VALUES ($1, 'Task '||random(), $2, CURRENT_DATE + $3::int, CURRENT_DATE + $3::int) RETURNING task_id`,
    [milestoneId, o.effort ?? 4, o.dueOffset]);
  if (o.owner) {
    await c.query(`INSERT INTO task_assignments(task_id, user_id, assignment_type) VALUES ($1,$2,'owner')`, [id, o.owner]);
  }
  return id;
}

/** Walk a task along legal transitions (todo -> in_progress -> done [-> verified]). */
export async function advanceTask(c: Client, taskId: number, to: 'in_progress' | 'done' | 'verified', verifier?: number) {
  await c.query(`UPDATE tasks SET status = 'in_progress' WHERE task_id = $1 AND status = 'todo'`, [taskId]);
  if (to === 'in_progress') return;
  await c.query(`UPDATE tasks SET status = 'done' WHERE task_id = $1 AND status = 'in_progress'`, [taskId]);
  if (to === 'done') return;
  await c.query(`UPDATE tasks SET status = 'verified', verified_by = $2, verified_at = now() WHERE task_id = $1`, [taskId, verifier]);
}

export { one };
