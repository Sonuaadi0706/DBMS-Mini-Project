'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icons';
import { Logo } from '@/components/Logo';
import { ThemeApply } from '@/components/shell/ThemeApply';
import { ErrorBanner, FieldError } from '@/components/ui';

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null); setFields({});
    const f = new FormData(e.currentTarget);
    if (f.get('password') !== f.get('confirm')) { setFields({ confirm: 'The two passwords do not match.' }); return; }
    setBusy(true);
    const res = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: f.get('name'), email: f.get('email'), identifier: f.get('identifier') || null, password: f.get('password') }),
    });
    if (res.ok) { router.replace('/dashboard'); router.refresh(); return; }
    const body = await res.json().catch(() => null);
    setError(body?.error?.message ?? 'Could not create the account. Please try again.');
    setFields(body?.error?.fields ?? {});
    setBusy(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <ThemeApply mode="light" />
      <div className="w-full max-w-md animate-fade-up">
        <div className="mb-8"><Logo size={34} /></div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Create a student account</h1>
        <p className="mb-8 mt-1 text-sm text-slate-500">Faculty guides, reviewers and administrators are added by an administrator.</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">Full name
            <input name="name" required minLength={2} maxLength={120} autoComplete="name" className="mt-1 w-full" /><FieldError message={fields.name} /></label>
          <label className="block text-sm font-medium text-slate-700">Email
            <input name="email" type="email" required autoComplete="username" className="mt-1 w-full" /><FieldError message={fields.email} /></label>
          <label className="block text-sm font-medium text-slate-700">USN <span className="font-normal text-slate-400">(optional)</span>
            <input name="identifier" maxLength={30} className="mt-1 w-full" /><FieldError message={fields.identifier} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">Password
              <input name="password" type="password" required autoComplete="new-password" className="mt-1 w-full" /><FieldError message={fields.password} /></label>
            <label className="block text-sm font-medium text-slate-700">Confirm password
              <input name="confirm" type="password" required autoComplete="new-password" className="mt-1 w-full" /><FieldError message={fields.confirm} /></label>
          </div>
          <p className="text-xs text-slate-500">At least 8 characters, with a letter and a digit.</p>
          <ErrorBanner message={error} />
          <button disabled={busy} className="btn btn-primary w-full !py-2.5">{busy ? <><span className="spinner" />Creating account…</> : <>Create account<Icon name="arrow" className="h-4 w-4" /></>}</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">Already have an account? <Link href="/login" className="font-medium text-slate-900 underline">Sign in</Link></p>
      </div>
    </main>
  );
}
