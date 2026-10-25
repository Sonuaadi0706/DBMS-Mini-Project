import { api } from '@/lib/api/route';
import { forbidden } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { scopeDocStats } from '@/lib/docs/stats';

// A2 (document types), A4 (feedback themes) and A5 (tags) across the projects a faculty member oversees.
export const GET = api(async () => {
  const user = await requireUser();
  if (!user.roles.some((r) => ['faculty_guide', 'reviewer', 'admin'].includes(r))) throw forbidden('Document insights are for faculty and admins.');
  return scopeDocStats(user);
});
