'use client';

import { useState } from 'react';
import { call } from '@/lib/client/api';
import { useAction } from './useAction';
import { Card, ErrorBanner, FieldError, btnDanger, btnGhost, btnPrimary, inputCls, label } from './ui';

/** Student: "Check originality". The server answers yes/no only, so nothing about other teams can leak here. */
export function OriginalityCheck({ projectId }: { projectId: number }) {
  const { busy, error, run } = useAction();
  const [result, setResult] = useState<{ possibleOverlap: boolean; message: string } | null>(null);
  return (
    <Card>
      <h2 className="mb-1 font-medium">Check originality</h2>
      <p className="mb-3 text-sm text-slate-600">Compares your <em>saved</em> proposal with the others in your course by meaning. It never shows you other teams&apos; work; faculty review any overlap.</p>
      <button disabled={busy} className={btnGhost} onClick={() => { setResult(null); run(() => call<{ possibleOverlap: boolean; message: string }>('POST', '/api/similarity/check', { projectId }), { refresh: false, onDone: setResult }); }}>
        {busy ? 'Checking… (the first check loads the model)' : 'Check originality'}
      </button>
      {result && <p role="status" className={`mt-3 rounded p-2 text-sm ${result.possibleOverlap ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-800'}`}>{result.message}</p>}
      <div className="mt-2"><ErrorBanner message={error} /></div>
    </Card>
  );
}

const DECISIONS: [string, string][] = [['not_similar', 'Not similar'], ['acceptable_overlap', 'Acceptable overlap'], ['needs_revision', 'Needs revision'], ['escalated', 'Escalate']];

/** The faculty decision. Asking for revision or escalating needs an explanation. */
export function DecisionForm({ similarityId, current }: { similarityId: number; current: string }) {
  const { busy, error, fields, run } = useAction();
  const [comments, setComments] = useState('');
  const options = DECISIONS.filter(([d]) => !(current === 'escalated' && d === 'escalated'));
  return (
    <div className="space-y-2">
      <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={2} className={inputCls} placeholder="Comments (required to ask for revision or escalate)" />
      <FieldError message={fields.comments} />
      <div className="flex flex-wrap gap-2">
        {options.map(([d, text]) => (
          <button key={d} disabled={busy} className={d === 'needs_revision' || d === 'escalated' ? btnDanger : d === 'not_similar' ? btnPrimary : btnGhost}
            onClick={() => run(() => call('POST', `/api/similarity/reviews/${similarityId}/decision`, { decision: d, comments }))}>{text}</button>
        ))}
      </div>
      <ErrorBanner message={error} />
    </div>
  );
}

interface Hit { project_id: number; title: string; team_name: string; course_name: string; section: string; similarity: number; excerpt: string }

/** Faculty: find proposals by meaning, e.g. "hospital waiting time" finds the clinic project without sharing a word. */
export function SemanticSearch() {
  const { busy, error, fields, run } = useAction();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  return (
    <Card>
      <h2 className="mb-1 font-medium">Search proposals by meaning</h2>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => call<{ results: Hit[] }>('POST', '/api/similarity/search', { query: q, k: 5 }), { refresh: false, onDone: (r) => setHits(r.results) }); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} className={`${inputCls} !mt-0`} placeholder="e.g. reducing waiting time at a health centre" />
        <button disabled={busy || q.trim().length < 3} className={btnPrimary}>{busy ? 'Searching…' : 'Search'}</button>
      </form>
      <FieldError message={fields.query} />
      <ErrorBanner message={error} />
      {hits && (hits.length === 0 ? <p className="mt-3 text-sm text-slate-500">No proposals found.</p> : (
        <ul className="mt-3 divide-y text-sm">
          {hits.map((h) => (
            <li key={h.project_id} className="py-2">
              <div className="flex items-center justify-between gap-2"><a className="font-medium text-indigo-700 hover:underline" href={`/proposals/${h.project_id}`}>{h.title}</a><span className="tabular-nums text-slate-600">{Math.round(h.similarity * 100)}% match</span></div>
              <div className="text-xs text-slate-500">Team {h.team_name} · {h.course_name} · best match in {label(h.section)}</div>
              <p className="mt-1 line-clamp-2 text-slate-600">{h.excerpt}</p>
            </li>
          ))}
        </ul>
      ))}
    </Card>
  );
}
