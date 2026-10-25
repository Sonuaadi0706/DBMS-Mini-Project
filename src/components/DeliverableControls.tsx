'use client';

import { useRef, useState } from 'react';
import { call, callForm } from '@/lib/client/api';
import { useAction } from './useAction';
import { Card, ErrorBanner, FieldError, btnDanger, btnGhost, btnPrimary, inputCls, label } from './ui';

export const TYPES = ['proposal', 'srs', 'design_doc', 'source_code', 'screenshot', 'test_report', 'presentation', 'final_report', 'other'];

/** File-or-link picker + change summary, shared by every upload form. */
function VersionFields({ fields, summaryRef }: { fields: Record<string, string>; summaryRef?: React.RefObject<HTMLInputElement | null> }) {
  const [mode, setMode] = useState<'file' | 'link'>('file');
  return (
    <>
      <label className="block text-sm font-medium">What changed in this version?
        <input name="changeSummary" ref={summaryRef} className={inputCls} maxLength={500} placeholder="e.g. First draft of the ER diagram" />
        <FieldError message={fields.changeSummary} />
      </label>
      <div className="text-sm">
        <div className="mb-1 flex gap-4 font-medium">
          <label className="flex items-center gap-1"><input type="radio" checked={mode === 'file'} onChange={() => setMode('file')} /> Upload a file</label>
          <label className="flex items-center gap-1"><input type="radio" checked={mode === 'link'} onChange={() => setMode('link')} /> Link instead</label>
        </div>
        {mode === 'file'
          ? <input name="file" type="file" accept=".pdf,.docx,.md,.txt,.png,.jpg,.zip" className="block w-full text-sm" />
          : <input name="linkUrl" className={inputCls} placeholder="https://…" />}
        <p className="mt-1 text-xs text-slate-500">Allowed: pdf, docx, md, txt, png, jpg, zip (max 10 MB).</p>
        <FieldError message={fields.file || fields.linkUrl} />
      </div>
    </>
  );
}

function DeliverableFields({ fields }: { fields: Record<string, string> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label className="block text-sm font-medium">Type
        <select name="deliverableType" className={inputCls} defaultValue="srs">{TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</select>
        <FieldError message={fields.deliverableType} />
      </label>
      <label className="block text-sm font-medium">Title
        <input name="title" className={inputCls} maxLength={200} /><FieldError message={fields.title} />
      </label>
      <label className="block text-sm font-medium">Repository link <span className="font-normal text-slate-500">(optional)</span>
        <input name="repoLink" className={inputCls} placeholder="https://github.com/…" /><FieldError message={fields.repoLink} />
      </label>
      <label className="block text-sm font-medium">Evidence link <span className="font-normal text-slate-500">(optional)</span>
        <input name="evidenceUrl" className={inputCls} placeholder="https://…" /><FieldError message={fields.evidenceUrl} />
      </label>
    </div>
  );
}

/** Remove empty fields so the server sees "no file / no link" instead of empty values. */
function cleanForm(f: FormData): FormData {
  for (const [k, v] of [...f.entries()]) if (typeof v === 'string' && v.trim() === '') f.delete(k);
  const file = f.get('file');
  if (file instanceof File && file.size === 0) f.delete('file');
  return f;
}

export function NewDeliverableForm({ milestoneId }: { milestoneId: number }) {
  const { busy, error, fields, run } = useAction();
  const [open, setOpen] = useState(false);
  if (!open) return <button className={btnGhost} onClick={() => setOpen(true)}>Add deliverable</button>;
  return (
    <Card className="bg-slate-50">
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        run(() => callForm(`/api/milestones/${milestoneId}/deliverables`, cleanForm(new FormData(form))), { onDone: () => setOpen(false) });
      }}>
        <DeliverableFields fields={fields} />
        <VersionFields fields={fields} />
        <ErrorBanner message={error} />
        <div className="flex gap-2"><button disabled={busy} className={btnPrimary}>{busy ? 'Uploading…' : 'Save as draft'}</button><button type="button" className={btnGhost} onClick={() => setOpen(false)}>Cancel</button></div>
      </form>
    </Card>
  );
}

