'use client';

import { useEffect, useState } from 'react';
import { Icon } from '../icons';

/** Dark / light switch. The choice is remembered; the inline script in the root layout applies it before first paint. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  useEffect(() => { setTheme(document.documentElement.classList.contains('light') ? 'light' : 'dark'); }, []);
  function flip() {
    const next = theme === 'dark' ? 'light' : 'dark';
    const d = document.documentElement;
    d.classList.add('theme-switching');
    d.classList.remove('dark', 'light'); d.classList.add(next);
    try { localStorage.setItem('pp-theme', next); } catch { /* private mode: fine */ }
    setTheme(next);
    window.setTimeout(() => d.classList.remove('theme-switching'), 350);
  }
  return (
    <button onClick={flip} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title="Toggle theme"
      className={`relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-900 ${className}`}>
      <span className={`absolute transition-all duration-500 ${theme === 'dark' ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0'}`}><Icon name="moon" /></span>
      <span className={`absolute transition-all duration-500 ${theme === 'light' ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-50 opacity-0'}`}><Icon name="sun" /></span>
    </button>
  );
}
