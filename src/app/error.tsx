'use client';

import { Pulse } from '@/components/viz/Pulse';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Pulse level="high" width={320} height={64} />
      <h1 className="mt-6 font-display text-3xl font-semibold text-slate-900">Something went wrong</h1>
      <p className="mt-2 max-w-md text-slate-600">An unexpected error occurred. Your data is safe; try again.</p>
      <button onClick={reset} className="btn btn-primary mt-8">Try again</button>
    </main>
  );
}
