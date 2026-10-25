import Link from 'next/link';
import { pageProject } from '@/lib/auth/page';
import { getAllocations, getTeamMembers, latestRisk, listMilestones, listProjectTasks, projectProgress } from '@/lib/data/queries';
import { Card, Empty, ProgressBar, StatusChip, dueLabel, fmt, label } from '@/components/ui';

export default async function ProjectOverview({ params }: { params: Promise<{ id: string }> }) {
  const { project: p } = await pageProject((await params).id);
  const [progress, risk, members, allocations, milestones, tasks] = await Promise.all([
    projectProgress(p.project_id), latestRisk(p.project_id), getTeamMembers(p.team_id),
    getAllocations(p.project_id), listMilestones(p.project_id), listProjectTasks(p.project_id),
  ]);
  const pct = Number(progress[0]?.progress_pct ?? 0);
  const next = milestones.find((m) => m.status !== 'approved');
  const byStatus = (s: string) => tasks.filter((t) => t.status === s).length;
  const r = risk[0];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <h2 className="mb-2 font-medium">Progress</h2>
          <ProgressBar pct={pct} />
          <p className="mt-2 text-xs text-slate-500">Weighted by milestone weightage. An approved milestone counts as 100%.
            {progress[0] && ` ${progress[0].milestones_approved} of ${progress[0].milestone_count} milestones approved.`}</p>
          {next && (() => { const d = dueLabel(next.days_to_due); return (
            <p className="mt-3 text-sm">Next: <Link className="text-indigo-700 underline" href={`/projects/${p.project_id}/milestones`}>{next.title}</Link>, due {fmt(next.due_date)} <span className={d.overdue ? 'font-medium text-red-600' : 'text-slate-500'}>({d.text})</span></p>
          ); })()}
        </Card>

        <Card>
          <h2 className="mb-2 font-medium">Tasks</h2>
          {tasks.length === 0 ? <p className="text-sm text-slate-500">No tasks yet.</p> : (
            <div className="grid grid-cols-5 gap-2 text-center text-sm">
              {['todo', 'in_progress', 'blocked', 'done', 'verified'].map((s) => (
                <div key={s} className="rounded bg-slate-50 p-2"><div className="text-xl font-semibold">{byStatus(s)}</div><div className="text-xs text-slate-500">{label(s)}</div></div>
              ))}
            </div>
          )}
          <p className="mt-2 text-sm"><span className="font-medium text-red-600">{tasks.filter((t) => t.is_overdue).length}</span> overdue</p>
        </Card>

        <Card>
          <h2 className="mb-2 font-medium">Milestones</h2>
          {milestones.length === 0 ? <Empty>No milestones yet. <Link className="text-indigo-700 underline" href={`/projects/${p.project_id}/milestones`}>Plan the project</Link>.</Empty> : (
            <ul className="divide-y text-sm">
              {milestones.map((m) => (
                <li key={m.milestone_id} className="flex items-center justify-between gap-2 py-2">
                  <span>{m.sequence_no}. {m.title}</span>
                  <span className="flex items-center gap-3 text-xs text-slate-500">due {fmt(m.due_date)} <StatusChip status={m.status} /></span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <h2 className="mb-2 font-medium">Delivery risk</h2>
          {r ? (
            <>
              <div className="flex items-center gap-2"><StatusChip status={r.risk_level} /><span className="text-sm text-slate-600">score {Number(r.risk_score).toFixed(1)} / 100</span></div>
              <p className="mt-2 text-sm text-slate-700">{r.reason}</p>
              <p className="mt-1 text-xs text-slate-400">Calculated {fmt(r.calculated_at)}. Detailed breakdown comes with the risk dashboard.</p>
            </>
          ) : <p className="text-sm text-slate-500">No assessment yet.</p>}
        </Card>
        <Card>
          <h2 className="mb-2 font-medium">Guide and reviewers</h2>
          {allocations.length === 0 ? <p className="text-sm text-slate-500">Not allocated yet.</p> : (
            <ul className="text-sm">{allocations.map((a) => <li key={a.allocation_id}>{a.name} <span className="text-xs text-slate-500">({a.allocation_role})</span></li>)}</ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-2 font-medium">Team</h2>
          <ul className="space-y-1 text-sm">
            {members.map((m) => <li key={m.user_id}><span className="font-medium">{m.name}</span>{m.member_role === 'leader' && ' (leader)'}<div className="text-xs text-slate-500">{m.responsibility}</div></li>)}
          </ul>
        </Card>
      </div>
    </div>
  );
}
