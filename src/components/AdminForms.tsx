'use client';

import { useState } from 'react';
import { call } from '@/lib/client/api';
import { useAction } from './useAction';
import { Card, ErrorBanner, FieldError, btnDanger, btnGhost, btnPrimary, inputCls, label } from './ui';

const ROLES = ['student', 'faculty_guide', 'reviewer', 'admin'] as const;
const TYPES = ['proposal', 'srs', 'design_doc', 'source_code', 'screenshot', 'test_report', 'presentation', 'final_report', 'other'];
interface Dept { dept_id: number; dept_code: string; dept_name: string }

export function CreateUserForm({ departments }: { departments: Dept[] }) {
  const { busy, error, fields, run } = useAction();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', email: '', password: '', deptId: '', identifier: '' });
  const [roles, setRoles] = useState<string[]>(['student']);
  if (!open) return <button className={btnPrimary} onClick={() => setOpen(true)}>Add user</button>;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Card>
      <form className="grid gap-3 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); run(() => call('POST', '/api/admin/users', { ...f, deptId: f.deptId ? Number(f.deptId) : null, identifier: f.identifier || null, roles }), { onDone: () => { setOpen(false); setF({ name: '', email: '', password: '', deptId: '', identifier: '' }); } }); }}>
        <label className="text-sm font-medium">Name<input value={f.name} onChange={set('name')} className={inputCls} /><FieldError message={fields.name} /></label>
        <label className="text-sm font-medium">Email<input value={f.email} onChange={set('email')} className={inputCls} autoComplete="off" /><FieldError message={fields.email} /></label>
        <label className="text-sm font-medium">Temporary password<input type="password" value={f.password} onChange={set('password')} className={inputCls} autoComplete="new-password" /><FieldError message={fields.password} /></label>
        <label className="text-sm font-medium">Department<select value={f.deptId} onChange={set('deptId')} className={inputCls}><option value="">None</option>{departments.map((d) => <option key={d.dept_id} value={d.dept_id}>{d.dept_code}</option>)}</select></label>
        <label className="text-sm font-medium">USN / employee id<input value={f.identifier} onChange={set('identifier')} className={inputCls} /><FieldError message={fields.identifier} /></label>
        <fieldset className="text-sm"><legend className="font-medium">Roles</legend>
          {ROLES.map((r) => <label key={r} className="mr-3 inline-flex items-center gap-1"><input type="checkbox" checked={roles.includes(r)} onChange={() => setRoles(roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r])} />{label(r)}</label>)}
          <FieldError message={fields.roles} /></fieldset>
        <div className="md:col-span-3"><ErrorBanner message={error} /></div>
        <div className="flex gap-2 md:col-span-3"><button disabled={busy} className={btnPrimary}>Create user</button><button type="button" className={btnGhost} onClick={() => setOpen(false)}>Cancel</button></div>
      </form>
    </Card>
  );
}

