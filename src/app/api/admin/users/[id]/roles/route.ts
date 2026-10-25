import { api, intParam, readJson } from '@/lib/api/route';
import { ApiError } from '@/lib/api/errors';
import { requireAdmin } from '@/lib/auth/admin';
import { withTransaction } from '@/lib/db/pg';
import { RoleChange } from '@/lib/validation/schemas';

/**
 * Add or remove one role. A role still in use cannot be removed: a student who is in a team, or a guide / reviewer
 * who is allocated to a project, would otherwise be left in a state the database rules forbid.
 */
export const POST = api<{ id: string }>(async (req, { id }) => {
  const admin = await requireAdmin();
  const userId = intParam(id);
  const { role, op } = RoleChange.parse(await readJson(req));
  await withTransaction(admin.userId, async (c) => {
    const { rows: [u] } = await c.query(`SELECT 1 FROM users WHERE user_id = $1 FOR UPDATE`, [userId]);
    if (!u) throw new ApiError(404, 'not_found', 'User not found.');
    if (op === 'add') {
      await c.query(`INSERT INTO user_roles(user_id, role_id, assigned_by) SELECT $1, role_id, $3 FROM roles WHERE role_name = $2 ON CONFLICT DO NOTHING`, [userId, role, admin.userId]);
      return;
    }
    if (userId === admin.userId && role === 'admin') throw new ApiError(409, 'self', 'You cannot remove your own admin role.');
    if (role === 'student') {
      const { rows } = await c.query(`SELECT 1 FROM team_members WHERE user_id = $1`, [userId]);
      if (rows.length) throw new ApiError(409, 'in_use', 'This student is in a team. Remove them from the team first.');
    }
    if (role === 'faculty_guide' || role === 'reviewer') {
      const { rows } = await c.query(`SELECT 1 FROM guide_allocations WHERE user_id = $1 AND allocation_role = $2`, [userId, role === 'faculty_guide' ? 'guide' : 'reviewer']);
      if (rows.length) throw new ApiError(409, 'in_use', 'They are allocated to a project in this role. Remove the allocation first.');
    }
    const { rows: left } = await c.query(`SELECT COUNT(*)::int AS n FROM user_roles WHERE user_id = $1`, [userId]);
    if (left[0].n <= 1) throw new ApiError(409, 'last_role', 'A user must keep at least one role. Deactivate the account instead.');
    await c.query(`DELETE FROM user_roles WHERE user_id = $1 AND role_id = (SELECT role_id FROM roles WHERE role_name = $2)`, [userId, role]);
  });
  return { ok: true };
});
