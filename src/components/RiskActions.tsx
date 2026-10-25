'use client';

import { useState } from 'react';
import { call } from '@/lib/client/api';
import { useAction } from './useAction';
import { ErrorBanner, btnGhost, btnPrimary } from './ui';

export function RecalculateButton({ projectId }: { projectId: number }) {
  const { busy, error, run } = useAction();
  return (<div><button disabled={busy} className={btnGhost} onClick={() => run(() => call('POST', `/api/projects/${projectId}/risk/recalculate`))}>{busy ? 'Calculating…' : 'Recalculate now'}</button><ErrorBanner message={error} /></div>);
}

/** Admin: store a fresh risk snapshot for every running project (the same job the script runs). */
export function RunSweepButton() {
  const { busy, error, run } = useAction();
  const [done, setDone] = useState<string | null>(null);
  return (
    <div className="text-right">
      <button disabled={busy} className={btnPrimary} onClick={() => { setDone(null); run(() => call<{ projects: number; newOverdueFlags: number }>('POST', '/api/jobs/risk-sweep'), { onDone: (r) => setDone(`Assessed ${r.projects} project(s); ${r.newOverdueFlags} new overdue flag(s).`) }); }}>{busy ? 'Running sweep…' : 'Run risk sweep'}</button>
      {done && <p role="status" className="mt-1 text-xs text-green-700">{done}</p>}
      <ErrorBanner message={error} />
    </div>
  );
}
