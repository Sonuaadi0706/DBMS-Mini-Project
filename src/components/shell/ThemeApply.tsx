'use client';

import { useLayoutEffect } from 'react';

/** Sets the colour theme when a page mounts. The login page is always light; everything after sign-in uses the saved
 *  choice and defaults to dark. Needed because moving between them is a client-side navigation, so the inline script in
 *  the root layout (which only runs on a full page load) would not run again. */
export function ThemeApply({ mode }: { mode: 'light' | 'user' }) {
  useLayoutEffect(() => {
    let t: string = 'light';
    if (mode === 'user') { try { t = localStorage.getItem('pp-theme') || 'dark'; } catch { t = 'dark'; } }
    const d = document.documentElement;
    d.classList.remove('dark', 'light');
    d.classList.add(t === 'light' ? 'light' : 'dark');
  }, [mode]);
  return null;
}
