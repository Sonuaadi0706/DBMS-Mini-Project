import Link from 'next/link';
import type { CurrentUser } from '@/lib/auth/session';
import { listFeedback, listMilestones, listProjects, projectProgress } from '@/lib/data/queries';
import { latestSnapshot } from '@/lib/risk';
import { contributionFor } from '@/lib/data/contribution';
import { adminDashboard, guideDashboard, reviewerDashboard, studentOverview, type DashProject } from '@/lib/data/dashboard';
import { Card, Empty, PageTitle, ProgressBar, StatusChip, dueLabel, fmt, label } from './ui';
import { LEVEL_COLOR } from './RiskViews';
import { RunSweepButton } from './RiskActions';

const LEVELS = ['low', 'moderate', 'high', 'critical'] as const;

function Stat({ value, caption, tone }: { value: number | string; caption: string; tone?: string }) {
  return (<div className="rounded-lg border bg-white p-4"><div className={`text-3xl font-semibold tabular-nums ${tone ?? ''}`}>{value}</div><div className="text-xs text-slate-500">{caption}</div></div>);
}

/** Four cards, one per risk level, with how many projects sit in each. */
function RiskCards({ projects }: { projects: { risk_level: string | null }[] }) {
  const n = (l: string) => projects.filter((p) => p.risk_level === l).length;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {LEVELS.map((l) => (
        <div key={l} className="rounded-lg border bg-white p-4" style={{ borderLeft: `4px solid ${LEVEL_COLOR[l]}` }}>
          <div className="text-3xl font-semibold tabular-nums">{n(l)}</div><div className="text-xs text-slate-500">{label(l)} risk</div>
        </div>
      ))}
    </div>
  );
}

