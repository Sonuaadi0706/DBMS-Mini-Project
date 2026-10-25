import { api, readJson } from '@/lib/api/route';
import { ApiError } from '@/lib/api/errors';
import { requireAdmin } from '@/lib/auth/admin';
import { hashPassword, passwordProblem } from '@/lib/auth/password';
import { withTransaction } from '@/lib/db/pg';
import { listUsers } from '@/lib/data/admin';
import { UserCreate } from '@/lib/validation/schemas';

export const GET = api(async () => { await requireAdmin(); return { users: await listUsers() }; });

// Admin creates an account. The password is stored only as a bcrypt hash and is never returned.
export const POST = api(async (req) => {
  const admin = await requireAdmin();
  const b = UserCreate.parse(await readJson(req));
  const problem = passwordProblem(b.password);
  if (problem) throw new ApiError(422, 'weak_password', problem, { password: problem });
  const hash = await hashPassword(b.password);
  const userId = await withTransaction(admin.userId, async (c) => {
    const { rows: [u] } = await c.query(
      `INSERT INTO users(name, email, password_hash, dept_id, identifier) VALUES ($1,$2,$3,$4,$5) RETURNING user_id`,
      [b.name, b.email, hash, b.deptId ?? null, b.identifier || null]);
    await c.query(`INSERT INTO user_roles(user_id, role_id, assigned_by) SELECT $1, role_id, $3 FROM roles WHERE role_name = ANY($2::text[])`, [u.user_id, b.roles, admin.userId]);
    return u.user_id as number;
  });
  return { userId };
}, 201);
