import { api, intParam, readJson } from '@/lib/api/route';
import { ApiError, notFound } from '@/lib/api/errors';
import { requireAdmin } from '@/lib/auth/admin';
import { hashPassword, passwordProblem } from '@/lib/auth/password';
import { withTransaction } from '@/lib/db/pg';
import { UserPatch } from '@/lib/validation/schemas';

// Edit a profile, suspend / deactivate an account (AUTH-06), or reset a password. Changes take effect at once:
// every request re-reads the account status, so a suspended user's open session stops working immediately.
export const PATCH = api<{ id: string }>(async (req, { id }) => {
  const admin = await requireAdmin();
  const userId = intParam(id);
  const b = UserPatch.parse(await readJson(req));
  if (userId === admin.userId && b.status && b.status !== 'active') throw new ApiError(409, 'self', 'You cannot deactivate your own account.');
  const sets: string[] = []; const values: unknown[] = [userId];
  const add = (col: string, v: unknown) => { values.push(v); sets.push(`${col} = $${values.length}`); };
  let clearLock = false;                       // reactivating or resetting the password also clears the lockout (once)
  if (b.name !== undefined) add('name', b.name);
  if (b.status !== undefined) { add('status', b.status); if (b.status === 'active') clearLock = true; }
  if (b.deptId !== undefined) add('dept_id', b.deptId);
  if (b.identifier !== undefined) add('identifier', b.identifier || null);
  if (b.newPassword !== undefined) {
    const problem = passwordProblem(b.newPassword);
    if (problem) throw new ApiError(422, 'weak_password', problem, { newPassword: problem });
    add('password_hash', await hashPassword(b.newPassword));
    clearLock = true;
  }
  if (clearLock) sets.push('failed_login_count = 0', 'locked_until = NULL');
  if (!sets.length) return { ok: true };
  const res = await withTransaction(admin.userId, (c) => c.query(`UPDATE users SET ${sets.join(', ')} WHERE user_id = $1`, values));
  if (!res.rowCount) throw notFound('User not found.');
  return { ok: true };
});
