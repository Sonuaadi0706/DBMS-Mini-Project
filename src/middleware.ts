import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/auth/token';

// Everything is protected except the login / sign-up pages and their endpoints.
// Role and ownership checks happen again inside each Route Handler; this only gates anonymous users.
const PUBLIC = ['/login', '/register', '/api/auth/login', '/api/auth/register'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p)) return NextResponse.next();

  const claims = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (claims) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    // Risk-sweep may also be called by a script holding JOB_SECRET; that route checks the secret itself.
    if (pathname === '/api/jobs/risk-sweep') return NextResponse.next();
    return NextResponse.json({ error: { code: 'unauthorized', message: 'Please sign in.' } }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
