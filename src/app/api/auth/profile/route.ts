import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withTransaction } from '@/lib/db/pg';
import { assertSameOrigin, toErrorResponse } from '@/lib/api/errors';
import { requireUser, setSessionCookie } from '@/lib/auth/session';

// A user may change only their own display name. E-mail, roles and status are administrator-only.
const Body = z.object({ name: z.string().trim().min(2, 'Name is too short').max(120) });

export async function PATCH(req: Request) {
  try {
    assertSameOrigin(req);
    const u = await requireUser();
    const { name } = Body.parse(await req.json());
    await withTransaction(u.userId, (c) => c.query(`UPDATE users SET name = $2 WHERE user_id = $1`, [u.userId, name]));
    await setSessionCookie(u.userId, name, u.roles, u.activeRole);
    return NextResponse.json({ user: { ...u, name } });
  } catch (err) {
    return toErrorResponse(err);
  }
}
