import { RISK_FACTORS, type TrendPoint } from '@/lib/risk';
import { StatusChip } from './ui';

const VAR = { low: '--c-green-500', moderate: '--c-amber-500', high: '--c-orange-500', critical: '--c-red-500' } as const;
type Level = keyof typeof VAR;

/** Level colours come from the theme tokens, so they stay readable in dark and light mode. alpha is 0..1. */
export function levelRgb(level: string, alpha?: number): string {
  const v = VAR[level as Level] ?? '--c-slate-500';
  return alpha === undefined ? `rgb(var(${v}))` : `rgb(var(${v}) / ${alpha})`;
}
export const LEVEL_COLOR = { low: levelRgb('low'), moderate: levelRgb('moderate'), high: levelRgb('high'), critical: levelRgb('critical') } as const;

export function RiskSummary({ score, level }: { score: number; level: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="num font-display text-5xl font-semibold">{score.toFixed(1)}</div>
      <div><StatusChip status={level} /><div className="mt-1 text-xs text-slate-500">risk score out of 100</div></div>
    </div>
  );
}

/** One bar per factor: points earned out of the factor's cap. A zero bar still shows its cap, so nothing is hidden. */
export function FactorBars({ breakdown }: { breakdown: Record<string, number> }) {
  return (
    <ul className="stagger space-y-4">
      {RISK_FACTORS.map((f) => {
        const pts = Number(breakdown[f.key] ?? 0);
        const ratio = pts / f.max;
        const lvl = ratio > 0.66 ? 'critical' : ratio > 0.33 ? 'high' : 'moderate';
        return (
          <li key={f.key}>
            <div className="flex justify-between text-sm"><span className="font-medium text-slate-800">{f.label}</span><span className="num text-slate-500">{pts} / {f.max}</span></div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-200" role="img" aria-label={`${f.label}: ${pts} of ${f.max} points`}>
              <div className="h-full origin-left rounded-full" style={{ width: `${ratio * 100}%`, background: pts === 0 ? 'transparent' : `linear-gradient(90deg, ${levelRgb(lvl, 0.7)}, ${levelRgb(lvl)})`, boxShadow: pts ? `0 0 12px -2px ${levelRgb(lvl, 0.6)}` : undefined, animation: 'bar-grow 1.1s cubic-bezier(.2,.8,.2,1) both' }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Score over time with the four level bands behind it. Plain SVG, no chart library. */
export function TrendChart({ points }: { points: TrendPoint[] }) {
  const W = 640, H = 220, L = 36, R = 12, T = 12, B = 28;
  const iw = W - L - R, ih = H - T - B;
  const y = (v: number) => T + ih - (v / 100) * ih;
  const t0 = new Date(points[0]?.day ?? Date.now()).getTime();
  const t1 = new Date(points[points.length - 1]?.day ?? Date.now()).getTime();
  const x = (d: string) => (t1 === t0 ? L + iw / 2 : L + ((new Date(d).getTime() - t0) / (t1 - t0)) * iw);
  const bands: [number, number, Level][] = [[0, 25, 'low'], [25, 50, 'moderate'], [50, 75, 'high'], [75, 100, 'critical']];
  const short = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const line = points.map((p) => `${x(p.day)},${y(p.score)}`).join(' ');
  const area = points.length > 1 ? `${x(points[0].day)},${y(0)} ${line} ${x(points[points.length - 1].day)},${y(0)}` : '';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Risk score over time, latest ${points[points.length - 1]?.score ?? 'n/a'}`}>
      <defs><linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgb(var(--c-brand-500))" stopOpacity=".35" /><stop offset="1" stopColor="rgb(var(--c-brand-500))" stopOpacity="0" /></linearGradient></defs>
      {bands.map(([a, b, l]) => <rect key={a} x={L} y={y(b)} width={iw} height={y(a) - y(b)} fill={levelRgb(l)} opacity={0.08} />)}
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="rgb(var(--c-slate-300))" strokeWidth={0.5} strokeDasharray="3 4" /><text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="rgb(var(--c-slate-500))">{v}</text></g>
      ))}
      {area && <polygon points={area} fill="url(#trend-fill)" />}
      {points.length > 1 && <polyline fill="none" stroke="rgb(var(--c-brand-500))" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" points={line} pathLength={1} style={{ strokeDasharray: 1, animation: 'draw 1.4s ease-out both', filter: 'drop-shadow(0 0 6px rgb(var(--c-glow) / .6))' }} />}
      {points.map((p) => (
        <circle key={p.day} cx={x(p.day)} cy={y(p.score)} r={4.5} fill="rgb(var(--c-brand-500))" stroke="rgb(var(--c-surface))" strokeWidth={2}><title>{`${short(p.day)}: ${p.score}`}</title></circle>
      ))}
      {points.length > 0 && <>
        <text x={x(points[0].day)} y={H - 8} fontSize={10} fill="rgb(var(--c-slate-500))" textAnchor="start">{short(points[0].day)}</text>
        {points.length > 1 && <text x={x(points[points.length - 1].day)} y={H - 8} fontSize={10} fill="rgb(var(--c-slate-500))" textAnchor="end">{short(points[points.length - 1].day)}</text>}
      </>}
    </svg>
  );
}
