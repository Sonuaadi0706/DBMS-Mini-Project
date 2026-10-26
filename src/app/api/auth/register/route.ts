import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError, assertSameOrigin, toErrorResponse } from '@/lib/api/errors';
import { hashPassword, passwordProblem } from '@/lib/auth/password';
import { setSessionCookie } from '@/lib/auth/session';
import { withTransaction } from '@/lib/db/pg';
import { readJson } from '@/lib/api/route';

// Self-service sign-up. It can only ever create a STUDENT: guides, reviewers and admins are created by an administrator
// (Admin, Users), so nobody can give themselves staff access. Duplicate e-mail / USN are caught by the unique indexes.
const Body = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(254),
  identifier: z.string().trim().max(30).optional().nullable(),
  password: z.string().max(200),
});

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const b = Body.parse(await readJson(req));
    const problem = passwordProblem(b.password);
    if (problem) throw new ApiError(422, 'weak_password', problem, { password: problem });
    const hash = await hashPassword(b.password);
    const userId = await withTransaction(null, async (c) => {
      const { rows: [u] } = await c.query(
        `INSERT INTO users(name, email, password_hash, identifier) VALUES ($1,$2,$3,$4) RETURNING user_id`,
        [b.name, b.email, hash, b.identifier || null]);
      await c.query(`INSERT INTO user_roles(user_id, role_id) SELECT $1, role_id FROM roles WHERE role_name = 'student'`, [u.user_id]);
      return u.user_id as number;
    });
    await setSessionCookie(userId, b.name, ['student'], 'student');
    return NextResponse.json({ user: { id: userId, name: b.name, roles: ['student'], activeRole: 'student' } }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
