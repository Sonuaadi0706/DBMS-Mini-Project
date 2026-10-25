'use client';

import { useState } from 'react';
import { call } from '@/lib/client/api';
import { useAction } from './useAction';
import { ErrorBanner, btnDanger, btnGhost, inputCls } from './ui';

interface Staff { user_id: number; name: string }
interface Alloc { allocation_id: number; user_id: number; name: string; allocation_role: string }

/** Admin: set the one guide and any number of reviewers for a project. Rules are enforced by DB triggers. */
export function AllocationRow({ projectId, allocations, guides, reviewers }: { projectId: number; allocations: Alloc[]; guides: Staff[]; reviewers: Staff[] }) {
  const { busy, error, run } = useAction();
  const [g, setG] = useState<number | ''>('');
  const [r, setR] = useState<number | ''>('');
  const guide = allocations.find((a) => a.allocation_role === 'guide');
  const revs = allocations.filter((a) => a.allocation_role === 'reviewer');
  const remove = (a: Alloc) => run(() => call('DELETE', `/api/projects/${projectId}/allocations?allocationId=${a.allocation_id}`));
  const add = (userId: number | '', role: 'guide' | 'reviewer', reset: () => void) =>
    run(() => call('POST', `/api/projects/${projectId}/allocations`, { userId, allocationRole: role }), { onDone: reset });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <div className="text-xs font-semibold uppercase text-slate-500">Guide</div>
        {guide ? (
          <div className="mt-1 flex items-center gap-2 text-sm">{guide.name}<button disabled={busy} className={`${btnDanger} !px-2 !py-0.5 !text-xs`} onClick={() => remove(guide)}>Remove</button></div>
        ) : (
          <div className="mt-1 flex gap-2">
            <select value={g} onChange={(e) => setG(Number(e.target.value) || '')} className={`${inputCls} !mt-0 !py-1`}><option value="">Choose guide…</option>{guides.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}</select>
            <button disabled={busy || !g} className={btnGhost} onClick={() => add(g, 'guide', () => setG(''))}>Assign</button>
          </div>
        )}
      </div>
      <div>
        <div className="text-xs font-semibold uppercase text-slate-500">Reviewers</div>
        <div className="mt-1 space-y-1 text-sm">
          {revs.map((a) => <div key={a.allocation_id} className="flex items-center gap-2">{a.name}<button disabled={busy} className={`${btnDanger} !px-2 !py-0.5 !text-xs`} onClick={() => remove(a)}>Remove</button></div>)}
          <div className="flex gap-2">
            <select value={r} onChange={(e) => setR(Number(e.target.value) || '')} className={`${inputCls} !mt-0 !py-1`}><option value="">Add reviewer…</option>{reviewers.filter((s) => !revs.some((a) => a.user_id === s.user_id)).map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}</select>
            <button disabled={busy || !r} className={btnGhost} onClick={() => add(r, 'reviewer', () => setR(''))}>Add</button>
          </div>
        </div>
      </div>
      <div className="md:col-span-2"><ErrorBanner message={error} /></div>
    </div>
  );
}
