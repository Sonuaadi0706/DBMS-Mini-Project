'use client';

import { useState } from 'react';
import { call } from '@/lib/client/api';
import { useAction } from './useAction';
import { Card, ErrorBanner, FieldError, btnGhost, btnPrimary, inputCls } from './ui';

export function VerifyEvidenceButton({ evidenceId }: { evidenceId: number }) {
  const { busy, error, run } = useAction();
  return (<span><button disabled={busy} className={`${btnPrimary} !px-2 !py-0.5 !text-xs`} onClick={() => run(() => call('POST', `/api/evidence/${evidenceId}/verify`))}>Verify</button><ErrorBanner message={error} /></span>);
}

/** Students record a commit by hand (no GitHub sync in version 1). The guide verifies it like any other evidence. */
export function GitReferenceForm({ projectId }: { projectId: number }) {
  const { busy, error, fields, run } = useAction();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ repoUrl: '', commitRef: '', commitMessage: '' });
  if (!open) return <button className={btnGhost} onClick={() => setOpen(true)}>Record a commit</button>;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Card className="mb-4">
      <form className="grid gap-3 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); run(() => call('POST', '/api/git-activities', { projectId, ...f, commitMessage: f.commitMessage || undefined }), { onDone: () => { setOpen(false); setF({ repoUrl: f.repoUrl, commitRef: '', commitMessage: '' }); } }); }}>
        <label className="text-sm font-medium">Repository URL<input value={f.repoUrl} onChange={set('repoUrl')} className={inputCls} placeholder="https://github.com/…" /><FieldError message={fields.repoUrl} /></label>
        <label className="text-sm font-medium">Commit reference<input value={f.commitRef} onChange={set('commitRef')} className={inputCls} placeholder="a1b2c3d" /><FieldError message={fields.commitRef} /></label>
        <label className="text-sm font-medium">Message <span className="font-normal text-slate-500">(optional)</span><input value={f.commitMessage} onChange={set('commitMessage')} className={inputCls} maxLength={300} /></label>
        <div className="md:col-span-3"><ErrorBanner message={error} /></div>
        <div className="flex gap-2 md:col-span-3"><button disabled={busy} className={btnPrimary}>Save commit</button><button type="button" className={btnGhost} onClick={() => setOpen(false)}>Cancel</button></div>
      </form>
    </Card>
  );
}
