import { api } from '@/lib/api/route';
import { ApiError, forbidden } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { teamCandidates } from '@/lib/data/queries';

// Students who can still be added to a team in this course (used by the "add member" pickers).
export const GET = api(async (req) => {
  const user = await requireUser();
  if (!user.roles.includes('admin') && !user.roles.includes('student')) throw forbidden();
  const courseId = Number(new URL(req.url).searchParams.get('courseId'));
  if (!Number.isInteger(courseId) || courseId <= 0) throw new ApiError(400, 'bad_request', 'courseId is required.');
  return { students: await teamCandidates(courseId) };
});
