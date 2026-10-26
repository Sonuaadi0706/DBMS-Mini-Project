'use client';

import { useEffect, useId, useState } from 'react';
import { CountUp } from './CountUp';

const COLOR: Record<string, string> = { low: '--c-green-500', moderate: '--c-amber-500', high: '--c-orange-500', critical: '--c-red-500' };

/** 270-degree gauge for a 0-100 score. The arc sweeps in on load; its colour is the risk level. */
export function RadialGauge({ value, level, size = 190, children }: { value: number; level: string; size?: number; children?: React.ReactNode }) {
  const id = useId();
  const [on, setOn] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(t); }, []);
  const stroke = 14, r = (size - stroke) / 2 - 4, c = 2 * Math.PI * r, arc = c * 0.75;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  const color = `rgb(var(${COLOR[level] ?? '--c-brand-500'}))`;
  const tick = (p: number) => {                       // tick marks at 25 / 50 / 75 (the level boundaries)
    const ang = (135 + 270 * p) * (Math.PI / 180), cx = size / 2, cy = size / 2;
    const f = (n: number) => Number(n.toFixed(2));   // rounded so server and browser print identical attributes
    return { x1: f(cx + (r - stroke / 2 - 2) * Math.cos(ang)), y1: f(cy + (r - stroke / 2 - 2) * Math.sin(ang)), x2: f(cx + (r + stroke / 2 + 2) * Math.cos(ang)), y2: f(cy + (r + stroke / 2 + 2) * Math.sin(ang)) };
  };
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-[225deg]">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.55" /><stop offset="100%" stopColor={color} /></linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--c-slate-200))" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${arc} ${c}`} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${on ? arc * pct : 0} ${c}`} style={{ transition: 'stroke-dasharray 1.5s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="pointer-events-none absolute inset-0">
        {[0.25, 0.5, 0.75].map((p) => <line key={p} {...tick(p)} stroke="rgb(var(--c-slate-400))" strokeOpacity=".5" strokeWidth="1.5" />)}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="font-display text-5xl font-semibold leading-none" style={{ color }}><CountUp value={value} decimals={1} /></div>
        <div className="mt-1 text-[11px] uppercase tracking-widest text-slate-500">risk / 100</div>
        {children && <div className="mt-2">{children}</div>}
      </div>
    </div>
  );
}
