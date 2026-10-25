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
    <nav className="flex flex-wrap gap-1 border-b text-sm">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href}
          className={`-mb-px border-b-2 px-4 py-2 ${path === t.href ? 'border-indigo-600 font-medium text-indigo-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
