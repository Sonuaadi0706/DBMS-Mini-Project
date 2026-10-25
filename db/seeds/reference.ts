import type { PoolClient, Client } from 'pg';
import bcrypt from 'bcryptjs';

type Db = Client | PoolClient;

export interface SeedUser { email: string; name: string; roles: string[]; identifier: string }

/** ~20 demo users (spec 17.1). guide3 also holds `reviewer` to show a multi-role user. */
export function demoUsers(): SeedUser[] {
  const u: SeedUser[] = [{ email: 'admin@projectpulse.test', name: 'Asha Admin', roles: ['admin'], identifier: 'EMP-ADM-01' }];
  const guides = ['Dr. Nagasundari S', 'Prof. Meera Rao', 'Prof. Kiran Shetty'];
  guides.forEach((name, i) => u.push({
    email: `guide${i + 1}@projectpulse.test`, name,
    roles: i === 2 ? ['faculty_guide', 'reviewer'] : ['faculty_guide'], identifier: `EMP-FAC-0${i + 1}`,
  }));
  ['Prof. Anand Pai', 'Prof. Latha Kumar'].forEach((name, i) => u.push({
    email: `reviewer${i + 1}@projectpulse.test`, name, roles: ['reviewer'], identifier: `EMP-REV-0${i + 1}`,
  }));
  const students = ['Chiranthan', 'Aadish', 'Riya Nair', 'Karthik B', 'Sneha Hegde', 'Rohan D', 'Divya S',
    'Manoj K', 'Pooja R', 'Vikram T', 'Ananya M', 'Harsh P', 'Isha G', 'Tarun V'];
  students.forEach((name, i) => u.push({
    email: `student${String(i + 1).padStart(2, '0')}@projectpulse.test`, name,
    roles: ['student'], identifier: `1XX23CS${String(i + 1).padStart(3, '0')}`,
  }));
  return u;
}

export async function seedReference(db: Db): Promise<{ deptId: number; dbmsCourseId: number; seCourseId: number; templateId: number }> {
  const { rows: [d] } = await db.query(
    `INSERT INTO departments(dept_code, dept_name) VALUES ('CSE','Computer Science and Engineering') RETURNING dept_id`);
  const { rows: courses } = await db.query(
    `INSERT INTO courses(dept_id, course_code, course_name, semester, academic_year) VALUES
       ($1,'CS-DBMS-P','DBMS Mini Project','Sem 5','2026-2027'),
       ($1,'CS-SE-P','Software Engineering Mini Project','Sem 5','2026-2027') RETURNING course_id, course_code`, [d.dept_id]);
  const { rows: [t] } = await db.query(
    `INSERT INTO project_templates(course_id, name, description)
     VALUES ($1,'Standard Mini-Project Plan','Five-milestone plan used by most mini projects') RETURNING template_id`,
    [courses.find((c) => c.course_code === 'CS-DBMS-P').course_id]);
  const steps: [number, string, number, number, string[]][] = [
    [1, 'Proposal approval', 14, 10, ['proposal']],
    [2, 'Requirements (SRS)', 35, 20, ['srs']],
    [3, 'Design (ER + schema)', 60, 25, ['design_doc']],
    [4, 'Implementation and testing', 85, 25, ['source_code', 'screenshot', 'test_report']],
    [5, 'Final report and demo', 100, 20, ['final_report', 'presentation']],
  ];
  for (const [seq, title, offset, weight, req] of steps) {
    await db.query(
      `INSERT INTO template_milestones(template_id, sequence_no, title, offset_days, weightage, required_deliverable_types)
       VALUES ($1,$2,$3,$4,$5,$6)`, [t.template_id, seq, title, offset, weight, req]);
  }
  return {
    deptId: d.dept_id,
    dbmsCourseId: courses.find((c) => c.course_code === 'CS-DBMS-P').course_id,
    seCourseId: courses.find((c) => c.course_code === 'CS-SE-P').course_id,
    templateId: t.template_id,
  };
}

/** Inserts users + roles. Password comes from SEED_DEFAULT_PASSWORD and is stored only as a bcrypt hash. */
export async function seedUsers(
  db: Db, deptId: number, password: string, onProgress?: () => void,
): Promise<Map<string, number>> {
  const ids = new Map<string, number>();
  for (const u of demoUsers()) {
    const hash = await bcrypt.hash(password, 12);
    const { rows: [row] } = await db.query(
      `INSERT INTO users(name, email, password_hash, dept_id, identifier) VALUES ($1,$2,$3,$4,$5) RETURNING user_id`,
      [u.name, u.email, hash, deptId, u.identifier]);
    await db.query(
      `INSERT INTO user_roles(user_id, role_id) SELECT $1, role_id FROM roles WHERE role_name = ANY($2)`,
      [row.user_id, u.roles]);
    ids.set(u.email, row.user_id);
    onProgress?.();
  }
  return ids;
}
