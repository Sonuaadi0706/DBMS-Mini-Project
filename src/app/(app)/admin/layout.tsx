import { notFound } from 'next/navigation';
import { pageUser } from '@/lib/auth/page';
import { AdminTabs } from '@/components/AdminTabs';

// Everything under /admin is for admins only; anyone else gets the same 404 as a page that does not exist.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await pageUser();
  if (!user.roles.includes('admin')) notFound();
  return <section><h1 className="mb-3 text-2xl font-semibold">Administration</h1><AdminTabs />{children}</section>;
}
