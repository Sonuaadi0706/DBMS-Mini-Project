import { notFound } from 'next/navigation';
import { pageUser } from '@/lib/auth/page';
import { scopeDocStats } from '@/lib/docs/stats';
import { Card, Empty, PageTitle, label } from '@/components/ui';

function Bars({ rows, unit }: { rows: { name: string; value: number; extra?: string }[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((r) => (
        <li key={r.name}>
          <div className="flex justify-between"><span className="font-medium">{r.name}</span><span className="tabular-nums text-slate-600">{r.value} {unit}{r.extra ? ` · ${r.extra}` : ''}</span></div>
          <div className="mt-1 h-2 rounded bg-slate-100"><div className="h-2 rounded bg-indigo-500" style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

// Aggregations computed inside MongoDB (spec 11.4: A2, A4, A5), scoped to the projects this person oversees.
export default async function InsightsPage() {
  const user = await pageUser();
  if (!user.roles.some((r) => ['faculty_guide', 'reviewer', 'admin'].includes(r))) notFound();
  const s = await scopeDocStats(user);
  return (
    <section className="space-y-4">
      <PageTitle title="Document insights" subtitle={`Computed in MongoDB over ${s.projects} project(s) ${user.roles.includes('admin') ? 'in the system' : 'allocated to you'}.`} />
      {s.projects === 0 ? <Empty>No projects to analyse yet.</Empty> : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card><h2 className="mb-3 font-medium">Document types</h2>{s.types.length === 0 ? <p className="text-sm text-slate-500">No documents.</p> : <Bars unit="docs" rows={s.types.map((t) => ({ name: t.documentType, value: t.documents, extra: `avg ${t.avgVersions} versions` }))} />}</Card>
          <Card><h2 className="mb-3 font-medium">Open feedback themes</h2>{s.themes.length === 0 ? <p className="text-sm text-slate-500">No open discussions.</p> : <Bars unit="threads" rows={s.themes.map((t) => ({ name: label(t.theme), value: t.openThreads, extra: `avg ${t.avgMessages} msgs` }))} />}</Card>
          <Card><h2 className="mb-3 font-medium">Most used tags</h2>{s.tags.length === 0 ? <p className="text-sm text-slate-500">No tags.</p> : <Bars unit="docs" rows={s.tags.slice(0, 8).map((t) => ({ name: t.tag, value: t.n }))} />}</Card>
        </div>
      )}
    </section>
  );
}
