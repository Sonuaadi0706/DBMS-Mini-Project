import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ZodError } from 'zod';
import { pageUser } from '@/lib/auth/page';
import { query } from '@/lib/db/pg';
import { listCourses, listTeams } from '@/lib/data/queries';
import { REPORTS, runReport, type Column, type ReportName } from '@/lib/data/reports';
import { isReportName, parseReportFilters } from '@/lib/validation/report';
import { Card, Empty, PageTitle, StatusChip, btnGhost, btnPrimary, fmt, inputCls } from '@/components/ui';

type SP = Record<string, string | undefined>;

function cell(c: Column, v: unknown) {
  if (v === null || v === undefined || v === '') return <span className="text-slate-300">—</span>;
  switch (c.kind) {
    case 'chip': return <StatusChip status={String(v)} />;
    case 'date': return fmt(v as string);
    case 'num': return <span className="tabular-nums">{Number(v)}</span>;
    case 'long': return <span className="line-clamp-3 max-w-md text-slate-700">{String(v)}</span>;
    default: return String(v);
  }
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await pageUser();
  if (!user.roles.some((r) => ['faculty_guide', 'reviewer', 'admin'].includes(r))) notFound();
  const sp = await searchParams;
  const name: ReportName = sp.report && isReportName(sp.report) ? sp.report : 'high-risk';
  const isAdmin = user.roles.includes('admin');

  let result; let error: string | null = null;
  const filters = (() => { try { return parseReportFilters(sp); } catch (e) { error = e instanceof ZodError ? 'Some filters are not valid. They were ignored.' : 'Invalid filters.'; return parseReportFilters({}); } })();
  result = await runReport(user, name, filters);

  const [courses, teams, guides] = await Promise.all([
    listCourses(), listTeams(user),
    isAdmin ? query<{ user_id: number; name: string }>(`SELECT u.user_id, u.name FROM users u JOIN user_roles ur USING (user_id) JOIN roles r USING (role_id) WHERE r.role_name = 'faculty_guide' ORDER BY u.name`) : Promise.resolve([]),
  ]);

  // Links keep the other filters when switching report or sorting.
  const keep = (extra: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...extra })) if (v) q.set(k, v);
    return q.toString();
  };
  const sortLink = (key: string) => {
    const active = (filters.sort ?? '') === key;
    return `/reports?${keep({ report: name, sort: key, dir: active && filters.dir === 'desc' ? 'asc' : 'desc' })}`;
  };
  const csv = `/api/reports/${name}?${keep({ report: undefined, format: 'csv' })}`;

  return (
    <section className="space-y-4">
      <PageTitle title="Reports" subtitle={isAdmin ? 'All projects.' : 'Projects allocated to you.'} />
      <nav className="flex flex-wrap gap-2 text-sm">
        {(Object.keys(REPORTS) as ReportName[]).map((n) => (
          <Link key={n} href={`/reports?report=${n}`} className={`rounded-full border px-3 py-1 ${n === name ? 'bg-indigo-600 text-white' : 'bg-white hover:bg-slate-50'}`}>{REPORTS[n]}</Link>
        ))}
      </nav>

      <Card>
        <form method="get" className="flex flex-wrap items-end gap-3 text-sm">
          <input type="hidden" name="report" value={name} />
          <label className="font-medium">Course<select name="courseId" defaultValue={sp.courseId ?? ''} className={`${inputCls} !mt-0 !py-1`}><option value="">All</option>{courses.map((c) => <option key={c.course_id} value={c.course_id}>{c.course_name}</option>)}</select></label>
          <label className="font-medium">Team<select name="teamId" defaultValue={sp.teamId ?? ''} className={`${inputCls} !mt-0 !py-1`}><option value="">All</option>{teams.map((t) => <option key={t.team_id} value={t.team_id}>{t.team_name}</option>)}</select></label>
          {isAdmin && <label className="font-medium">Guide<select name="guideId" defaultValue={sp.guideId ?? ''} className={`${inputCls} !mt-0 !py-1`}><option value="">All</option>{guides.map((g) => <option key={g.user_id} value={g.user_id}>{g.name}</option>)}</select></label>}
          <label className="font-medium">Project status<select name="status" defaultValue={sp.status ?? ''} className={`${inputCls} !mt-0 !py-1`}><option value="">Any</option>{['approved', 'in_progress', 'completed'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></label>
          {name === 'delayed-teams' && <label className="font-medium">More than<input name="min" type="number" min={0} defaultValue={sp.min ?? '0'} className={`${inputCls} !mt-0 !w-20 !py-1`} /> overdue tasks</label>}
          {name === 'high-risk' && <label className="font-medium">Risk level at least<select name="level" defaultValue={sp.level ?? 'high'} className={`${inputCls} !mt-0 !py-1`}>{['low', 'moderate', 'high', 'critical'].map((l) => <option key={l}>{l}</option>)}</select></label>}
          {name === 'contribution-imbalance' && <label className="font-medium">Top share at least (%)<input name="threshold" type="number" min={0} max={100} defaultValue={sp.threshold ?? '60'} className={`${inputCls} !mt-0 !w-20 !py-1`} /></label>}
          {name === 'unresolved-feedback' && <label className="flex items-center gap-1 pb-1 font-medium"><input type="checkbox" name="overdue" value="1" defaultChecked={filters.overdueOnly} /> Overdue only</label>}
          <button className={btnPrimary}>Apply filters</button>
          <Link href={`/reports?report=${name}`} className={btnGhost}>Reset</Link>
          <a href={csv} className={`${btnGhost} ml-auto`}>Download CSV</a>
        </form>
        {error && <p className="mt-2 text-xs text-amber-700">{error}</p>}
      </Card>

      {result.note && <p className="text-sm text-slate-600">{result.note} <strong>{result.rows.length}</strong> result(s).</p>}
      {result.rows.length === 0 ? <Empty>Nothing matches. That is good news for most of these reports.</Empty> : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500"><tr>
              {result.columns.map((c) => (
                <th key={c.key} className="p-2 whitespace-nowrap">{result.sortable.includes(c.key) ? <Link href={sortLink(c.key)} className="hover:text-slate-900">{c.label}{filters.sort === c.key ? (filters.dir === 'asc' ? ' ▲' : ' ▼') : ''}</Link> : c.label}</th>
              ))}<th className="p-2" /></tr></thead>
            <tbody>{result.rows.map((r, i) => (
              <tr key={i} className="border-b last:border-0 align-top">
                {result.columns.map((c) => <td key={c.key} className="p-2">{cell(c, r[c.key])}</td>)}
                <td className="p-2 text-right"><Link className="text-indigo-700 underline" href={`/projects/${r.project_id}/${name === 'contribution-imbalance' ? 'contribution' : name === 'unresolved-feedback' ? 'feedback' : name === 'delayed-teams' ? 'tasks' : name === 'unapproved-milestones' ? 'milestones' : name === 'missing-deliverables' ? 'deliverables' : 'risk'}`}>Open</Link></td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
