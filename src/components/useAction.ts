'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiClientError } from '@/lib/client/api';

/** Runs an API call with busy / error / field-error state and refreshes the server data afterwards. */
export function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function run<T>(fn: () => Promise<T>, opts: { refresh?: boolean; onDone?: (r: T) => void } = {}): Promise<T | undefined> {
    setBusy(true); setError(null); setFields({});
    try {
      const r = await fn();
      if (opts.refresh !== false) router.refresh();
      opts.onDone?.(r);
      return r;
    } catch (e) {
      if (e instanceof ApiClientError) { setError(e.message); setFields(e.fields); }
      else setError('Could not reach the server. Please try again.');
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, fields, run, clear: () => { setError(null); setFields({}); } };
}
