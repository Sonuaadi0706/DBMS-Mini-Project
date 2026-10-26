'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { call } from '@/lib/client/api';
import { useAction } from './useAction';
import { Card, ErrorBanner, FieldError, btnPrimary, inputCls } from './ui';

export function ProfileForm({ name }: { name: string }) {
  const router = useRouter();
  const { busy, error, fields, run } = useAction();
  const [v, setV] = useState(name);
  const [saved, setSaved] = useState(false);
  return (
    <Card>
      <h2 className="mb-3 font-medium">Display name</h2>
      <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => {
        e.preventDefault(); setSaved(false);
        run(() => call('PATCH', '/api/auth/profile', { name: v }), { onDone: () => { setSaved(true); router.refresh(); } });
      }}>
        <label className="flex-1 text-sm font-medium">Name
          <input value={v} onChange={(e) => setV(e.target.value)} className={inputCls} maxLength={120} required />
          <FieldError message={fields.name} />
        </label>
        <button disabled={busy || v.trim() === name} className={btnPrimary}>{busy ? 'Saving…' : 'Save'}</button>
      </form>
      {saved && <p className="mt-2 text-sm text-green-700">Name updated.</p>}
      <div className="mt-2"><ErrorBanner message={error} /></div>
    </Card>
  );
}

export function PasswordForm() {
  const { busy, error, fields, run } = useAction();
  const [f, setF] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [mismatch, setMismatch] = useState(false);
  const [saved, setSaved] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Card>
      <h2 className="mb-3 font-medium">Change password</h2>
      <form className="grid gap-3 md:grid-cols-3" onSubmit={(e) => {
        e.preventDefault(); setSaved(false);
        if (f.newPassword !== f.confirm) { setMismatch(true); return; }
        setMismatch(false);
        run(() => call('POST', '/api/auth/change-password', { currentPassword: f.currentPassword, newPassword: f.newPassword }), { onDone: () => { setSaved(true); setF({ currentPassword: '', newPassword: '', confirm: '' }); } });
      }}>
        <label className="text-sm font-medium">Current password
          <input type="password" value={f.currentPassword} onChange={set('currentPassword')} className={inputCls} autoComplete="current-password" required />
          <FieldError message={fields.currentPassword} /></label>
        <label className="text-sm font-medium">New password
          <input type="password" value={f.newPassword} onChange={set('newPassword')} className={inputCls} autoComplete="new-password" required />
          <FieldError message={fields.newPassword} /></label>
        <label className="text-sm font-medium">Confirm new password
          <input type="password" value={f.confirm} onChange={set('confirm')} className={inputCls} autoComplete="new-password" required />
          <FieldError message={mismatch ? 'The two passwords do not match.' : undefined} /></label>
        <p className="text-xs text-slate-500 md:col-span-3">At least 8 characters, with a letter and a digit.</p>
        <div className="md:col-span-3"><ErrorBanner message={error} /></div>
        <div className="md:col-span-3"><button disabled={busy} className={btnPrimary}>{busy ? 'Saving…' : 'Update password'}</button>{saved && <span className="ml-3 text-sm text-green-700">Password updated.</span>}</div>
      </form>
    </Card>
  );
}
