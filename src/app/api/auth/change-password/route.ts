import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/db/pg';
import { ApiError, assertSameOrigin, toErrorResponse } from '@/lib/api/errors';
import { hashPassword, passwordProblem, verifyPassword } from '@/lib/auth/password';
import { requireUser } from '@/lib/auth/session';

const Body = z.object({ currentPassword: z.string().min(1), newPassword: z.string().max(200) });

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await requireUser();
    const { currentPassword, newPassword } = Body.parse(await req.json());
    const problem = passwordProblem(newPassword);
    if (problem) throw new ApiError(422, 'weak_password', problem, { newPassword: problem });

    const [row] = await query<{ password_hash: string }>(`SELECT password_hash FROM users WHERE user_id = $1`, [user.userId]);
    if (!row || !(await verifyPassword(currentPassword, row.password_hash))) {
      throw new ApiError(422, 'wrong_password', 'Current password is incorrect.', { currentPassword: 'Incorrect password.' });
    }
    await query(`UPDATE users SET password_hash = $2 WHERE user_id = $1`, [user.userId, await hashPassword(newPassword)]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
