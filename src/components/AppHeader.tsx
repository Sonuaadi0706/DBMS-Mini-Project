'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const LABEL: Record<string, string> = {
  student: 'Student', faculty_guide: 'Faculty Guide', reviewer: 'Reviewer', admin: 'Admin',
};

export interface NavLink { href: string; label: string }

export function AppHeader({ name, roles, activeRole, links }: { name: string; roles: string[]; activeRole: string; links: NavLink[] }) {
  const router = useRouter();
  const path = usePathname();

  async function switchRole(role: string) {
    await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeRole: role }),
    });
    router.refresh();
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-lg font-semibold text-indigo-700">ProjectPulse</Link>
          <nav className="flex gap-4 text-sm">
            {links.map((l) => (
              <Link key={l.href} href={l.href}
                className={path === l.href || (l.href !== '/dashboard' && path.startsWith(l.href)) ? 'font-medium text-indigo-700' : 'text-slate-600 hover:text-slate-900'}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-600">{name}</span>
          {roles.length > 1 ? (
            <select value={activeRole} onChange={(e) => switchRole(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1" aria-label="Switch role">
              {roles.map((r) => <option key={r} value={r}>{LABEL[r] ?? r}</option>)}
            </select>
          ) : (
            <span className="rounded bg-indigo-50 px-2 py-1 text-indigo-700">{LABEL[activeRole] ?? activeRole}</span>
          )}
          <button onClick={logout} className="text-slate-500 hover:text-slate-900">Sign out</button>
        </div>
      </div>
    </header>
  );
}
