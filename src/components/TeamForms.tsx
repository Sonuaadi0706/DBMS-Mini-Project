'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { call } from '@/lib/client/api';
import { useAction } from './useAction';
import { Card, ErrorBanner, FieldError, btnDanger, btnGhost, btnPrimary, inputCls } from './ui';

interface Course { course_id: number; course_name: string }
interface Candidate { user_id: number; name: string; identifier: string | null }

/** Students create a team and become its leader. Admins also pick the members (first = leader). */
export function CreateTeamForm({ courses, isAdmin }: { courses: Course[]; isAdmin: boolean }) {
  const router = useRouter();
  const { busy, error, fields, run } = useAction();
  const [courseId, setCourseId] = useState<number | ''>('');
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<number[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  useEffect(() => {
    setPicked([]); setCandidates([]);
    if (isAdmin && courseId) call<{ students: Candidate[] }>('GET', `/api/teams/candidates?courseId=${courseId}`).then((r) => setCandidates(r.students)).catch(() => undefined);
  }, [courseId, isAdmin]);

  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Card>
      <h2 className="mb-3 font-medium">Create a team</h2>
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        run(() => call('POST', '/api/teams', { courseId, teamName: name, memberIds: picked }), {
          onDone: (r: any) => router.push(`/teams/${r.teamId}`),
        });
      }}>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm font-medium">Course
            <select value={courseId} onChange={(e) => setCourseId(Number(e.target.value) || '')} className={inputCls} required>
              <option value="">Choose a course…</option>
              {courses.map((c) => <option key={c.course_id} value={c.course_id}>{c.course_name}</option>)}
            </select>
            <FieldError message={fields.courseId} />
          </label>
          <label className="block text-sm font-medium">Team name
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} required maxLength={80} />
            <FieldError message={fields.teamName} />
          </label>
        </div>
        {isAdmin && courseId !== '' && (
          <fieldset className="text-sm">
            <legend className="font-medium">Members <span className="font-normal text-slate-500">(the first one you tick becomes the leader)</span></legend>
            <div className="mt-1 grid max-h-40 gap-1 overflow-auto md:grid-cols-2">
              {candidates.map((c) => (
                <label key={c.user_id} className="flex items-center gap-2">
                  <input type="checkbox" checked={picked.includes(c.user_id)} onChange={() => toggle(c.user_id)} />
                  {c.name} <span className="text-xs text-slate-400">{c.identifier}</span>{picked[0] === c.user_id && <span className="text-xs text-indigo-600">leader</span>}
                </label>
              ))}
              {candidates.length === 0 && <span className="text-slate-500">No unassigned students in this course.</span>}
            </div>
          </fieldset>
        )}
        <ErrorBanner message={error} />
        <button disabled={busy || !courseId || !name} className={btnPrimary}>{busy ? 'Creating…' : 'Create team'}</button>
      </form>
    </Card>
  );
}

export interface MemberView { user_id: number; name: string; email: string; identifier: string | null; member_role: string; responsibility: string | null }

export function MembersTable({ teamId, courseId, members, canManage, isAdmin }: {
  teamId: number; courseId: number; members: MemberView[]; canManage: boolean; isAdmin: boolean;
}) {
  const { busy, error, run } = useAction();
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [add, setAdd] = useState<number | ''>('');
  const [resp, setResp] = useState('');

  useEffect(() => {
    if (canManage) call<{ students: Candidate[] }>('GET', `/api/teams/candidates?courseId=${courseId}`).then((r) => setCandidates(r.students)).catch(() => undefined);
  }, [canManage, courseId, members.length]);

  return (
    <Card>
      <h2 className="mb-3 font-medium">Members</h2>
      <table className="w-full text-left text-sm">
        <thead className="border-b text-xs uppercase text-slate-500"><tr><th className="py-2">Name</th><th>Role</th><th>Responsibility</th><th /></tr></thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.user_id} className="border-b last:border-0 align-top">
              <td className="py-2"><div className="font-medium">{m.name}</div><div className="text-xs text-slate-500">{m.identifier ?? m.email}</div></td>
              <td className="py-2">{m.member_role === 'leader' ? <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs text-indigo-800">Leader</span> : 'Member'}</td>
              <td className="py-2">
                {canManage ? (
                  <div className="flex gap-2">
                    <input value={edits[m.user_id] ?? m.responsibility ?? ''} onChange={(e) => setEdits({ ...edits, [m.user_id]: e.target.value })}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-sm" placeholder="e.g. Backend and database" />
                    {edits[m.user_id] !== undefined && edits[m.user_id] !== (m.responsibility ?? '') && (
                      <button disabled={busy} className={btnGhost} onClick={() => run(() => call('PATCH', `/api/teams/${teamId}/members/${m.user_id}`, { responsibility: edits[m.user_id] }), { onDone: () => setEdits({}) })}>Save</button>
                    )}
                  </div>
                ) : (m.responsibility ?? <span className="text-slate-400">—</span>)}
              </td>
              <td className="py-2 text-right">
                {canManage && (m.member_role !== 'leader' || isAdmin) && (
                  <button disabled={busy} className={btnDanger} onClick={() => confirm(`Remove ${m.name} from the team?`) && run(() => call('DELETE', `/api/teams/${teamId}/members/${m.user_id}`))}>Remove</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {canManage && (
        <form className="mt-4 flex flex-wrap items-end gap-2 border-t pt-4" onSubmit={(e) => {
          e.preventDefault();
          run(() => call('POST', `/api/teams/${teamId}/members`, { userId: add, responsibility: resp }), { onDone: () => { setAdd(''); setResp(''); } });
        }}>
          <label className="text-sm font-medium">Add a student
            <select value={add} onChange={(e) => setAdd(Number(e.target.value) || '')} className={inputCls}>
              <option value="">Choose…</option>
              {candidates.map((c) => <option key={c.user_id} value={c.user_id}>{c.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Responsibility
            <input value={resp} onChange={(e) => setResp(e.target.value)} className={inputCls} maxLength={200} />
          </label>
          <button disabled={busy || !add} className={btnPrimary}>Add</button>
        </form>
      )}
      <div className="mt-2"><ErrorBanner message={error} /></div>
    </Card>
  );
}
