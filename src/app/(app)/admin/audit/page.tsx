import Link from 'next/link';
import { pageUser } from '@/lib/auth/page';
import { query } from '@/lib/db/pg';
import { AUDIT_PAGE_SIZE, auditActions, auditEntities, queryAudit, type AuditRow } from '@/lib/data/audit';
import { Card, Empty, btnGhost, btnPrimary, inputCls, label } from '@/components/ui';

type SP = Record<string, string | undefined>;

/** A STATUS_CHANGE reads as "status: a -> b"; inserts and deletes show a compact list of their values. */
function change(r: AuditRow): string {
  const keys = (o: Record<string, unknown> | null) => (o ? Object.keys(o) : []);
  if (r.old_values && r.new_values && r.action !== 'DELETE') {
    const k = keys(r.new_values).filter((x) => JSON.stringify(r.old_values![x]) !== JSON.stringify(r.new_values![x]));
    return k.length ? k.slice(0, 4).map((x) => `${x}: ${String(r.old_values![x] ?? '—')} → ${String(r.new_values![x] ?? '—')}`).join('; ') : '—';
  }
  const v = r.new_values ?? r.old_values;
  if (!v) return '—';
  const text = Object.entries(v).filter(([, x]) => x !== null && typeof x !== 'object').slice(0, 5).map(([k, x]) => `${k}=${String(x).slice(0, 40)}`).join(', ');
  return r.action === 'DELETE' ? `removed ${text}` : text;
}

const tone = (a: string) => (a === 'DELETE' ? 'bg-red-100 text-red-800' : a === 'INSERT' ? 'bg-green-100 text-green-800' : a === 'STATUS_CHANGE' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700');

export default async function AuditPage({ searchParams }: { searchParams: Promise<SP> }) {
  await pageUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const userId = Number(sp.user) > 0 ? Number(sp.user) : undefined;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? '') ? sp.from : undefined;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.to ?? '') ? sp.to : undefined;
  const [{ rows, total }, entities, actions, users] = await Promise.all([
    queryAudit({ entity: sp.entity || undefined, action: sp.action || undefined, userId, from, to, page }),
    auditEntities(), auditActions(), query<{ user_id: number; name: string }>(`SELECT user_id, name FROM users ORDER BY name`),
  ]);
  const pages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const link = (p: number) => { const q = new URLSearchParams(); for (const [k, v] of Object.entries({ ...sp, page: String(p) })) if (v) q.set(k, v); return `/admin/audit?${q}`; };

  return (
    <section className="space-y-4">
      <p className="text-sm text-slate-600">Who did what, and when. Entries are written by database triggers and cannot be edited or deleted.</p>
      <Card>
        <form method="get" className="flex flex-wrap items-end gap-3 text-sm">
          <label className="font-medium">Entity<select name="entity" defaultValue={sp.entity ?? ''} className={`${inputCls} !mt-0 !py-1`}><option value="">All</option>{entities.map((e) => <option key={e} value={e}>{e}</option>)}</select></label>
          <label className="font-medium">Action<select name="action" defaultValue={sp.action ?? ''} className={`${inputCls} !mt-0 !py-1`}><option value="">All</option>{actions.map((a) => <option key={a} value={a}>{a}</option>)}</select></label>
          <label className="font-medium">User<select name="user" defaultValue={sp.user ?? ''} className={`${inputCls} !mt-0 !py-1`}><option value="">Anyone</option>{users.map((u) => <option key={u.user_id} value={u.user_id}>{u.name}</option>)}</select></label>
          <label className="font-medium">From<input type="date" name="from" defaultValue={from ?? ''} className={`${inputCls} !mt-0 !py-1`} /></label>
          <label className="font-medium">To<input type="date" name="to" defaultValue={to ?? ''} className={`${inputCls} !mt-0 !py-1`} /></label>
          <button className={btnPrimary}>Apply filters</button><Link href="/admin/audit" className={btnGhost}>Reset</Link>
        </form>
      </Card>
      <p className="text-sm text-slate-600"><strong>{total}</strong> entr{total === 1 ? 'y' : 'ies'} · page {page} of {pages}</p>
      {rows.length === 0 ? <Empty>No entries match.</Empty> : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-2">When</th><th className="p-2">User</th><th className="p-2">Action</th><th className="p-2">Entity</th><th className="p-2">Change</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.log_id} className="border-b last:border-0 align-top">
                <td className="whitespace-nowrap p-2 text-xs text-slate-500">{new Date(r.created_at).toLocaleString()}</td>
                <td className="p-2">{r.user_name ?? <span className="text-slate-400">system</span>}</td>
                <td className="p-2"><span className={`rounded-full px-2 py-0.5 text-xs ${tone(r.action)}`}>{label(r.action.toLowerCase())}</span></td>
                <td className="p-2">{r.entity_type} <span className="text-xs text-slate-500">#{r.entity_id}</span></td>
                <td className="max-w-md p-2 text-xs text-slate-700">{change(r)}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
      <div className="flex gap-2 text-sm">{page > 1 && <Link className={btnGhost} href={link(page - 1)}>← Newer</Link>}{page < pages && <Link className={btnGhost} href={link(page + 1)}>Older →</Link>}</div>
    </section>
  );
}