export function AddVersionForm({ deliverableId }: { deliverableId: number }) {
  const { busy, error, fields, run } = useAction();
  const [open, setOpen] = useState(false);
  if (!open) return <button className="text-xs text-indigo-700 underline" onClick={() => setOpen(true)}>Upload a new version</button>;
  return (
    <form className="mt-2 space-y-3 rounded bg-slate-50 p-3" onSubmit={(e) => {
      e.preventDefault();
      const form = e.currentTarget;
      run(() => callForm(`/api/deliverables/${deliverableId}/versions`, cleanForm(new FormData(form))), { onDone: () => setOpen(false) });
    }}>
      <VersionFields fields={fields} />
      <ErrorBanner message={error} />
      <div className="flex gap-2"><button disabled={busy} className={btnPrimary}>{busy ? 'Uploading…' : 'Upload version'}</button><button type="button" className={btnGhost} onClick={() => setOpen(false)}>Cancel</button></div>
    </form>
  );
}

export function DeleteDraftButton({ deliverableId }: { deliverableId: number }) {
  const { busy, error, run } = useAction();
  return (
    <span>
      <button disabled={busy} className="text-xs text-red-700 underline" onClick={() => confirm('Delete this draft deliverable and its files?') && run(() => call('DELETE', `/api/deliverables/${deliverableId}`))}>Delete draft</button>
      <ErrorBanner message={error} />
    </span>
  );
}

export function GuideDeliverableActions({ deliverableId }: { deliverableId: number }) {
  const { busy, error, run } = useAction();
  const act = (action: 'accept' | 'reject') => run(() => call('POST', `/api/deliverables/${deliverableId}/decision`, { action }));
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <button disabled={busy} className={`${btnPrimary} !px-2 !py-0.5 !text-xs`} onClick={() => act('accept')}>Accept</button>
      <button disabled={busy} className={`${btnDanger} !px-2 !py-0.5 !text-xs`} onClick={() => act('reject')}>Return for rework</button>
      <ErrorBanner message={error} />
    </div>
  );
}

/**
 * The atomic submission (spec 9.5). Drafts are submitted together with the milestone and an optional extra
 * deliverable; if anything fails NOTHING is saved, which the message says explicitly.
 */
export function SubmitMilestonePanel({ milestoneId, drafts, missing, resubmitting }: {
  milestoneId: number; drafts: string[]; missing: string[]; resubmitting: boolean;
}) {
  const { busy, error, fields, run } = useAction();
  const [extra, setExtra] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <Card className="border-indigo-200 bg-indigo-50/40">
      <h3 className="font-medium">{resubmitting ? 'Resubmit this milestone' : 'Submit this milestone for review'}</h3>
      <p className="mt-1 text-sm text-slate-600">
        {drafts.length > 0 ? <>These drafts will be submitted: <strong>{drafts.join(', ')}</strong>.</> : 'You have no drafts yet; attach a deliverable below.'}
        {' '}Submission is all-or-nothing: if anything fails, nothing is saved.
      </p>
      {missing.length > 0 && <p className="mt-2 rounded bg-amber-50 p-2 text-sm text-amber-800">Mandatory deliverable(s) not yet provided: {missing.map(label).join(', ')}. The guide cannot approve the milestone without them.</p>}
      <form ref={formRef} className="mt-3 space-y-3" onSubmit={(e) => {
        e.preventDefault();
        if (!confirm('Submit this milestone for review? You cannot edit it afterwards unless the guide requests a revision.')) return;
        const f = cleanForm(new FormData(e.currentTarget));
        run(() => callForm(`/api/milestones/${milestoneId}/submit`, f));
      }}>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={extra} onChange={(e) => setExtra(e.target.checked)} /> Attach one more deliverable in this submission</label>
        {extra && (<div className="space-y-3"><DeliverableFields fields={fields} /><VersionFields fields={fields} /></div>)}
        <ErrorBanner message={error ? `${error} The submission was not saved; nothing was changed.` : null} />
        <button disabled={busy} className={btnPrimary}>{busy ? 'Submitting…' : 'Submit for review'}</button>
      </form>
    </Card>
  );
}
