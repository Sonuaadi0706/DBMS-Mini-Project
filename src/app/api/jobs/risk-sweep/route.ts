import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { api } from '@/lib/api/route';
import { ApiError, forbidden } from '@/lib/api/errors';
import { getCurrentUser } from '@/lib/auth/session';
import { query } from '@/lib/db/pg';

function secretMatches(given: string | null): boolean {
  const expected = process.env.JOB_SECRET;
  if (!given || !expected) return false;
  const a = Buffer.from(given); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Risk sweep: flag overdue milestones, then store a fresh risk snapshot for every running project.
 * No external cron is needed: an admin presses a button, or a script / scheduler calls this with the
 * `x-job-secret` header. (The middleware lets this path through; THIS handler does the authorisation.)
 */
export const POST = api(async (req) => {
  const bySecret = secretMatches(req.headers.get('x-job-secret'));
  if (!bySecret) {
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, 'unauthorized', 'Provide the job secret or sign in as an admin.');
    if (!user.roles.includes('admin')) throw forbidden('Only an admin can run the risk sweep.');
  }
  const [{ flagged }] = await query<{ flagged: number }>(`SELECT fn_flag_overdue_milestones() AS flagged`);
  const ids = await query<{ project_id: number }>(`SELECT project_id FROM projects WHERE status IN ('approved','in_progress') ORDER BY project_id`);
  for (const { project_id } of ids) await query(`CALL sp_recalculate_risk($1)`, [project_id]);
  return NextResponse.json({ projects: ids.length, newOverdueFlags: flagged });
});