export function UserActions({ userId, roles, status, isSelf }: { userId: number; roles: string[]; status: string; isSelf: boolean }) {
  const { busy, error, fields, run } = useAction();
  const [pw, setPw] = useState('');
  const [st, setSt] = useState(status);
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-indigo-700">Manage</summary>
      <div className="mt-2 w-72 space-y-3 rounded bg-slate-50 p-3">
        <div><div className="mb-1 font-semibold text-slate-600">Roles (click to add or remove)</div>
          <div className="flex flex-wrap gap-1">{ROLES.map((r) => { const has = roles.includes(r); return (
            <button key={r} disabled={busy} onClick={() => run(() => call('POST', `/api/admin/users/${userId}/roles`, { role: r, op: has ? 'remove' : 'add' }))}
              className={`rounded-full border px-2 py-0.5 ${has ? 'border-indigo-300 bg-indigo-100 text-indigo-800' : 'bg-white text-slate-500'}`}>{has ? '✓ ' : '+ '}{label(r)}</button>); })}</div></div>
        <div className="flex items-end gap-2"><label className="flex-1 font-semibold text-slate-600">Account status
          <select value={st} onChange={(e) => setSt(e.target.value)} disabled={isSelf} className={`${inputCls} !py-1`}><option>active</option><option>inactive</option><option>suspended</option></select></label>
          <button disabled={busy || st === status || isSelf} className={btnGhost} onClick={() => run(() => call('PATCH', `/api/admin/users/${userId}`, { status: st }))}>Save</button></div>
        <div><label className="font-semibold text-slate-600">Reset password<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className={`${inputCls} !py-1`} autoComplete="new-password" placeholder="New temporary password" /></label>
          <FieldError message={fields.newPassword} />
          <button disabled={busy || !pw} className={`${btnDanger} mt-1`} onClick={() => run(() => call('PATCH', `/api/admin/users/${userId}`, { newPassword: pw }), { onDone: () => setPw('') })}>Set new password</button></div>
        <ErrorBanner message={error} />
      </div>
    </details>
  );
}

export function DepartmentManager({ departments }: { departments: (Dept & { courses: number; users: number })[] }) {
  const { busy, error, fields, run } = useAction();
  const [add, setAdd] = useState({ code: '', name: '' });
  const [edit, setEdit] = useState<Record<number, { code: string; name: string }>>({});
  return (
    <div className="space-y-4">
      <Card className="overflow-x-auto !p-0"><table className="w-full text-left text-sm">
        <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-2">Code</th><th className="p-2">Name</th><th className="p-2">Courses</th><th className="p-2">Users</th><th className="p-2" /></tr></thead>
        <tbody>{departments.map((d) => { const e = edit[d.dept_id]; return (
          <tr key={d.dept_id} className="border-b last:border-0">
            <td className="p-2">{e ? <input value={e.code} onChange={(x) => setEdit({ ...edit, [d.dept_id]: { ...e, code: x.target.value } })} className={`${inputCls} !mt-0 !w-24 !py-1`} /> : d.dept_code}</td>
            <td className="p-2">{e ? <input value={e.name} onChange={(x) => setEdit({ ...edit, [d.dept_id]: { ...e, name: x.target.value } })} className={`${inputCls} !mt-0 !py-1`} /> : d.dept_name}</td>
            <td className="p-2">{d.courses}</td><td className="p-2">{d.users}</td>
            <td className="space-x-2 p-2 text-right">
              {e ? <><button disabled={busy} className={btnPrimary} onClick={() => run(() => call('PATCH', `/api/admin/departments/${d.dept_id}`, e), { onDone: () => setEdit({}) })}>Save</button><button className={btnGhost} onClick={() => setEdit({})}>Cancel</button></>
                : <><button className={btnGhost} onClick={() => setEdit({ [d.dept_id]: { code: d.dept_code, name: d.dept_name } })}>Edit</button><button disabled={busy} className={btnDanger} onClick={() => confirm(`Delete ${d.dept_code}?`) && run(() => call('DELETE', `/api/admin/departments/${d.dept_id}`))}>Delete</button></>}
            </td></tr>); })}</tbody></table></Card>
      <Card><h2 className="mb-2 font-medium">Add a department</h2>
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); run(() => call('POST', '/api/admin/departments', add), { onDone: () => setAdd({ code: '', name: '' }) }); }}>
          <label className="text-sm font-medium">Code<input value={add.code} onChange={(e) => setAdd({ ...add, code: e.target.value })} className={`${inputCls} !w-28`} maxLength={10} /><FieldError message={fields.code} /></label>
          <label className="flex-1 text-sm font-medium">Name<input value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} className={inputCls} /><FieldError message={fields.name} /></label>
          <button disabled={busy} className={btnPrimary}>Add</button></form>
        <div className="mt-2"><ErrorBanner message={error} /></div></Card>
    </div>
  );
}

