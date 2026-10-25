'use client';

import { useState } from 'react';
import { call } from '@/lib/client/api';
import { useAction } from './useAction';
import { Card, ErrorBanner, FieldError, btnPrimary, inputCls } from './ui';

const SCORES = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1];

/** One rating per teammate per milestone. Ratings are anonymous to the person rated. */
export function PeerEvaluationForm({ projectId, milestones, teammates, given }: {
  projectId: number; milestones: { milestone_id: number; sequence_no: number; title: string }[];
  teammates: { user_id: number; name: string }[]; given: { milestone_id: number | null; evaluatee_id: number }[];
}) {
  const { busy, error, fields, run } = useAction();
  const [milestoneId, setMilestoneId] = useState<number | ''>(milestones[0]?.milestone_id ?? '');
  const [draft, setDraft] = useState<Record<number, { score: string; comments: string }>>({});
  if (milestones.length === 0) return <Card><h2 className="mb-1 font-medium">Rate your teammates</h2><p className="text-sm text-slate-500">Ratings open once a milestone has started.</p></Card>;
  const done = (uid: number) => given.some((g) => g.evaluatee_id === uid && g.milestone_id === milestoneId);
  return (
    <Card>
      <h2 className="mb-1 font-medium">Rate your teammates</h2>
      <p className="mb-3 text-sm text-slate-600">One rating per teammate for each milestone. The person you rate sees only an anonymous average, never who rated them.</p>
      <label className="mb-3 block text-sm font-medium">Milestone (evaluation period)
        <select value={milestoneId} onChange={(e) => setMilestoneId(Number(e.target.value) || '')} className={inputCls}>{milestones.map((m) => <option key={m.milestone_id} value={m.milestone_id}>M{m.sequence_no} {m.title}</option>)}</select>
      </label>
      <ul className="divide-y">
        {teammates.map((t) => {
          const d = draft[t.user_id] ?? { score: '4', comments: '' };
          return (
            <li key={t.user_id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              <span className="w-40 font-medium">{t.name}</span>
              {done(t.user_id) ? <span className="text-green-700">✓ Rated for this milestone</span> : (
                <>
                  <select aria-label={`Score for ${t.name}`} value={d.score} onChange={(e) => setDraft({ ...draft, [t.user_id]: { ...d, score: e.target.value } })} className={`${inputCls} !mt-0 !w-20 !py-1`}>{SCORES.map((s) => <option key={s}>{s}</option>)}</select>
                  <input aria-label={`Comment for ${t.name}`} value={d.comments} onChange={(e) => setDraft({ ...draft, [t.user_id]: { ...d, comments: e.target.value } })} maxLength={500} placeholder="Optional comment" className={`${inputCls} !mt-0 flex-1 !py-1`} />
                  <button disabled={busy || !milestoneId} className={btnPrimary} onClick={() => run(() => call('POST', `/api/projects/${projectId}/peer-evaluations`, { milestoneId, evaluateeId: t.user_id, score: Number(d.score), comments: d.comments || undefined }))}>Save rating</button>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {Object.values(fields).map((m, i) => <FieldError key={i} message={m} />)}
      <div className="mt-2"><ErrorBanner message={error} /></div>
    </Card>
  );
}
