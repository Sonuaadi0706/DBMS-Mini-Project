'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Icon, type IconName } from '../icons';
import { Logo } from '../Logo';
import { ThemeToggle } from './ThemeToggle';
import { CommandPalette, type PaletteItem } from './CommandPalette';

export interface NavLink { href: string; label: string; icon: IconName }

const ROLE_LABEL: Record<string, string> = { student: 'Student', faculty_guide: 'Faculty guide', reviewer: 'Reviewer', admin: 'Administrator' };

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
}

/** Sidebar + top bar + animated content area. Mobile: the sidebar becomes a slide-in drawer. */
export function AppShell({ name, roles, activeRole, links, children }: {
  name: string; roles: string[]; activeRole: string; links: NavLink[]; children: React.ReactNode;
}) {
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);

  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((v) => !v); }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const isActive = (href: string) => path === href || (href !== '/dashboard' && path.startsWith(href));
  const current = links.find((l) => isActive(l.href));

  const switchRole = useCallback(async (role: string) => {
    await fetch('/api/auth/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activeRole: role }) });
    router.push('/dashboard');
    router.refresh();
  }, [router]);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }, [router]);

  const items: PaletteItem[] = [
    ...links.map((l) => ({ id: l.href, label: l.label, hint: 'Go to', icon: l.icon, run: () => router.push(l.href) })),
    ...roles.filter((r) => r !== activeRole).map((r) => ({ id: `role-${r}`, label: `Switch to ${ROLE_LABEL[r] ?? r}`, hint: 'Role', icon: 'users' as IconName, run: () => switchRole(r) })),
    { id: 'theme', label: 'Toggle light / dark theme', hint: 'Appearance', icon: 'sun', run: () => document.querySelector<HTMLButtonElement>('[data-theme-toggle] button')?.click() },
    { id: 'logout', label: 'Sign out', hint: 'Account', icon: 'logout', run: logout },
  ];

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-4 pt-5"><Link href="/dashboard"><Logo tagline /></Link></div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label="Main">
        {links.map((l) => {
          const on = isActive(l.href);
          return (
            <Link key={l.href} href={l.href} aria-current={on ? 'page' : undefined}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${on ? 'bg-indigo-500/12 text-indigo-700' : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'}`}>
              <span className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-indigo-500 transition-all duration-300 ${on ? 'opacity-100 shadow-glow' : 'h-2 opacity-0'}`} />
              <Icon name={l.icon} className={`h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110 ${on ? 'text-indigo-600' : ''}`} />
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="m-3 rounded-2xl border border-slate-200 bg-white/50 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 text-sm font-semibold text-onbrand">{initials(name)}</div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-slate-900">{name}</div>
            <div className="text-xs text-slate-500">{ROLE_LABEL[activeRole] ?? activeRole}</div>
          </div>
        </div>
        {roles.length > 1 && (
          <select value={activeRole} onChange={(e) => switchRole(e.target.value)} aria-label="Switch role" className="mt-3 w-full !py-1.5 text-xs">
            {roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}
          </select>
        )}
        <button onClick={logout} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-1.5 text-xs font-medium text-slate-500 transition hover:bg-red-500/10 hover:text-red-600">
          <Icon name="logout" className="h-4 w-4" />Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="glass fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 lg:block">{sidebar}</aside>

      {/* mobile drawer */}
      <div className={`fixed inset-0 z-40 lg:hidden ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
        <div onClick={() => setOpen(false)} className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`} />
        <aside className={`glass absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-slate-200 transition-transform duration-300 ease-out ${open ? 'translate-x-0' : '-translate-x-full'}`}>{sidebar}</aside>
      </div>

      <header className="glass sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 px-4 sm:px-6">
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 text-slate-600 lg:hidden"><Icon name="menu" /></button>
        <div className="hidden min-w-0 items-center gap-2 text-sm text-slate-500 sm:flex">
          <span>ProjectPulse</span><Icon name="chevron" className="h-3.5 w-3.5 -rotate-90" />
          <span className="truncate font-medium text-slate-800">{current?.label ?? 'Workspace'}</span>
        </div>
        <button onClick={() => setPalette(true)} className="ml-auto flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-300 bg-slate-100/60 px-3 text-sm text-slate-500 transition hover:border-indigo-500/50 sm:ml-auto sm:max-w-xs sm:flex-none sm:basis-72">
          <Icon name="search" className="h-4 w-4 shrink-0" /><span className="truncate">Search or jump to…</span>
          <kbd className="ml-auto hidden rounded-md border border-slate-300 bg-white/60 px-1.5 py-0.5 font-mono text-[10px] sm:block">⌘K</kbd>
        </button>
        <div data-theme-toggle><ThemeToggle /></div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div key={path} className="page-enter">{children}</div>
      </main>
      <CommandPalette open={palette} onClose={() => setPalette(false)} items={items} />
    </div>
  );
}
