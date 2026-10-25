import { api } from '@/lib/api/route';
import { requireUser } from '@/lib/auth/session';
import { listCourses } from '@/lib/data/queries';

export const GET = api(async () => {
  await requireUser();
  return { courses: await listCourses() };
});
