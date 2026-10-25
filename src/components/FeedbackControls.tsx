'use client';

import { useEffect, useState } from 'react';
import { call } from '@/lib/client/api';
import { useAction } from './useAction';
import { Card, ErrorBanner, FieldError, StatusChip, btnGhost, btnPrimary, inputCls, label } from './ui';

const DEFAULT_CRITERIA = ['Completeness', 'Technical quality', 'Clarity and structure', 'Adherence to plan'];
export const THEMES = ['documentation', 'requirements', 'design', 'implementation', 'testing', 'presentation', 'other'];

/** The reviewer's rubric and comments. total = sum(score) / sum(max) x 100 is computed on the server. */
export function ReviewEditor({ reviewId, comments, scores, isGuide, decision }: {
  reviewId: number; comments: string | null; scores: { criterion: string; maxScore: number; score: number }[]; isGuide: boolean; decision: string;
}) {
  const { busy, error, fields, run } = useAction();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(scores.length ? scores : DEFAULT_CRITERIA.map((criterion) => ({ criterion, maxScore: 25, score: 0 })));
  const [text, setText] = useState(comments ?? '');
  const [rec, setRec] = useState('');
  if (!open) return <button className={btnGhost} onClick={() => setOpen(true)}>{scores.length ? 'Edit rubric and comments' : 'Fill in rubric and comments'}</button>;
  const setRow = (i: number, k: 'criterion' | 'maxScore' | 'score', v: string) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, [k]: k === 'criterion' ? v : Number(v) } : r)));
  return (
    <div className="space-y-3 rounded bg-slate-50 p-3">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-slate-500"><tr><th>Criterion</th><th className="w-24">Score</th><th className="w-24">Out of</th></tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i}>
            <td className="pr-2"><input value={r.criterion} onChange={(e) => setRow(i, 'criterion', e.target.value)} className={`${inputCls} !mt-0 !py-1`} /></td>
            <td className="pr-2"><input type="number" min={0} value={r.score} onChange={(e) => setRow(i, 'score', e.target.value)} className={`${inputCls} !mt-0 !py-1`} /></td>
            <td><input type="number" min={1} value={r.maxScore} onChange={(e) => setRow(i, 'maxScore', e.target.value)} className={`${inputCls} !mt-0 !py-1`} /></td>
          </tr>))}</tbody>
      </table>
      {Object.entries(fields).map(([k, m]) => <FieldError key={k} message={m} />)}
      <label className="block text-sm font-medium">Comments<textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className={inputCls} /></label>
      {!isGuide && decision === 'pending' && (
        <label className="block text-sm font-medium">Your recommendation
          <select value={rec} onChange={(e) => setRec(e.target.value)} className={inputCls}>
            <option value="">Not yet</option><option value="approved">Approve</option><option value="revision_requested">Request revision</option><option value="rejected">Reject</option>
          </select>
        </label>
      )}
      <ErrorBanner message={error} />
      <div className="flex gap-2">
        <button disabled={busy} className={btnPrimary} onClick={() => run(() => call('PATCH', `/api/reviews/${reviewId}`, { comments: text, scores: rows, ...(rec ? { decision: rec } : {}) }), { onDone: () => setOpen(false) })}>{busy ? 'Saving…' : 'Save review'}</button>
        <button className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {isGuide && <p className="text-xs text-slate-500">The guide&apos;s final decision is made on the Milestones tab; it also moves the milestone.</p>}
    </div>
  );
}

export function NewFeedbackForm({ reviewId, people }: { reviewId: number; people: { user_id: number; name: string }[] }) {
  const { busy, error, fields, run } = useAction();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ assignedUserId: '', description: '', severity: 'minor', dueDate: '', theme: 'other' });
  if (!open) return <button className={btnGhost} onClick={() => setOpen(true)}>Add feedback item</button>;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="grid gap-3 rounded bg-slate-50 p-3 md:grid-cols-4" onSubmit={(e) => {
      e.preventDefault();
      run(() => call('POST', `/api/reviews/${reviewId}/feedback`, { assignedUserId: Number(f.assignedUserId), description: f.description, severity: f.severity, dueDate: f.dueDate || null, theme: f.theme }), { onDone: () => { setOpen(false); setF({ ...f, description: '' }); } });
    }}>
      <label className="text-sm font-medium md:col-span-4">Feedback<textarea value={f.description} onChange={set('description')} rows={2} className={inputCls} /><FieldError message={fields.description} /></label>
      <label className="text-sm font-medium">Assign to<select value={f.assignedUserId} onChange={set('assignedUserId')} className={inputCls} required><option value="">Choose…</option>{people.map((p) => <option key={p.user_id} value={p.user_id}>{p.name}</option>)}</select><FieldError message={fields.assignedUserId} /></label>
      <label className="text-sm font-medium">Severity<select value={f.severity} onChange={set('severity')} className={inputCls}><option>minor</option><option>major</option><option>critical</option></select></label>
      <label className="text-sm font-medium">Due date<input type="date" value={f.dueDate} onChange={set('dueDate')} className={inputCls} /><FieldError message={fields.dueDate} /></label>
      <label className="text-sm font-medium">Theme<select value={f.theme} onChange={set('theme')} className={inputCls}>{THEMES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</select></label>
      <div className="md:col-span-4"><ErrorBanner message={error} /></div>
      <div className="flex gap-2 md:col-span-4"><button disabled={busy} className={btnPrimary}>Create feedback</button><button type="button" className={btnGhost} onClick={() => setOpen(false)}>Cancel</button></div>
    </form>
  );
}