const Section = ({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) => (
  <section><div className="mb-2 flex items-center justify-between"><h2 className="text-lg font-semibold">{title}</h2>{right}</div>{children}</section>
);

function ProjectRiskTable({ rows }: { rows: DashProject[] }) {
  if (rows.length === 0) return <Empty>No running projects.</Empty>;
  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-2">Team</th><th className="p-2">Progress</th><th className="p-2">Overdue tasks</th><th className="p-2">Missing docs</th><th className="p-2">Open feedback</th><th className="p-2">Next deadline</th><th className="p-2">Risk</th></tr></thead>
        <tbody>{rows.map((r) => {
          const d = r.days_to_next_deadline === null ? null : dueLabel(r.days_to_next_deadline);
          return (
            <tr key={r.project_id} className="border-b last:border-0 align-top">
              <td className="p-2"><Link className="font-medium text-indigo-700 hover:underline" href={`/projects/${r.project_id}/risk`}>{r.team_name}</Link><div className="text-xs text-slate-500">{r.course_name}</div></td>
              <td className="w-40 p-2"><ProgressBar pct={Number(r.progress_pct)} /></td>
              <td className={`p-2 ${r.overdue_tasks ? 'font-medium text-red-600' : ''}`}>{r.overdue_tasks}</td>
              <td className={`p-2 ${r.missing_evidence ? 'font-medium text-red-600' : ''}`}>{r.missing_evidence}</td>
              <td className="p-2">{r.unresolved_feedback}</td>
              <td className={`p-2 text-xs ${d?.overdue ? 'font-medium text-red-600' : ''}`}>{d?.text ?? '—'}</td>
              <td className="p-2">{r.risk_level ? <div><StatusChip status={r.risk_level} /><div className="mt-1 max-w-xs text-xs text-slate-500">{Number(r.risk_score).toFixed(1)} · {r.reason}</div></div> : <span className="text-slate-400">Not assessed</span>}</td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------------------- guide
export async function GuideDashboard({ user }: { user: CurrentUser }) {
  const d = await guideDashboard(user.userId);
  const high = d.projects.filter((p) => p.risk_level === 'high' || p.risk_level === 'critical');
  const queueSize = d.proposals.length + d.milestones.length + d.evidence.length;
  return (
    <div className="space-y-6">
      <PageTitle title="Faculty dashboard" subtitle={`Welcome, ${user.name}. Projects where you are the guide.`} />
      <RiskCards projects={d.projects} />
      {high.length > 0 && (
        <Section title="Needs attention now">
          <div className="grid gap-3 md:grid-cols-2">{high.map((p) => (
            <Card key={p.project_id} className="border-red-200">
              <div className="flex items-center justify-between"><Link href={`/projects/${p.project_id}/risk`} className="font-medium text-indigo-700 hover:underline">{p.team_name}</Link><StatusChip status={p.risk_level!} /></div>
              <p className="mt-1 text-sm text-slate-700">{p.reason}</p>
            </Card>))}</div>
        </Section>
      )}
      <Section title="All your projects"><ProjectRiskTable rows={d.projects} /></Section>

      <Section title={`Approval queue (${queueSize})`}>
        {queueSize === 0 ? <Empty>Nothing waiting for you.</Empty> : (
          <Card><ul className="divide-y text-sm">
            {d.proposals.map((p) => (<li key={`p${p.project_id}`} className="flex items-center justify-between py-2"><span><span className="mr-2 rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800">Proposal</span><Link className="text-indigo-700 hover:underline" href={`/proposals/${p.project_id}`}>{p.title}</Link> <span className="text-xs text-slate-500">· {p.team_name}</span></span><span className="text-xs text-slate-500">submitted {fmt(p.submitted_at)}</span></li>))}
            {d.milestones.map((m) => (<li key={`m${m.milestone_id}`} className="flex items-center justify-between py-2"><span><span className="mr-2 rounded bg-indigo-100 px-2 py-0.5 text-xs text-indigo-800">Milestone</span><Link className="text-indigo-700 hover:underline" href={`/projects/${m.project_id}/milestones`}>{m.title}</Link> <span className="text-xs text-slate-500">· {m.team_name}</span></span><span className="flex items-center gap-2 text-xs text-slate-500"><StatusChip status={m.status} />{fmt(m.submitted_at)}</span></li>))}
            {d.evidence.map((e) => (<li key={`e${e.project_id}`} className="flex items-center justify-between py-2"><span><span className="mr-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Evidence</span><Link className="text-indigo-700 hover:underline" href={`/projects/${e.project_id}/evidence`}>{e.team_name}</Link></span><span className="text-xs text-slate-500">{e.waiting} item(s) to verify</span></li>))}
          </ul></Card>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Unresolved feedback">
          {d.feedback.length === 0 ? <Empty>No unresolved feedback.</Empty> : (
            <Card><ul className="divide-y text-sm">{d.feedback.map((f) => (
              <li key={f.feedback_id} className="py-2"><div className="line-clamp-2">{f.description}</div><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500"><Link className="text-indigo-700 hover:underline" href={`/projects/${f.project_id}/feedback`}>{f.team_name}</Link>· {f.assigned_to}<StatusChip status={f.resolution_status} />{f.due_date && <span className={f.is_overdue ? 'font-medium text-red-600' : ''}>due {fmt(f.due_date)}{f.is_overdue ? ' (overdue)' : ''}</span>}</div></li>))}</ul></Card>
          )}
        </Section>
        <Section title="Delayed teams" right={<Link href="/reports?report=delayed-teams" className="text-sm text-indigo-700 underline">All reports</Link>}>
          {d.delayed.length === 0 ? <Empty>No team has overdue tasks.</Empty> : (
            <Card><ul className="divide-y text-sm">{d.delayed.map((t) => (<li key={t.project_id} className="flex items-center justify-between py-2"><Link className="font-medium text-indigo-700 hover:underline" href={`/projects/${t.project_id}/tasks`}>{t.team_name}</Link><span className="text-red-600">{t.overdue_tasks} overdue task(s), up to {t.max_days_late} days late</span></li>))}</ul></Card>
          )}
        </Section>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------------------- reviewer
export async function ReviewerDashboard({ user }: { user: CurrentUser }) {
  const d = await reviewerDashboard(user.userId);
  return (
    <div className="space-y-6">
      <PageTitle title="Reviewer dashboard" subtitle={`Welcome, ${user.name}. Submissions allocated to you for review.`} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3"><Stat value={d.pending.length} caption="reviews waiting" tone={d.pending.length ? 'text-indigo-700' : ''} /><Stat value={d.decided} caption="reviews completed" /><Stat value={d.projects.length} caption="projects allocated" /></div>
      <Section title="Waiting for your review">
        {d.pending.length === 0 ? <Empty>No pending reviews.</Empty> : (
          <div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-2">Team</th><th className="p-2">Milestone</th><th className="p-2">Status</th><th className="p-2">Submitted</th><th className="p-2">Due</th><th className="p-2" /></tr></thead>
            <tbody>{d.pending.map((r) => (
              <tr key={r.review_id} className="border-b last:border-0"><td className="p-2">{r.team_name}</td><td className="p-2">M{r.sequence_no} {r.milestone_title}</td><td className="p-2"><StatusChip status={r.milestone_status} /></td><td className="p-2">{fmt(r.submitted_at)}</td><td className="p-2">{fmt(r.due_date)}</td>
                <td className="p-2 text-right"><Link className="text-indigo-700 underline" href={`/projects/${r.project_id}/deliverables`}>Deliverables</Link> · <Link className="text-indigo-700 underline" href={`/projects/${r.project_id}/feedback`}>Review</Link></td></tr>))}</tbody>
          </table></div>
        )}
      </Section>
      <Section title="Your projects">
        {d.projects.length === 0 ? <Empty>No projects allocated.</Empty> : (
          <div className="grid gap-3 md:grid-cols-2">{d.projects.map((p) => (<Card key={p.project_id}><div className="flex items-center justify-between"><Link className="font-medium text-indigo-700 hover:underline" href={`/projects/${p.project_id}`}>{p.team_name}</Link><StatusChip status={p.status} /></div><div className="mt-1 text-xs text-slate-500">{p.title}</div></Card>))}</div>
        )}
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------------------- admin
export async function AdminDashboard({ user }: { user: CurrentUser }) {
  const d = await adminDashboard();
  const courses = [...new Set(d.heat.map((h) => h.course_name))];
  const cols = [...LEVELS, 'unassessed'] as const;
  const cell = (c: string, l: string) => d.heat.find((h) => h.course_name === c && h.risk_level === l)?.n ?? 0;
  const role = (r: string) => d.users.find((u) => u.role_name === r)?.n ?? 0;
  const proj = (s: string) => d.projects.find((p) => p.status === s)?.n ?? 0;
  return (
    <div className="space-y-6">
      <PageTitle title="Admin console" subtitle={`Welcome, ${user.name}. System-wide view.`} actions={<RunSweepButton />} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <Stat value={role('student')} caption="students" /><Stat value={role('faculty_guide')} caption="guides" /><Stat value={role('reviewer')} caption="reviewers" />
        <Stat value={d.counts.teams} caption="teams" /><Stat value={proj('in_progress')} caption="projects running" /><Stat value={proj('submitted')} caption="proposals awaiting a decision" tone={proj('submitted') ? 'text-indigo-700' : ''} />
        <Stat value={d.counts.overdue_milestones} caption="overdue milestones" tone={d.counts.overdue_milestones ? 'text-red-600' : ''} /><Stat value={d.counts.open_feedback} caption="unresolved feedback" /><Stat value={d.counts.pending_evidence} caption="evidence waiting to be verified" />
        <Stat value={d.counts.open_events} caption="open risk events" /><Stat value={d.noGuide.length} caption="projects without a guide" tone={d.noGuide.length ? 'text-red-600' : ''} /><Stat value={d.unassessed} caption="projects not yet assessed" />
      </div>
      <Section title="Risk by course">
        {courses.length === 0 ? <Empty>No running projects.</Empty> : (
          <div className="overflow-x-auto rounded-lg border bg-white"><table className="w-full text-center text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-2 text-left">Course</th>{cols.map((c) => <th key={c} className="p-2">{label(c)}</th>)}</tr></thead>
            <tbody>{courses.map((c) => (<tr key={c} className="border-b last:border-0"><td className="p-2 text-left font-medium">{c}</td>{cols.map((l) => { const n = cell(c, l); const color = l === 'unassessed' ? '#64748b' : LEVEL_COLOR[l as keyof typeof LEVEL_COLOR]; return <td key={l} className="p-2"><span className="inline-block min-w-8 rounded px-2 py-1 font-semibold tabular-nums" style={n ? { background: `${color}26`, color } : { color: '#cbd5e1' }}>{n}</span></td>; })}</tr>))}</tbody>
          </table></div>
        )}
      </Section>
      <Section title="Allocations needing action" right={<Link href="/admin/allocations" className="text-sm text-indigo-700 underline">Open allocations</Link>}>
        {d.noGuide.length === 0 ? <Empty>Every active project has a guide.</Empty> : (
          <Card><ul className="divide-y text-sm">{d.noGuide.map((p) => (<li key={p.project_id} className="flex items-center justify-between py-2"><span><Link className="text-indigo-700 hover:underline" href={`/proposals/${p.project_id}`}>{p.team_name}</Link> <span className="text-xs text-slate-500">· {p.title}</span></span><StatusChip status={p.status} /></li>))}</ul></Card>
        )}
      </Section>
    </div>
  );
}

// -------------------------------------------------------------------------------------- student
export async function StudentDashboard({ user }: { user: CurrentUser }) {
  const mine = await listProjects(user);
  const p = mine.find((x) => ['approved', 'in_progress', 'completed'].includes(x.status)) ?? mine[0];
  if (!p) {
    return (<div className="space-y-4"><PageTitle title="Student workspace" subtitle={`Welcome, ${user.name}.`} /><Empty>You are not in a team yet. <Link className="text-indigo-700 underline" href="/teams">Create or join one</Link> to start a proposal.</Empty></div>);
  }
  const running = ['approved', 'in_progress', 'completed'].includes(p.status);
  if (!running) {
    return (
      <div className="space-y-4"><PageTitle title="Student workspace" subtitle={`Welcome, ${user.name}.`} />
        <Card><div className="flex items-center justify-between"><Link className="font-medium text-indigo-700 hover:underline" href={`/proposals/${p.project_id}`}>{p.title}</Link><StatusChip status={p.status} /></div>
          <p className="mt-2 text-sm text-slate-600">Your project plan opens once the proposal is approved.</p></Card></div>
    );
  }
  const [progress, risk, overview, feedback, contrib, milestones] = await Promise.all([
    projectProgress(p.project_id), latestSnapshot(p.project_id), studentOverview(user.userId, p.project_id),
    listFeedback(p.project_id, user.userId), contributionFor(p.project_id, user.userId), listMilestones(p.project_id),
  ]);
  const pct = Number(progress[0]?.progress_pct ?? 0);
  const me = contrib[0];
  const todo = feedback.filter((f) => ['open', 'in_progress', 'reopened'].includes(f.resolution_status));
  return (
    <div className="space-y-6">
      <PageTitle title="Student workspace" subtitle={<>Welcome, {user.name}. Team {p.team_name} · <Link className="text-indigo-700 underline" href={`/projects/${p.project_id}`}>{p.title}</Link></>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><h2 className="mb-2 font-medium">Team progress</h2><ProgressBar pct={pct} />
          <ul className="mt-3 divide-y text-sm">{overview.nextMilestones.map((m) => { const dl = dueLabel(m.days_to_due); return (<li key={m.milestone_id} className="flex items-center justify-between py-2"><span>M{m.sequence_no} {m.title}</span><span className="flex items-center gap-3 text-xs"><span className={dl.overdue ? 'font-medium text-red-600' : 'text-slate-500'}>{fmt(m.due_date)} · {dl.text}</span><StatusChip status={m.status} /></span></li>); })}</ul>
          <p className="mt-2 text-xs text-slate-500">{milestones.filter((m) => m.status === 'approved').length} of {milestones.length} milestones approved.</p></Card>
        <Card><h2 className="mb-2 font-medium">Delivery risk</h2>
          {risk ? (<><StatusChip status={risk.risk_level} /><p className="mt-2 text-sm text-slate-700">{risk.reason}</p><Link className="mt-2 inline-block text-xs text-indigo-700 underline" href={`/projects/${p.project_id}/risk`}>Details and how it is calculated</Link></>) : <p className="text-sm text-slate-500">No assessment yet.</p>}</Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><div className="mb-2 flex items-center justify-between"><h2 className="font-medium">My open tasks</h2><Link className="text-xs text-indigo-700 underline" href={`/projects/${p.project_id}/tasks`}>Task board</Link></div>
          {overview.tasks.length === 0 ? <p className="text-sm text-slate-500">Nothing assigned to you right now.</p> : (
            <ul className="divide-y text-sm">{overview.tasks.map((t) => (<li key={t.task_id} className="flex items-center justify-between py-2"><span>M{t.sequence_no} {t.title}</span><span className="flex items-center gap-3 text-xs"><span className={t.is_overdue ? 'font-medium text-red-600' : 'text-slate-500'}>due {fmt(t.due_date)}{t.is_overdue ? ' (overdue)' : ''}</span><StatusChip status={t.status} /></span></li>))}</ul>)}</Card>
        <Card><h2 className="mb-2 font-medium">My contribution</h2>
          {me ? (<><div className="text-3xl font-semibold">{Number(me.indicator)}<span className="text-sm font-normal text-slate-500"> / 100</span></div><p className="mt-1 text-xs text-slate-600">{me.verified_items} verified · {me.unverified_items} waiting for the guide</p><Link className="mt-2 inline-block text-xs text-indigo-700 underline" href={`/projects/${p.project_id}/contribution`}>See details</Link></>) : <p className="text-sm text-slate-500">No data yet.</p>}</Card>
      </div>
      <Card><div className="mb-2 flex items-center justify-between"><h2 className="font-medium">Feedback to resolve ({todo.length})</h2><Link className="text-xs text-indigo-700 underline" href={`/projects/${p.project_id}/feedback`}>Open feedback</Link></div>
        {todo.length === 0 ? <p className="text-sm text-slate-500">You have no open feedback.</p> : (
          <ul className="divide-y text-sm">{todo.map((f) => (<li key={f.feedback_id} className="flex items-start justify-between gap-3 py-2"><span className="line-clamp-2">{f.description}</span><span className="flex shrink-0 items-center gap-2 text-xs"><StatusChip status={f.resolution_status} />{f.due_date && <span className={f.is_overdue ? 'font-medium text-red-600' : 'text-slate-500'}>due {fmt(f.due_date)}</span>}</span></li>))}</ul>)}</Card>
    </div>
  );
}
