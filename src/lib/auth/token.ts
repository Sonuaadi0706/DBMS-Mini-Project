// Edge-safe (used by middleware): only `jose`, no Node-only imports.
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'pp_session';
export type RoleName = 'student' | 'faculty_guide' | 'reviewer' | 'admin';

export interface SessionClaims {
  sub: string;            // user_id
  name: string;
  roles: RoleName[];
  activeRole: RoleName;
}

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error('AUTH_SECRET is missing or too short');
  return new TextEncoder().encode(s);
}

export function sessionMaxAgeSeconds(): number {
  return Math.round(Number(process.env.SESSION_MAX_AGE_HOURS ?? 8) * 3600);
}

export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ name: claims.name, roles: claims.roles, activeRole: claims.activeRole })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${sessionMaxAgeSeconds()}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      name: String(payload.name ?? ''),
      roles: (payload.roles as RoleName[]) ?? [],
      activeRole: payload.activeRole as RoleName,
    };
  } catch {
    return null; // expired or tampered
  }
}
