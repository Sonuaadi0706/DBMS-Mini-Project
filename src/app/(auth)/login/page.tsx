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

const VITALS = [
  { label: 'Healthy', level: 'low' as const, text: 'On schedule, balanced effort', cls: 'left-0 top-2', delay: '0s' },
  { label: 'Elevated', level: 'moderate' as const, text: 'A milestone is slipping', cls: 'right-0 top-24', delay: '1.2s' },
  { label: 'Critical', level: 'critical' as const, text: 'Overdue, feedback unresolved', cls: 'left-10 top-52', delay: '2.4s' },
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
      <button disabled={busy || done} className="btn btn-primary w-full !py-3 text-base">
        {done ? <><Icon name="check" className="h-5 w-5" />Welcome back</> : busy ? <><span className="spinner" />Checking vitals…</> : <>Sign in<Icon name="arrow" className="h-5 w-5" /></>}
      </button>
      <div>
        <div className="mb-2 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-slate-400"><span className="h-px flex-1 bg-slate-200" />Demo accounts<span className="h-px flex-1 bg-slate-200" /></div>
        <div className="grid grid-cols-2 gap-2">
          {DEMO.map((d) => (
            <button key={d.email} type="button" onClick={() => { if (emailRef.current) { emailRef.current.value = d.email; emailRef.current.focus(); } }}
              className="rounded-xl border border-slate-300 bg-white/40 px-3 py-2 text-left text-xs text-slate-600 transition hover:-translate-y-0.5 hover:border-indigo-500/60 hover:text-slate-900">
              <span className="block font-medium">{d.role}</span><span className="block truncate text-slate-400">{d.email.split('@')[0]}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-center text-[11px] text-slate-400">Fills the email only. The demo password is in your local <code className="font-mono">.env</code>.</p>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="relative grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
      <div className="absolute right-4 top-4 z-10"><ThemeToggle /></div>

      <section className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <div className="animate-fade-up"><Logo size={44} tagline /></div>
        <div>
          <div className="relative mb-10 h-72">
            {VITALS.map((v) => (
              <div key={v.label} className={`glass absolute w-72 animate-float rounded-2xl border border-slate-200 p-4 shadow-lift ${v.cls}`} style={{ animationDelay: v.delay }}>
                <div className="mb-1 flex items-center justify-between text-xs"><span className="font-semibold uppercase tracking-widest text-slate-500">{v.label}</span><span className="num text-slate-400">live</span></div>
                <Pulse level={v.level} width={256} height={40} glow />
                <p className="mt-1 text-xs text-slate-500">{v.text}</p>
              </div>
            ))}
          </div>
          <h1 className="animate-fade-up font-display text-5xl font-semibold leading-[1.05] tracking-tight text-slate-900 xl:text-6xl">
            Every project has a <span className="text-gradient">pulse</span>.<br />Catch it early.
          </h1>
          <p className="mt-5 max-w-lg animate-fade-up text-lg text-slate-600" style={{ animationDelay: '.1s' }}>
            Milestones, contribution, feedback and originality in one live view, so faculty see trouble while there is still time to fix it.
          </p>
          <div className="mt-8 flex animate-fade-up flex-wrap gap-2" style={{ animationDelay: '.2s' }}>
            {['Explainable risk score', 'Semantic originality check', 'Atomic submissions', 'Full audit trail'].map((t) => <span key={t} className="chip chip-brand"><i />{t}</span>)}
          </div>
        </div>
        <p className="text-xs text-slate-400">DBMS Experiential Learning · PostgreSQL + pgvector + MongoDB</p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="card-surface w-full max-w-md animate-scale-in p-8 sm:p-10">
          <div className="mb-8 lg:hidden"><Logo size={40} tagline /></div>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-slate-900">Welcome back</h2>
          <p className="mb-8 mt-1 text-sm text-slate-500">Sign in to check on your projects.</p>
          <Suspense><LoginForm /></Suspense>
        </div>
      </section>
    </main>
  );
}
