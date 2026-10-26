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
    <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-slate-200 text-sm" aria-label="Project sections">
      {tabs.map((t) => {
        const on = path === t.href;
        return (
          <Link key={t.href} href={t.href} aria-current={on ? 'page' : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 font-medium transition-colors ${on ? 'border-indigo-600 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900'}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
