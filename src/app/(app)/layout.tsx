import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { listProjects } from '@/lib/data/queries';
import { AppHeader, type NavLink } from '@/components/AppHeader';

// Server-side gate: even if middleware were bypassed, no page in this group renders without a valid user.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const links: NavLink[] = [{ href: '/dashboard', label: 'Dashboard' }, { href: '/proposals', label: 'Proposals' }];
  if (user.roles.includes('student') || user.roles.includes('admin')) links.push({ href: '/teams', label: 'Teams' });
  if (user.roles.includes('student')) {
    const mine = (await listProjects(user)).find((p) => ['approved', 'in_progress', 'completed'].includes(p.status));
    if (mine) links.push({ href: `/projects/${mine.project_id}`, label: 'My project' });
  }
  if (user.roles.some((r) => ['faculty_guide', 'reviewer', 'admin'].includes(r))) {
    links.push({ href: '/reports', label: 'Reports' }, { href: '/similarity', label: 'Similarity' }, { href: '/insights', label: 'Insights' });
  }
  if (user.roles.includes('admin')) links.push({ href: '/admin', label: 'Admin' });

  return (
    <>
      <AppHeader name={user.name} roles={user.roles} activeRole={user.activeRole} links={links} />
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </>
  );
}
