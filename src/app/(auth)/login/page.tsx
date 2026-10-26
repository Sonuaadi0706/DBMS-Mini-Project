'use client';

import { Suspense, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '@/components/icons';
import { Logo } from '@/components/Logo';
import { Pulse } from '@/components/viz/Pulse';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { ErrorBanner } from '@/components/ui';

// Demo shortcuts only fill the e-mail field; the password is never shown or stored here.
const DEMO = [
  { role: 'Student', email: 'student01@projectpulse.test' },
  { role: 'Faculty guide', email: 'guide1@projectpulse.test' },
  { role: 'Reviewer', email: 'reviewer1@projectpulse.test' },
  { role: 'Admin', email: 'admin@projectpulse.test' },
];

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get('next') || '/dashboard';
  const emailRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
    });
    if (res.ok) {
      setDone(true);
      // Only follow same-site relative paths (avoids open redirects through ?next=).
      router.replace(next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard');
      router.refresh();
      return;
    }
    const body = await res.json().catch(() => null);
    setError(body?.error?.message ?? 'Sign-in failed. Please try again.');
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="email">Email</label>
        <div className="relative">
          <Icon name="mail" className="pointer-events-none absolute left-3.5 top-1/2 mt-0.5 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
          <input id="email" ref={emailRef} name="email" type="email" required autoComplete="username" placeholder="you@college.edu" className="mt-1 w-full !pl-11" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="password">Password</label>
        <div className="relative">
          <Icon name="lock" className="pointer-events-none absolute left-3.5 top-1/2 mt-0.5 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
          <input id="password" name="password" type={show ? 'text' : 'password'} required autoComplete="current-password" placeholder="••••••••" className="mt-1 w-full !pl-11 !pr-12" />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}
            className="absolute right-2 top-1/2 mt-0.5 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:text-slate-700">
            <Icon name={show ? 'eyeoff' : 'eye'} className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
      <ErrorBanner message={error} />
      <button disabled={busy || done} className="btn btn-primary w-full !py-2.5">
        {done ? <><Icon name="check" className="h-4 w-4" />Signed in</> : busy ? <><span className="spinner" />Signing in…</> : <>Sign in<Icon name="arrow" className="h-4 w-4" /></>}
      </button>
      <div>
        <div className="mb-2 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-slate-400"><span className="h-px flex-1 bg-slate-200" />Demo accounts<span className="h-px flex-1 bg-slate-200" /></div>
        <div className="grid grid-cols-2 gap-2">
          {DEMO.map((d) => (
            <button key={d.email} type="button" onClick={() => { if (emailRef.current) { emailRef.current.value = d.email; emailRef.current.focus(); } }}
              className="rounded-lg border border-slate-200 bg-surface px-3 py-2 text-left text-xs text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900">
              <span className="block font-medium">{d.role}</span><span className="block truncate text-slate-400">{d.email.split('@')[0]}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-center text-[11px] text-slate-400">Fills the email only. The demo password is in your local <code className="font-mono">.env</code>.</p>
      </div>
    </form>
  );
}

const POINTS: { icon: 'pulse' | 'similarity' | 'shield'; title: string; text: string }[] = [
  { icon: 'pulse', title: 'Early risk warning', text: 'An explainable score from milestones, tasks, feedback and contribution.' },
  { icon: 'similarity', title: 'Originality check', text: 'Semantic search flags overlapping proposals for faculty review.' },
  { icon: 'shield', title: 'Accountable by design', text: 'Atomic submissions, role-based access and a full audit trail.' },
];

export default function LoginPage() {
  return (
    <main className="relative grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="absolute right-4 top-4 z-10"><ThemeToggle /></div>

      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-slate-200 bg-surface p-12 lg:flex">
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 70% 50% at 20% 0%, rgb(var(--c-brand-500) / .10), transparent 70%), radial-gradient(ellipse 60% 40% at 100% 100%, rgb(var(--c-brand-500) / .06), transparent 70%)' }} />
        <div className="relative"><Logo size={34} /></div>
        <div className="relative max-w-lg">
          <div className="-ml-2 mb-8"><Pulse level="low" width={420} height={64} /></div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-slate-900 xl:text-5xl">See project trouble<br /><span className="text-indigo-600">before it becomes failure.</span></h1>
          <p className="mt-4 text-base text-slate-600">One place for proposals, milestones, contribution and risk, so faculty can step in while there is still time to fix things.</p>
          <ul className="mt-10 space-y-5">
            {POINTS.map((p) => (
              <li key={p.title} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600"><Icon name={p.icon} className="h-[18px] w-[18px]" /></span>
                <div><div className="text-sm font-medium text-slate-900">{p.title}</div><div className="text-sm text-slate-500">{p.text}</div></div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-400">DBMS Experiential Learning · PostgreSQL, pgvector and MongoDB</p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-8 lg:hidden"><Logo size={34} /></div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Sign in</h2>
          <p className="mb-8 mt-1 text-sm text-slate-500">Use your college account to continue.</p>
          <Suspense><LoginForm /></Suspense>
        </div>
      </section>
    </main>
  );
}
