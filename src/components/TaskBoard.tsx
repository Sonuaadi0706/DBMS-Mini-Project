'use client';

import { useMemo, useState } from 'react';
import { call } from '@/lib/client/api';
import { useAction } from './useAction';
import { Card, ErrorBanner, FieldError, StatusChip, btnDanger, btnGhost, btnPrimary, fmt, inputCls, label } from './ui';

export interface BoardTask {
  task_id: number; milestone_id: number; milestone_title: string; sequence_no: number; title: string; description: string | null;
  status: string; priority: string; effort_hours: string; planned_start_date: string | null; planned_completion_date: string;
  actual_completion_date: string | null; due_date: string; is_overdue: boolean;
  assignees: { userId: number; name: string; type: 'owner' | 'collaborator' }[];
}
export interface BoardMilestone { milestone_id: number; sequence_no: number; title: string; status: string }
export interface Person { user_id: number; name: string }

const COLUMNS = ['todo', 'in_progress', 'blocked', 'done', 'verified'] as const;
const PRIORITY_DOT: Record<string, string> = { high: 'bg-red-500', medium: 'bg-amber-400', low: 'bg-slate-300' };
const OPEN_MILESTONE = (s: string) => !['submitted', 'under_review', 'approved'].includes(s);

/** Buttons shown on a card. The API still re-checks who may do what; the database checks the move is legal. */
function movesFor(status: string, isMember: boolean, isGuide: boolean): { to: string; text: string; primary?: boolean }[] {
  const out: { to: string; text: string; primary?: boolean }[] = [];
  if (isMember) {
    if (status === 'todo') out.push({ to: 'in_progress', text: 'Start', primary: true });
    if (status === 'in_progress') out.push({ to: 'done', text: 'Mark done', primary: true }, { to: 'blocked', text: 'Blocked' });
    if (status === 'blocked') out.push({ to: 'in_progress', text: 'Resume', primary: true });
  }
  if (status === 'done') {
    if (isGuide) out.push({ to: 'verified', text: 'Verify', primary: true }, { to: 'in_progress', text: 'Send back' });
    else if (isMember) out.push({ to: 'in_progress', text: 'Reopen' });
  }
  return out;
}

