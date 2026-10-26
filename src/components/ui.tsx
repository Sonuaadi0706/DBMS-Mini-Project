import Link from 'next/link';
import { Icon } from './icons';

// Shared presentational pieces. No hooks, so they work in server components. Colours come from the theme tokens
// (src/app/theme.css), so everything here looks right in both dark and light mode.

export const inputCls = 'mt-1 w-full rounded-lg border border-slate-300 bg-surface px-3 py-2 text-sm text-slate-900 transition placeholder:text-slate-400 hover:border-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 disabled:opacity-60';
export const btnPrimary = 'btn btn-primary';
export const btnGhost = 'btn btn-ghost';
export const btnDanger = 'btn btn-danger';

export function label(s: string): string {
  return s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

type Tone = 'neutral' | 'ok' | 'info' | 'warn' | 'hot' | 'bad' | 'brand';
// status word -> colour family. "live" ones get a softly pulsing dot.
const TONE: Record<string, Tone> = {
  draft: 'neutral', planned: 'neutral', todo: 'neutral', pending: 'neutral', archived: 'neutral', inactive: 'neutral',
  submitted: 'info', under_review: 'info', open: 'info', resolved: 'info', acceptable_overlap: 'info',
  in_progress: 'brand', active: 'brand',
  revision_requested: 'warn', needs_revision: 'warn', moderate: 'warn', suspended: 'warn',
  reopened: 'hot', high: 'hot',
  approved: 'ok', accepted: 'ok', completed: 'ok', done: 'ok', verified: 'ok', low: 'ok', not_similar: 'ok',
  rejected: 'bad', blocked: 'bad', critical: 'bad', escalated: 'bad',
};

export function StatusChip({ status }: { status: string }) {
  return <span className={`chip chip-${TONE[status] ?? 'neutral'}`}><i />{label(status)}</span>;
}

export function ProgressBar({ pct, tone = 'indigo' }: { pct: number; tone?: 'indigo' | 'green' }) {
  const v = Math.max(0, Math.min(100, pct));
  const fill = tone === 'green' ? 'rgb(var(--c-green-500))' : 'rgb(var(--c-brand-500))';
  return (
    <div className="flex items-center gap-3" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full origin-left rounded-full" style={{ width: `${v}%`, background: fill, animation: 'bar-grow .8s cubic-bezier(.2,.8,.2,1) both' }} />
      </div>
      <span className="num w-10 text-right text-xs font-medium text-slate-600">{Math.round(v)}%</span>
    </div>
  );
}

export function Card({ children, className = '', interactive = false }: { children: React.ReactNode; className?: string; interactive?: boolean }) {
  return <div className={`card-surface ${interactive ? 'interactive' : ''} ${className}`}>{children}</div>;
}

export function PageTitle({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <div className="mb-1 text-xs font-medium text-slate-500">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-500">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Icon name="pulse" className="h-5 w-5" /></div>
      {children}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" key={message} className="shake flex items-start gap-2 rounded-lg border border-red-300/50 bg-red-50 px-3 py-2 text-sm text-red-700">
      <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />{message}
    </p>
  );
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
