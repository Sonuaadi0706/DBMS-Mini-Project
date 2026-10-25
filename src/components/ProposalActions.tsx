'use client';

import { useState } from 'react';
import { call } from '@/lib/client/api';
import { useAction } from './useAction';
import { Card, ErrorBanner, FieldError, btnDanger, btnGhost, btnPrimary, inputCls } from './ui';

export function SubmitProposalButton({ projectId, resubmit }: { projectId: number; resubmit: boolean }) {
  const { busy, error, fields, run } = useAction();
  return (
    <div className="space-y-2">
      <button disabled={busy} className={btnPrimary} onClick={() => run(() => call('POST', `/api/proposals/${projectId}/submit`))}>
        {busy ? 'Submitting…' : resubmit ? 'Resubmit for review' : 'Submit for review'}
      </button>
      {Object.values(fields).map((m, i) => <FieldError key={i} message={m} />)}
      <ErrorBanner message={error} />
    </div>
  );
}

/** The allocated guide's decision. Reject and request-revision need an explanation (also enforced in the database). */
export function DecisionPanel({ projectId }: { projectId: number }) {
  const { busy, error, fields, run } = useAction();
  const [comments, setComments] = useState('');
  const decide = (action: string) => run(() => call('POST', `/api/proposals/${projectId}/decision`, { action, comments }));
  return (
    <Card>
      <h2 className="mb-2 font-medium">Your decision</h2>
      <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} className={inputCls} placeholder="Comments for the team (required to reject or request revision)" />
      <FieldError message={fields.comments} />
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={busy} onClick={() => decide('approve')} className={btnPrimary}>Approve</button>
        <button disabled={busy} onClick={() => decide('request_revision')} className={btnGhost}>Request revision</button>
        <button disabled={busy} onClick={() => decide('reject')} className={btnDanger}>Reject</button>
      </div>
      <div className="mt-2"><ErrorBanner message={error} /></div>
    </Card>
  );
}