function TaskCard({ t, people, isMember, isGuide }: { t: BoardTask; people: Person[]; isMember: boolean; isGuide: boolean }) {
  const { busy, error, run } = useAction();
  const [open, setOpen] = useState(false);
  const [collab, setCollab] = useState<number | ''>('');
  const owner = t.assignees.find((a) => a.type === 'owner');
  const unassigned = people.filter((p) => !t.assignees.some((a) => a.userId === p.user_id));
  const locked = t.status === 'verified';

  return (
    <div className={`card-surface p-3 text-sm ${t.is_overdue ? "!border-red-400/60" : ""}`}>
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[t.priority]}`} title={`${t.priority} priority`} />
        <button className="text-left font-medium hover:text-indigo-700" onClick={() => setOpen(!open)}>{t.title}</button>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
        <span className="rounded bg-slate-100 px-1.5">M{t.sequence_no}</span>
        <span>{Number(t.effort_hours)}h</span>
        <span className={t.is_overdue ? 'font-medium text-red-600' : ''}>due {fmt(t.due_date)}{t.is_overdue ? ' (overdue)' : ''}</span>
      </div>
      <div className="mt-1 text-xs">
        {owner ? <span className="font-medium text-slate-700">{owner.name}</span> : <span className="text-amber-600">No owner</span>}
        {t.assignees.filter((a) => a.type === 'collaborator').map((a) => <span key={a.userId} className="text-slate-500">, {a.name}</span>)}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {movesFor(t.status, isMember, isGuide).map((m) => (
          <button key={m.to} disabled={busy} className={`${m.primary ? btnPrimary : btnGhost} !px-2 !py-0.5 !text-xs`}
            onClick={() => run(() => call('POST', `/api/tasks/${t.task_id}/status`, { status: m.to }))}>{m.text}</button>
        ))}
      </div>
      <ErrorBanner message={error} />

      {open && (
        <div className="mt-3 space-y-2 border-t pt-3 text-xs">
          {t.description && <p className="text-slate-600">{t.description}</p>}
          <p className="text-slate-500">Planned {fmt(t.planned_start_date)} → {fmt(t.planned_completion_date)}{t.actual_completion_date && ` · finished ${fmt(t.actual_completion_date)}`}</p>
          {isMember && !locked && (
            <>
              <label className="block font-medium">Owner
                <select className={`${inputCls} !py-1 !text-xs`} value={owner?.userId ?? ''} disabled={busy}
                  onChange={(e) => e.target.value && run(() => call('POST', `/api/tasks/${t.task_id}/assignments`, { userId: Number(e.target.value), assignmentType: 'owner' }))}>
                  <option value="">Choose owner…</option>
                  {people.map((p) => <option key={p.user_id} value={p.user_id}>{p.name}</option>)}
                </select>
              </label>
              <div className="flex flex-wrap gap-1">
                {t.assignees.filter((a) => a.type === 'collaborator').map((a) => (
                  <span key={a.userId} className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5">
                    {a.name}
                    <button aria-label={`Remove ${a.name}`} className="text-slate-400 hover:text-red-600" onClick={() => run(() => call('DELETE', `/api/tasks/${t.task_id}/assignments?userId=${a.userId}`))}>×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1">
                <select className={`${inputCls} !mt-0 !py-1 !text-xs`} value={collab} onChange={(e) => setCollab(Number(e.target.value) || '')}>
                  <option value="">Add collaborator…</option>
                  {unassigned.map((p) => <option key={p.user_id} value={p.user_id}>{p.name}</option>)}
                </select>
                <button disabled={busy || !collab} className={`${btnGhost} !px-2 !py-0.5 !text-xs`}
                  onClick={() => run(() => call('POST', `/api/tasks/${t.task_id}/assignments`, { userId: collab, assignmentType: 'collaborator' }), { onDone: () => setCollab('') })}>Add</button>
              </div>
              {t.status === 'todo' && (
                <button disabled={busy} className={`${btnDanger} !px-2 !py-0.5 !text-xs`}
                  onClick={() => confirm('Delete this task?') && run(() => call('DELETE', `/api/tasks/${t.task_id}`))}>Delete task</button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AddTaskForm({ milestones, people }: { milestones: BoardMilestone[]; people: Person[] }) {
  const { busy, error, fields, run } = useAction();
  const open_ = milestones.filter((m) => OPEN_MILESTONE(m.status));
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ milestoneId: String(open_[0]?.milestone_id ?? ''), title: '', description: '', effortHours: '4', priority: 'medium', plannedStartDate: '', plannedCompletionDate: '', ownerId: '' });
  const [collabs, setCollabs] = useState<number[]>([]);
  if (open_.length === 0) return null;
  if (!open) return <button className={btnPrimary} onClick={() => setOpen(true)}>Add task</button>;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Card className="mb-4">
      <h2 className="mb-3 font-medium">New task</h2>
      <form className="grid gap-3 md:grid-cols-3" onSubmit={(e) => {
        e.preventDefault();
        run(() => call('POST', `/api/milestones/${f.milestoneId}/tasks`, {
          title: f.title, description: f.description, effortHours: Number(f.effortHours), priority: f.priority,
          plannedStartDate: f.plannedStartDate || null, plannedCompletionDate: f.plannedCompletionDate, ownerId: Number(f.ownerId),
          collaboratorIds: collabs.filter((c) => c !== Number(f.ownerId)),
        }), { onDone: () => { setOpen(false); setF({ ...f, title: '', description: '' }); setCollabs([]); } });
      }}>
        <label className="text-sm font-medium">Milestone
          <select value={f.milestoneId} onChange={set('milestoneId')} className={inputCls}>{open_.map((m) => <option key={m.milestone_id} value={m.milestone_id}>M{m.sequence_no} {m.title}</option>)}</select>
        </label>
        <label className="text-sm font-medium md:col-span-2">Title<input value={f.title} onChange={set('title')} className={inputCls} required /><FieldError message={fields.title} /></label>
        <label className="text-sm font-medium md:col-span-3">Description<input value={f.description} onChange={set('description')} className={inputCls} /></label>
        <label className="text-sm font-medium">Planned start <span className="font-normal text-slate-500">(optional)</span><input type="date" value={f.plannedStartDate} onChange={set('plannedStartDate')} className={inputCls} /><FieldError message={fields.plannedStartDate} /></label>
        <label className="text-sm font-medium">Planned completion<input type="date" value={f.plannedCompletionDate} onChange={set('plannedCompletionDate')} className={inputCls} required /><FieldError message={fields.plannedCompletionDate || fields.dueDate} /></label>
        <label className="text-sm font-medium">Effort (hours)<input type="number" step="0.5" value={f.effortHours} onChange={set('effortHours')} className={inputCls} required /><FieldError message={fields.effortHours} /></label>
        <label className="text-sm font-medium">Priority
          <select value={f.priority} onChange={set('priority')} className={inputCls}><option>low</option><option>medium</option><option>high</option></select>
        </label>
        <label className="text-sm font-medium">Owner
          <select value={f.ownerId} onChange={set('ownerId')} className={inputCls} required><option value="">Choose…</option>{people.map((p) => <option key={p.user_id} value={p.user_id}>{p.name}</option>)}</select>
          <FieldError message={fields.ownerId} />
        </label>
        <fieldset className="text-sm"><legend className="font-medium">Collaborators</legend>
          {people.filter((p) => String(p.user_id) !== f.ownerId).map((p) => (
            <label key={p.user_id} className="mr-3 inline-flex items-center gap-1"><input type="checkbox" checked={collabs.includes(p.user_id)} onChange={() => setCollabs(collabs.includes(p.user_id) ? collabs.filter((x) => x !== p.user_id) : [...collabs, p.user_id])} />{p.name}</label>
          ))}
        </fieldset>
        <div className="md:col-span-3"><ErrorBanner message={error} /></div>
        <div className="flex gap-2 md:col-span-3"><button disabled={busy} className={btnPrimary}>{busy ? 'Saving…' : 'Create task'}</button><button type="button" className={btnGhost} onClick={() => setOpen(false)}>Cancel</button></div>
      </form>
    </Card>
  );
}

export function TaskBoard({ tasks, milestones, people, isMember, isGuide, canPlan }: {
  tasks: BoardTask[]; milestones: BoardMilestone[]; people: Person[]; isMember: boolean; isGuide: boolean; canPlan: boolean;
}) {
  const [ms, setMs] = useState('');
  const [who, setWho] = useState('');
  const [overdue, setOverdue] = useState(false);
  const shown = useMemo(() => tasks.filter((t) =>
    (!ms || String(t.milestone_id) === ms) && (!who || t.assignees.some((a) => String(a.userId) === who)) && (!overdue || t.is_overdue)), [tasks, ms, who, overdue]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium">Milestone
          <select value={ms} onChange={(e) => setMs(e.target.value)} className={`${inputCls} !mt-0 !py-1`}><option value="">All</option>{milestones.map((m) => <option key={m.milestone_id} value={m.milestone_id}>M{m.sequence_no} {m.title}</option>)}</select>
        </label>
        <label className="text-xs font-medium">Assignee
          <select value={who} onChange={(e) => setWho(e.target.value)} className={`${inputCls} !mt-0 !py-1`}><option value="">Everyone</option>{people.map((p) => <option key={p.user_id} value={p.user_id}>{p.name}</option>)}</select>
        </label>
        <label className="flex items-center gap-1 pb-1 text-xs font-medium"><input type="checkbox" checked={overdue} onChange={(e) => setOverdue(e.target.checked)} />Overdue only</label>
        <span className="pb-1 text-xs text-slate-500">{shown.length} of {tasks.length} tasks</span>
        <div className="ml-auto">{isMember && canPlan && <AddTaskForm milestones={milestones} people={people} />}</div>
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        {COLUMNS.map((col) => {
          const items = shown.filter((t) => t.status === col);
          return (
            <section key={col} className="rounded-xl border border-slate-200 bg-slate-100/50 p-2.5" aria-label={label(col)}>
              <h3 className="mb-2 flex items-center justify-between px-1 text-xs font-semibold uppercase text-slate-600">{label(col)} <span className="rounded-full bg-white px-2 py-0.5 text-slate-500">{items.length}</span></h3>
              <div className="space-y-2">
                {items.map((t) => <TaskCard key={t.task_id} t={t} people={people} isMember={isMember} isGuide={isGuide} />)}
                {items.length === 0 && <p className="px-1 py-4 text-center text-xs text-slate-400">Nothing here</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
export { StatusChip };
