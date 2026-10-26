import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { listProjects } from '@/lib/data/queries';
import { AppShell, type NavLink } from '@/components/shell/AppShell';

// Server-side gate: even if middleware were bypassed, no page in this group renders without a valid user.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const links: NavLink[] = [{ href: '/dashboard', label: 'Dashboard', icon: 'dashboard' }, { href: '/proposals', label: 'Proposals', icon: 'proposals' }];
  if (user.roles.includes('student') || user.roles.includes('admin')) links.push({ href: '/teams', label: 'Teams', icon: 'teams' });
  if (user.roles.includes('student')) {
    const mine = (await listProjects(user)).find((p) => ['approved', 'in_progress', 'completed'].includes(p.status));
    if (mine) links.push({ href: `/projects/${mine.project_id}`, label: 'My project', icon: 'project' });
  }
  if (user.roles.some((r) => ['faculty_guide', 'reviewer', 'admin'].includes(r))) {
    links.push({ href: '/reports', label: 'Reports', icon: 'reports' }, { href: '/similarity', label: 'Similarity', icon: 'similarity' }, { href: '/insights', label: 'Insights', icon: 'insights' });
  }
  if (user.roles.includes('admin')) links.push({ href: '/admin', label: 'Admin', icon: 'admin' });

  return <AppShell name={user.name} roles={user.roles} activeRole={user.activeRole} links={links}>{children}</AppShell>;
}
