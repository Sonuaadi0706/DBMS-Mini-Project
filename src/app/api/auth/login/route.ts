import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db/pg';
import { ApiError, assertSameOrigin, toErrorResponse } from '@/lib/api/errors';
import { dummyHash, verifyPassword } from '@/lib/auth/password';
import { setSessionCookie } from '@/lib/auth/session';
import type { RoleName } from '@/lib/auth/token';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

const Body = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) });

const INVALID = () => new ApiError(401, 'invalid_credentials', 'Invalid email or password.');

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const { email, password } = Body.parse(await req.json());

    const rows = await query<{
      user_id: number; name: string; password_hash: string; status: string;
      locked: boolean; roles: RoleName[];
    }>(
      `SELECT u.user_id, u.name, u.password_hash, u.status,
              (u.locked_until IS NOT NULL AND u.locked_until > now()) AS locked,
              COALESCE(array_agg(r.role_name ORDER BY r.role_id) FILTER (WHERE r.role_name IS NOT NULL), '{}') AS roles
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.user_id
         LEFT JOIN roles r ON r.role_id = ur.role_id
        WHERE u.email = $1
        GROUP BY u.user_id`,
      [email],
    );
    const user = rows[0];

    if (!user) {
      await verifyPassword(password, await dummyHash()); // same cost as a real check
      throw INVALID();
    }
    if (user.locked) {
      throw new ApiError(429, 'locked', `Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.`);
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok || user.status !== 'active' || user.roles.length === 0) {
      if (!ok) {
        // Atomic: count the failure and lock on the 5th, in one statement (no read-modify-write race).
        await query(
          `UPDATE users
              SET failed_login_count = CASE WHEN failed_login_count + 1 >= $2 THEN 0 ELSE failed_login_count + 1 END,
                  locked_until = CASE WHEN failed_login_count + 1 >= $2
                                      THEN now() + make_interval(mins => $3) ELSE locked_until END
            WHERE user_id = $1`,
          [user.user_id, MAX_FAILED, LOCK_MINUTES],
        );
      }
      throw INVALID();
    }

    await query(`UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = now() WHERE user_id = $1`, [user.user_id]);
    await setSessionCookie(user.user_id, user.name, user.roles, user.roles[0]);
    return NextResponse.json({ user: { id: user.user_id, name: user.name, roles: user.roles, activeRole: user.roles[0] } });
  } catch (err) {
    return toErrorResponse(err);
  }
}