interface Msg { authorName: string; role: string; text: string; at: string }

export function ThreadPanel({ feedbackId, canPost }: { feedbackId: number; canPost: boolean }) {
  const { busy, error, run } = useAction();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [text, setText] = useState('');
  const load = () => call<{ messages: Msg[] }>('GET', `/api/feedback/${feedbackId}/thread`).then((r) => setMsgs(r.messages)).catch(() => setMsgs([]));
  useEffect(() => { if (open && msgs === null) load(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="mt-2">
      <button className="text-xs text-indigo-700 underline" onClick={() => setOpen(!open)}>{open ? 'Hide discussion' : 'Discussion'}</button>
      {open && (
        <div className="mt-2 space-y-2 rounded bg-slate-50 p-3">
          {msgs === null ? <p className="text-xs text-slate-500">Loading…</p> : msgs.length === 0 ? <p className="text-xs text-slate-500">No messages yet.</p> : msgs.map((m, i) => (
            <div key={i} className="text-sm"><span className="font-medium">{m.authorName}</span> <span className="text-xs text-slate-500">({label(m.role)}, {new Date(m.at).toLocaleDateString()})</span><p className="whitespace-pre-line text-slate-700">{m.text}</p></div>
          ))}
          {canPost && (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => call('POST', `/api/feedback/${feedbackId}/thread`, { text }), { refresh: false, onDone: () => { setText(''); load(); } }); }}>
              <input value={text} onChange={(e) => setText(e.target.value)} className={`${inputCls} !mt-0`} placeholder="Write a message…" />
              <button disabled={busy || !text.trim()} className={btnPrimary}>Send</button>
            </form>
          )}
          <ErrorBanner message={error} />
        </div>
      )}
    </div>
  );
}

/** Student (assignee): respond / resolve. Guide: verify / reopen. The API repeats these checks. */
export function FeedbackActions({ feedbackId, status, isAssignee, isGuide }: { feedbackId: number; status: string; isAssignee: boolean; isGuide: boolean }) {
  const { busy, error, fields, run } = useAction();
  const [text, setText] = useState('');
  const [comment, setComment] = useState('');
  const post = (action: string, body: object) => run(() => call('POST', `/api/feedback/${feedbackId}/${action}`, body), { onDone: () => { setText(''); setComment(''); } });
  const canWork = isAssignee && ['open', 'in_progress', 'reopened'].includes(status);
  return (
    <div className="mt-2 space-y-2">
      {canWork && (
        <>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} className={inputCls} placeholder="What did you change? (required to resolve)" />
          <FieldError message={fields.responseText} />
          <div className="flex gap-2">
            <button disabled={busy || !text.trim()} className={btnGhost} onClick={() => post('respond', { responseText: text })}>Save response</button>
            <button disabled={busy} className={btnPrimary} onClick={() => post('resolve', text.trim() ? { responseText: text } : {})}>Mark resolved</button>
          </div>
        </>
      )}
      {isGuide && status === 'resolved' && (
        <>
          <input value={comment} onChange={(e) => setComment(e.target.value)} className={inputCls} placeholder="Reason, if you reopen it" />
          <div className="flex gap-2">
            <button disabled={busy} className={btnPrimary} onClick={() => post('verify', {})}>Verify fix</button>
            <button disabled={busy} className={btnGhost} onClick={() => post('reopen', comment ? { comment } : {})}>Reopen</button>
          </div>
        </>
      )}
      <ErrorBanner message={error} />
    </div>
  );
}

export { StatusChip, Card };
