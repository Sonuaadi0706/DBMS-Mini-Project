import { pageProject } from '@/lib/auth/page';
import { listMilestones, listTemplates, type MilestoneRow } from '@/lib/data/queries';
import { Card, Empty, ProgressBar, StatusChip, dueLabel, fmt, label } from '@/components/ui';
import { AddMilestoneForm, ApplyTemplateForm, EditMilestone, GuideMilestoneActions, StartMilestoneButton } from '@/components/MilestoneControls';

const DOT: Record<string, string> = {
  approved: 'bg-green-500', under_review: 'bg-blue-500', submitted: 'bg-blue-500', in_progress: 'bg-indigo-500',
  revision_requested: 'bg-amber-500', rejected: 'bg-red-500', planned: 'bg-slate-400',
};
const dayNum = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;

/** Horizontal timeline: one dot per milestone due date, plus a marker for today. */
function Timeline({ milestones, start }: { milestones: MilestoneRow[]; start: string | null }) {
  const today = Math.floor(Date.now() / 86400000);
  const dues = milestones.map((m) => dayNum(m.due_date));
  const lo = Math.min(start ? dayNum(start) : Infinity, ...dues, today) - 3;
  const hi = Math.max(...dues, today) + 3;
  const pos = (d: number) => `${((d - lo) / (hi - lo)) * 100}%`;
  return (
    <Card>
      <h2 className="mb-6 font-medium">Timeline</h2>
      <div className="relative mx-4 mb-8 h-1 rounded bg-slate-200">
        <div className="absolute -top-2 h-5 w-0.5 bg-red-500" style={{ left: pos(today) }} title="Today"><span className="absolute -top-4 -translate-x-1/2 text-[10px] text-red-600">today</span></div>
        {milestones.map((m) => (
          <div key={m.milestone_id} className="absolute -top-1.5" style={{ left: pos(dayNum(m.due_date)) }}>
            <div className={`h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white ${DOT[m.status] ?? 'bg-slate-400'}`} title={`${m.title}: ${fmt(m.due_date)} (${label(m.status)})`} />
            <div className="absolute top-5 -translate-x-1/2 whitespace-nowrap text-[10px] text-slate-600">M{m.sequence_no}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default async function MilestonesPage({ params }: { params: Promise<{ id: string }> }) {
  const { access, project: p } = await pageProject((await params).id);
  const milestones = await listMilestones(p.project_id);
  const planning = ['approved', 'in_progress'].includes(p.status);
  const canPlan = planning && (access.isMember || access.isGuide);
  const templates = canPlan && milestones.length === 0 ? await listTemplates() : [];
  const used = milestones.reduce((a, m) => a + Number(m.weightage), 0);

  if (!planning && milestones.length === 0) {
    return <Empty>The project plan opens once the proposal is approved.</Empty>;
  }

  return (
    <div className="space-y-4">
      {milestones.length === 0 ? (
        canPlan ? <><ApplyTemplateForm projectId={p.project_id} templates={templates} /><AddMilestoneForm projectId={p.project_id} remainingWeight={100} /></> : <Empty>No milestones yet.</Empty>
      ) : (
        <>
          <Timeline milestones={milestones} start={p.start_date} />
          {milestones.map((m) => {
            const d = dueLabel(m.days_to_due, m.status === 'approved');
            const locked = ['submitted', 'under_review', 'approved'].includes(m.status);
            return (
              <Card key={m.milestone_id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium">{m.sequence_no}. {m.title}</h3>
                    <p className="text-xs text-slate-500">Due {fmt(m.due_date)} · <span className={d.overdue ? 'font-medium text-red-600' : ''}>{d.text}</span> · weightage {Number(m.weightage)}</p>
                  </div>
                  <StatusChip status={m.status} />
                </div>
                <div className="mt-3"><ProgressBar pct={Number(m.completion_pct)} tone={m.status === 'approved' ? 'green' : 'indigo'} /></div>
                <p className="mt-1 text-xs text-slate-500">{m.tasks_done} of {m.task_count} tasks done</p>
                {m.required.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-slate-500">Mandatory deliverables:</span>
                    {m.required.map((t) => {
                      const ok = m.delivered.includes(t);
                      return <span key={t} className={`rounded-full px-2 py-0.5 ${ok ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>{ok ? '✓ ' : ''}{label(t)}</span>;
                    })}
                  </div>
                )}
                {m.approval_comments && <p className="mt-3 rounded bg-slate-50 p-2 text-sm text-slate-700">Guide: {m.approval_comments}</p>}
                <div className="mt-3 space-y-2">
                  {access.isMember && ['planned', 'revision_requested', 'rejected'].includes(m.status) && (
                    <StartMilestoneButton milestoneId={m.milestone_id} label={m.status === 'planned' ? 'Start milestone' : 'Resume work'} />
                  )}
                  {access.isMember && m.status === 'in_progress' && <p className="text-xs text-slate-500">When the work is ready, submit this milestone from the Deliverables tab.</p>}
                  {access.isGuide && <GuideMilestoneActions milestoneId={m.milestone_id} status={m.status} />}
                  {canPlan && !locked && <EditMilestone milestoneId={m.milestone_id} initial={{ title: m.title, dueDate: m.due_date, weightage: String(Number(m.weightage)) }} />}
                </div>
              </Card>
            );
          })}
          {canPlan && used < 100 && <AddMilestoneForm projectId={p.project_id} remainingWeight={Math.round((100 - used) * 100) / 100} />}
        </>
      )}
    </div>
  );
}
