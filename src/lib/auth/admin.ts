import { forbidden } from '@/lib/api/errors';
import { requireUser, type CurrentUser } from './session';

export async function requireAdmin(): Promise<CurrentUser> {
  const u = await requireUser();
  if (!u.roles.includes('admin')) throw forbidden('Only an admin can do that.');
  return u;
}
