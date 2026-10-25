import { NextResponse } from 'next/server';
import { assertSameOrigin, toErrorResponse } from '@/lib/api/errors';
import { clearSessionCookie } from '@/lib/auth/session';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
