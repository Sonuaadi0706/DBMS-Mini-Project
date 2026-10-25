import { cookies } from 'next/headers';
import { query } from '@/lib/db/pg';
import { forbidden, unauthorized } from '@/lib/api/errors';
import { SESSION_COOKIE, sessionMaxAgeSeconds, signSession, verifySession, type RoleName } from './token';

export interface CurrentUser {
  userId: number;
  name: string;
  email: string;
  roles: RoleName[];
  activeRole: RoleName;
}

export async function setSessionCookie(userId: number, name: string, roles: RoleName[], activeRole: RoleName) {
  const token = await signSession({ sub: String(userId), name, roles, activeRole });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: sessionMaxAgeSeconds(),
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * The signed cookie says who the user claims to be; the database says whether that is still true.
 * Roles and account status are re-read on every call so a suspended user or a revoked role takes
 * effect immediately instead of when the token expires.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const claims = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const userId = Number(claims.sub);
  const rows = await query<{ name: string; email: string; status: string; roles: RoleName[] }>(
    `SELECT u.name, u.email::text AS email, u.status,
            COALESCE(array_agg(r.role_name) FILTER (WHERE r.role_name IS NOT NULL), '{}') AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.user_id
       LEFT JOIN roles r ON r.role_id = ur.role_id
      WHERE u.user_id = $1
      GROUP BY u.user_id`,
    [userId],
  );
  const u = rows[0];
  if (!u || u.status !== 'active' || u.roles.length === 0) return null;
  const activeRole = u.roles.includes(claims.activeRole) ? claims.activeRole : u.roles[0];
  return { userId, name: u.name, email: u.email, roles: u.roles, activeRole };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}

/** Role gate for Route Handlers. Ownership checks (team / assigned guide) are layered on top per route. */
export async function requireRole(...allowed: RoleName[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.roles.some((r) => allowed.includes(r))) throw forbidden();
  return user;
}
