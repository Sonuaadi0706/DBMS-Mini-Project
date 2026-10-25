import { notFound, redirect } from 'next/navigation';
import { getCurrentUser, type CurrentUser } from './session';
import { loadProjectAccess, type ProjectAccess } from './access';
import { getProject, type ProjectDetail } from '@/lib/data/queries';

export async function pageUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export function pageId(raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) notFound();
  return n;
}

/** Loads a project for a page; anyone who is not a participant gets the same 404 as a missing project. */
export async function pageProject(rawId: string): Promise<{ user: CurrentUser; access: ProjectAccess; project: ProjectDetail }> {
  const user = await pageUser();
  const id = pageId(rawId);
  const access = await loadProjectAccess(user, id).catch(() => null);
  if (!access || !(access.isAdmin || access.isMember || access.isGuide || access.isReviewer)) notFound();
  const project = await getProject(id);
  if (!project) notFound();
  return { user, access, project };
}
