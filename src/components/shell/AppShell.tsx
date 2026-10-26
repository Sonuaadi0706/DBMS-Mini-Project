'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Icon, type IconName } from '../icons';
import { Logo } from '../Logo';
import { ThemeToggle } from './ThemeToggle';
import { ThemeApply } from './ThemeApply';
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
      <div className="flex h-14 items-center px-5"><Link href="/dashboard"><Logo size={30} /></Link></div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3" aria-label="Main">
        {links.map((l) => {
          const on = isActive(l.href);
          return (
            <Link key={l.href} href={l.href} aria-current={on ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${on ? 'bg-slate-200/70 text-slate-900' : 'text-slate-600 hover:bg-slate-200/40 hover:text-slate-900'}`}>
              <Icon name={l.icon} className={`h-[18px] w-[18px] ${on ? 'text-indigo-600' : 'text-slate-400'}`} />
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 p-3">
        {roles.length > 1 && (
          <select value={activeRole} onChange={(e) => switchRole(e.target.value)} aria-label="Switch role" className="mb-3 w-full !py-1.5 text-xs">
            {roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}
          </select>
        )}
        <div className="flex items-center gap-3 px-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">{initials(name)}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-slate-900">{name}</div>
            <div className="text-xs text-slate-500">{ROLE_LABEL[activeRole] ?? activeRole}</div>
          </div>
          <button onClick={logout} aria-label="Sign out" title="Sign out" className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-900"><Icon name="logout" className="h-[18px] w-[18px]" /></button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-60">
      <ThemeApply mode="user" />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-slate-200 bg-appbg lg:block">{sidebar}</aside>

      {/* mobile drawer */}
      <div className={`fixed inset-0 z-40 lg:hidden ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
        <div onClick={() => setOpen(false)} className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`} />
        <aside className={`absolute inset-y-0 left-0 w-64 max-w-[85vw] border-r border-slate-200 bg-appbg transition-transform duration-200 ease-out ${open ? 'translate-x-0' : '-translate-x-full'}`}>{sidebar}</aside>
      </div>

      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-appbg/85 px-4 backdrop-blur sm:px-6">
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-200/60 lg:hidden"><Icon name="menu" /></button>
        <div className="hidden min-w-0 items-center gap-2 text-sm text-slate-500 sm:flex">
          <span>ProjectPulse</span><Icon name="chevron" className="h-3.5 w-3.5 -rotate-90" />
          <span className="truncate font-medium text-slate-800">{current?.label ?? 'Workspace'}</span>
        </div>
        <button onClick={() => setPalette(true)} className="ml-auto flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-surface px-3 text-sm text-slate-500 transition-colors hover:border-slate-300 sm:flex-none sm:basis-64">
          <Icon name="search" className="h-4 w-4 shrink-0" /><span className="truncate">Search…</span>
          <kbd className="ml-auto hidden rounded border border-slate-200 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 sm:block">⌘K</kbd>
        </button>
        <div data-theme-toggle><ThemeToggle /></div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        <div key={path} className="page-enter">{children}</div>
      </main>
      <CommandPalette open={palette} onClose={() => setPalette(false)} items={items} />
    </div>
  );
}
