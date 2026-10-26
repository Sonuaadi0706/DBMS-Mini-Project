'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function ProjectTabs({ projectId }: { projectId: number }) {
  const path = usePathname();
  const base = `/projects/${projectId}`;
  const tabs = [{ href: base, label: 'Overview' }, { href: `${base}/milestones`, label: 'Milestones' }, { href: `${base}/tasks`, label: 'Task board' },
    { href: `${base}/deliverables`, label: 'Deliverables' }, { href: `${base}/feedback`, label: 'Feedback' }, { href: `${base}/evidence`, label: 'Evidence' },
    { href: `${base}/contribution`, label: 'Contribution' }, { href: `${base}/risk`, label: 'Risk' }];
  return (
    <nav className="glass -mx-1 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 p-1 text-sm" aria-label="Project sections">
      {tabs.map((t) => {
        const on = path === t.href;
        return (
          <Link key={t.href} href={t.href} aria-current={on ? 'page' : undefined}
            className={`relative whitespace-nowrap rounded-xl px-4 py-2 font-medium transition-all duration-200 ${on ? 'bg-indigo-500/15 text-indigo-700 shadow-[inset_0_0_0_1px_rgb(var(--c-brand-500)/.35)]' : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
