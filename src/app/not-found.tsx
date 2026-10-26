import Link from 'next/link';
import { Pulse } from '@/components/viz/Pulse';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Pulse level="critical" width={320} height={64} />
      <p className="mt-6 text-sm font-medium text-slate-500">Error 404</p>
      <h1 className="mt-3 font-display text-4xl font-semibold text-slate-900">Page not found</h1>
      <p className="mt-2 max-w-md text-slate-600">The page you are looking for does not exist, or you do not have access to it.</p>
      <Link href="/dashboard" className="btn btn-primary mt-8">Back to the dashboard</Link>
    </main>
  );
}
