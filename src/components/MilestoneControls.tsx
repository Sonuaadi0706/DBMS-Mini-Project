'use client';

import { useState } from 'react';
import { call } from '@/lib/client/api';
import { useAction } from './useAction';
import { Card, ErrorBanner, FieldError, btnDanger, btnGhost, btnPrimary, inputCls } from './ui';

const TYPES = ['proposal', 'srs', 'design_doc', 'source_code', 'screenshot', 'test_report', 'presentation', 'final_report', 'other'];

export function StartMilestoneButton({ milestoneId, label }: { milestoneId: number; label: string }) {
  const { busy, error, run } = useAction();
  return (
    <div>
      <button disabled={busy} className={btnPrimary} onClick={() => run(() => call('POST', `/api/milestones/${milestoneId}/start`))}>{label}</button>
      <ErrorBanner message={error} />
    </div>
  );
}

/** Guide controls: take a submitted milestone into review, then approve / request revision / reject it. */
export function GuideMilestoneActions({ milestoneId, status }: { milestoneId: number; status: string }) {
  const { busy, error, fields, run } = useAction();
  const [comments, setComments] = useState('');
  const act = (action: string) => run(() => call('POST', `/api/milestones/${milestoneId}/decision`, { action, comments }), { onDone: () => setComments('') });

  if (status === 'submitted') {
    return <div><button disabled={busy} className={btnPrimary} onClick={() => act('review')}>Start review</button><ErrorBanner message={error} /></div>;
  }
  if (status !== 'under_review') return null;
  return (
    <div className="space-y-2">
      <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={2} className={inputCls} placeholder="Comments (required to request revision or reject)" />
      <FieldError message={fields.comments} />
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} className={btnPrimary} onClick={() => act('approve')}>Approve</button>
        <button disabled={busy} className={btnGhost} onClick={() => act('request_revision')}>Request revision</button>
        <button disabled={busy} className={btnDanger} onClick={() => act('reject')}>Reject</button>
      </div>
      <ErrorBanner message={error} />
    </div>
  );
}

export function ApplyTemplateForm({ projectId, templates }: { projectId: number; templates: { template_id: number; name: string; milestones: number }[] }) {
  const { busy, error, run } = useAction();
  const [templateId, setTemplateId] = useState<number | ''>(templates[0]?.template_id ?? '');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  return (
    <Card>
      <h2 className="mb-1 font-medium">Start from a template</h2>
      <p className="mb-3 text-sm text-slate-600">Creates all milestones with their weightage and mandatory deliverables. Due dates are counted from the start date.</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">Template
          <select value={templateId} onChange={(e) => setTemplateId(Number(e.target.value) || '')} className={inputCls}>
            {templates.map((t) => <option key={t.template_id} value={t.template_id}>{t.name} ({t.milestones} milestones)</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Project start date
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
        </label>
        <button disabled={busy || !templateId} className={btnPrimary} onClick={() => run(() => call('POST', `/api/projects/${projectId}/apply-template`, { templateId, startDate }))}>
          {busy ? 'Creating…' : 'Create milestones'}
        </button>
      </div>
      <div className="mt-2"><ErrorBanner message={error} /></div>
    </Card>
  );
}

export function AddMilestoneForm({ projectId, remainingWeight }: { projectId: number; remainingWeight: number }) {
  const { busy, error, fields, run } = useAction();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: '', dueDate: '', startDate: '', weightage: String(Math.max(0, Math.min(remainingWeight, 10)) || ''), description: '' });
  const [req, setReq] = useState<string[]>([]);
  if (!open) return <button className={btnGhost} onClick={() => setOpen(true)}>Add milestone</button>;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Card>
      <h2 className="mb-3 font-medium">New milestone <span className="text-sm font-normal text-slate-500">(weightage available: {remainingWeight})</span></h2>
      <form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => {
        e.preventDefault();
        run(() => call('POST', `/api/projects/${projectId}/milestones`, {
          title: f.title, description: f.description, dueDate: f.dueDate, startDate: f.startDate || null,
          weightage: Number(f.weightage), requiredDeliverables: req,
        }), { onDone: () => setOpen(false) });
      }}>
        <label className="text-sm font-medium md:col-span-2">Title<input value={f.title} onChange={set('title')} className={inputCls} required /><FieldError message={fields.title} /></label>
        <label className="text-sm font-medium">Start date <span className="font-normal text-slate-500">(optional)</span><input type="date" value={f.startDate} onChange={set('startDate')} className={inputCls} /></label>
        <label className="text-sm font-medium">Due date<input type="date" value={f.dueDate} onChange={set('dueDate')} className={inputCls} required /><FieldError message={fields.dueDate} /></label>
        <label className="text-sm font-medium">Weightage (1 to 100)<input type="number" step="0.5" value={f.weightage} onChange={set('weightage')} className={inputCls} required /><FieldError message={fields.weightage} /></label>
        <label className="text-sm font-medium">Description<input value={f.description} onChange={set('description')} className={inputCls} /></label>
        <fieldset className="text-sm md:col-span-2">
          <legend className="font-medium">Mandatory deliverables</legend>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {TYPES.map((t) => (
              <label key={t} className="flex items-center gap-1"><input type="checkbox" checked={req.includes(t)} onChange={() => setReq(req.includes(t) ? req.filter((x) => x !== t) : [...req, t])} />{t.replace('_', ' ')}</label>
            ))}
          </div>
        </fieldset>
        <div className="md:col-span-2"><ErrorBanner message={error} /></div>
        <div className="flex gap-2 md:col-span-2">
          <button disabled={busy} className={btnPrimary}>{busy ? 'Saving…' : 'Add milestone'}</button>
          <button type="button" className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
        </div>
      </form>
    </Card>
  );
}

export function EditMilestone({ milestoneId, initial }: { milestoneId: number; initial: { title: string; dueDate: string; weightage: string } }) {
  const { busy, error, fields, run } = useAction();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(initial);
  if (!open) return <button className="text-xs text-slate-500 underline" onClick={() => setOpen(true)}>Edit</button>;
  return (
    <form className="mt-2 grid gap-2 rounded bg-slate-50 p-3 md:grid-cols-3" onSubmit={(e) => {
      e.preventDefault();
      run(() => call('PATCH', `/api/milestones/${milestoneId}`, { title: f.title, dueDate: f.dueDate, weightage: Number(f.weightage) }), { onDone: () => setOpen(false) });
    }}>
      <label className="text-xs font-medium">Title<input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={inputCls} /></label>
      <label className="text-xs font-medium">Due<input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} className={inputCls} /><FieldError message={fields.dueDate} /></label>
      <label className="text-xs font-medium">Weightage<input type="number" step="0.5" value={f.weightage} onChange={(e) => setF({ ...f, weightage: e.target.value })} className={inputCls} /><FieldError message={fields.weightage} /></label>
      <div className="flex gap-2 md:col-span-3"><button disabled={busy} className={btnPrimary}>Save</button><button type="button" className={btnGhost} onClick={() => setOpen(false)}>Cancel</button></div>
      <div className="md:col-span-3"><ErrorBanner message={error} /></div>
    </form>
  );
}
