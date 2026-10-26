'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Numbers that count up when they appear. The server renders the final value, so nothing is lost without JavaScript. */
export function CountUp({ value, decimals = 0, duration = 1100, suffix = '', className }: { value: number; decimals?: number; duration?: number; suffix?: string; className?: string }) {
  const [shown, setShown] = useState(value);
  const first = useRef(true);
  useIsoLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); return; }
    const from = first.current ? 0 : shown;
    first.current = false;
    let raf = 0; const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      setShown(from + (value - from) * (1 - Math.pow(1 - p, 4)));   // ease-out quart
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setShown(from);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);
  return <span className={`num ${className ?? ''}`}>{shown.toFixed(decimals)}{suffix}</span>;
}