export function CourseManager({ courses, departments }: { courses: { course_id: number; dept_code: string; course_code: string; course_name: string; semester: string; academic_year: string; is_active: boolean; teams: number }[]; departments: Dept[] }) {
  const { busy, error, fields, run } = useAction();
  const [f, setF] = useState({ deptId: String(departments[0]?.dept_id ?? ''), code: '', name: '', semester: 'Sem 5', academicYear: '' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="space-y-4">
      <Card className="overflow-x-auto !p-0"><table className="w-full text-left text-sm">
        <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-2">Code</th><th className="p-2">Course</th><th className="p-2">Semester</th><th className="p-2">Teams</th><th className="p-2">Status</th><th className="p-2" /></tr></thead>
        <tbody>{courses.map((c) => (
          <tr key={c.course_id} className="border-b last:border-0"><td className="p-2">{c.dept_code} · {c.course_code}</td><td className="p-2">{c.course_name}</td><td className="p-2">{c.semester}, {c.academic_year}</td><td className="p-2">{c.teams}</td>
            <td className="p-2">{c.is_active ? <span className="text-green-700">Active</span> : <span className="text-slate-500">Archived</span>}</td>
            <td className="space-x-2 p-2 text-right"><button disabled={busy} className={btnGhost} onClick={() => run(() => call('PATCH', `/api/admin/courses/${c.course_id}`, { isActive: !c.is_active }))}>{c.is_active ? 'Archive' : 'Reactivate'}</button>
              <button disabled={busy} className={btnDanger} onClick={() => confirm(`Delete ${c.course_name}?`) && run(() => call('DELETE', `/api/admin/courses/${c.course_id}`))}>Delete</button></td></tr>))}</tbody></table></Card>
      <Card><h2 className="mb-2 font-medium">Add a course</h2>
        <form className="grid gap-3 md:grid-cols-5" onSubmit={(e) => { e.preventDefault(); run(() => call('POST', '/api/admin/courses', { ...f, deptId: Number(f.deptId) })); }}>
          <label className="text-sm font-medium">Department<select value={f.deptId} onChange={set('deptId')} className={inputCls}>{departments.map((d) => <option key={d.dept_id} value={d.dept_id}>{d.dept_code}</option>)}</select></label>
          <label className="text-sm font-medium">Code<input value={f.code} onChange={set('code')} className={inputCls} /><FieldError message={fields.code} /></label>
          <label className="text-sm font-medium md:col-span-2">Name<input value={f.name} onChange={set('name')} className={inputCls} /><FieldError message={fields.name} /></label>
          <label className="text-sm font-medium">Semester<input value={f.semester} onChange={set('semester')} className={inputCls} /></label>
          <label className="text-sm font-medium">Academic year<input value={f.academicYear} onChange={set('academicYear')} className={inputCls} placeholder="2026-2027" /><FieldError message={fields.academicYear} /></label>
          <div className="flex items-end"><button disabled={busy} className={btnPrimary}>Add course</button></div>
          <div className="md:col-span-5"><ErrorBanner message={error} /></div></form></Card>
    </div>
  );
}

interface TplMilestone { title: string; offsetDays: number; weightage: number; requiredDeliverableTypes: string[] }
export interface TemplateView { template_id: number; name: string; description: string | null; is_active: boolean; course_id: number | null; used_by: number; milestones: TplMilestone[] }

/** Create or edit a project template. Weightages must add up to 100 or less (checked here, by the API and by the milestone trigger later). */
export function TemplateEditor({ template, courses }: { template?: TemplateView; courses: { course_id: number; course_name: string }[] }) {
  const { busy, error, fields, run } = useAction();
  const [open, setOpen] = useState(!template);
  const [name, setName] = useState(template?.name ?? '');
  const [desc, setDesc] = useState(template?.description ?? '');
  const [courseId, setCourseId] = useState(String(template?.course_id ?? ''));
  const [active, setActive] = useState(template?.is_active ?? true);
  const [rows, setRows] = useState<TplMilestone[]>(template?.milestones ?? [{ title: '', offsetDays: 14, weightage: 20, requiredDeliverableTypes: [] }]);
  const total = rows.reduce((a, r) => a + Number(r.weightage || 0), 0);
  const upd = (i: number, patch: Partial<TplMilestone>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  if (!open) return <button className={btnGhost} onClick={() => setOpen(true)}>Edit</button>;
  return (
    <form className="mt-3 space-y-3 rounded bg-slate-50 p-3" onSubmit={(e) => {
      e.preventDefault();
      const body = { name, description: desc || null, courseId: courseId ? Number(courseId) : null, isActive: active, milestones: rows.map((r) => ({ ...r, offsetDays: Number(r.offsetDays), weightage: Number(r.weightage) })) };
      run(() => (template ? call('PATCH', `/api/admin/templates/${template.template_id}`, body) : call('POST', '/api/admin/templates', body)), { onDone: () => template && setOpen(false) });
    }}>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm font-medium">Name<input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /><FieldError message={fields.name} /></label>
        <label className="text-sm font-medium">Course (optional)<select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={inputCls}><option value="">Any course</option>{courses.map((c) => <option key={c.course_id} value={c.course_id}>{c.course_name}</option>)}</select></label>
        <label className="flex items-end gap-2 pb-2 text-sm font-medium"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active (offered to teams)</label>
        <label className="text-sm font-medium md:col-span-3">Description<input value={desc} onChange={(e) => setDesc(e.target.value)} className={inputCls} /></label>
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="rounded border bg-white p-2">
            <div className="grid gap-2 md:grid-cols-[1fr_110px_110px_auto]">
              <input aria-label="Milestone title" value={r.title} onChange={(e) => upd(i, { title: e.target.value })} className={`${inputCls} !mt-0 !py-1`} placeholder={`Milestone ${i + 1} title`} />
              <input aria-label="Due after (days)" type="number" min={0} value={r.offsetDays} onChange={(e) => upd(i, { offsetDays: Number(e.target.value) })} className={`${inputCls} !mt-0 !py-1`} title="Due this many days after the project starts" />
              <input aria-label="Weightage" type="number" step="0.5" min={0} value={r.weightage} onChange={(e) => upd(i, { weightage: Number(e.target.value) })} className={`${inputCls} !mt-0 !py-1`} title="Weightage" />
              <button type="button" className={btnDanger} onClick={() => setRows(rows.filter((_, j) => j !== i))} disabled={rows.length === 1}>Remove</button>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">{TYPES.map((t) => <label key={t} className="flex items-center gap-1"><input type="checkbox" checked={r.requiredDeliverableTypes.includes(t)} onChange={() => upd(i, { requiredDeliverableTypes: r.requiredDeliverableTypes.includes(t) ? r.requiredDeliverableTypes.filter((x) => x !== t) : [...r.requiredDeliverableTypes, t] })} />{label(t)}</label>)}</div>
          </div>))}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm"><button type="button" className={btnGhost} onClick={() => setRows([...rows, { title: '', offsetDays: (rows.at(-1)?.offsetDays ?? 0) + 14, weightage: 0, requiredDeliverableTypes: [] }])} disabled={rows.length >= 12}>Add milestone</button>
        <span className={total > 100 ? 'font-medium text-red-600' : 'text-slate-600'}>Total weightage {total} / 100</span></div>
      <FieldError message={fields.milestones} />
      <ErrorBanner message={error} />
      <div className="flex gap-2"><button disabled={busy} className={btnPrimary}>{template ? 'Save template' : 'Create template'}</button>{template && <button type="button" className={btnGhost} onClick={() => setOpen(false)}>Cancel</button>}</div>
    </form>
  );
}
