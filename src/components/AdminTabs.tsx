'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [['Users', '/admin/users'], ['Departments', '/admin/departments'], ['Courses', '/admin/courses'], ['Templates', '/admin/templates'], ['Allocations', '/admin/allocations'], ['Audit log', '/admin/audit']];

export function AdminTabs() {
  const path = usePathname();
  return (
    <nav className="mb-4 flex flex-wrap gap-1 border-b text-sm">
      {TABS.map(([text, href]) => (
        <Link key={href} href={href} className={`-mb-px border-b-2 px-4 py-2 ${path === href ? 'border-indigo-600 font-medium text-indigo-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>{text}</Link>
      ))}
    </nav>
  );
}
