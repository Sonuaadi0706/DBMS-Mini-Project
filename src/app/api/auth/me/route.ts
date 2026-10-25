import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/api/errors';
import { requireUser, setSessionCookie } from '@/lib/auth/session';
import { z } from 'zod';
import { assertSameOrigin, forbidden } from '@/lib/api/errors';

export async function GET() {
  try {
    const u = await requireUser();
    return NextResponse.json({ user: u });
  } catch (err) {
    return toErrorResponse(err);
  }
}

// Role switcher: a user holding several roles picks which dashboard to act as.
export async function PATCH(req: Request) {
  try {
    assertSameOrigin(req);
    const u = await requireUser();
    const { activeRole } = z.object({ activeRole: z.enum(['student', 'faculty_guide', 'reviewer', 'admin']) }).parse(await req.json());
    if (!u.roles.includes(activeRole)) throw forbidden('You do not hold that role.');
    await setSessionCookie(u.userId, u.name, u.roles, activeRole);
    return NextResponse.json({ user: { ...u, activeRole } });
  } catch (err) {
    return toErrorResponse(err);
  }
}
