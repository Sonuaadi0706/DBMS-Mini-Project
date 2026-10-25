import Link from 'next/link';

// Small presentational pieces shared by every page. No hooks here, so they work in server components too.

export const inputCls = 'mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-slate-100';
export const btnPrimary = 'rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60';
export const btnGhost = 'rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60';
export const btnDanger = 'rounded border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60';

const CHIP: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700', submitted: 'bg-blue-100 text-blue-800', under_review: 'bg-blue-100 text-blue-800',
  revision_requested: 'bg-amber-100 text-amber-800', approved: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-800',
  in_progress: 'bg-indigo-100 text-indigo-800', completed: 'bg-green-100 text-green-800', archived: 'bg-slate-100 text-slate-500',
  planned: 'bg-slate-100 text-slate-700', todo: 'bg-slate-100 text-slate-700', blocked: 'bg-red-100 text-red-800',
  done: 'bg-emerald-100 text-emerald-800', verified: 'bg-green-100 text-green-800',
  low: 'bg-green-100 text-green-800', moderate: 'bg-yellow-100 text-yellow-800', high: 'bg-orange-100 text-orange-800', critical: 'bg-red-100 text-red-800',
};

export function label(s: string): string {
  return s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function StatusChip({ status }: { status: string }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${CHIP[status] ?? 'bg-slate-100 text-slate-700'}`}>{label(status)}</span>;
}

export function ProgressBar({ pct, tone = 'indigo' }: { pct: number; tone?: 'indigo' | 'green' }) {
  const v = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex items-center gap-2" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-2 w-full rounded bg-slate-200">
        <div className={`h-2 rounded ${tone === 'green' ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: `${v}%` }} />
      </div>
      <span className="w-12 text-right text-xs text-slate-600">{Math.round(v)}%</span>
    </div>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-lg border bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed bg-white p-8 text-center text-sm text-slate-500">{children}</div>;
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>;
}

export function FieldError({ message }: { message?: string }) {
  return message ? <span className="mt-1 block text-xs text-red-600">{message}</span> : null;
}

export function ButtonLink({ href, children, primary }: { href: string; children: React.ReactNode; primary?: boolean }) {
  return <Link href={href} className={primary ? btnPrimary : btnGhost}>{children}</Link>;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'YYYY-MM-DD' strings are calendar dates (no time zone); timestamps are shown in local time. */
export function fmt(d: string | Date | null | undefined): string {
  if (!d) return '—';
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split('-').map(Number);
    return `${day} ${MONTHS[m - 1]} ${y}`;
  }
  const dt = new Date(d);
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
}

export function dueLabel(days: number, done = false): { text: string; overdue: boolean } {
  if (done) return { text: 'done', overdue: false };
  if (days < 0) return { text: `${-days} day${days === -1 ? '' : 's'} overdue`, overdue: true };
  if (days === 0) return { text: 'due today', overdue: false };
  return { text: `${days} day${days === 1 ? '' : 's'} left`, overdue: false };
}

export function bytes(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return '';
  const v = Number(n);
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  return `${(v / 1024 / 1024).toFixed(1)} MB`;
}
