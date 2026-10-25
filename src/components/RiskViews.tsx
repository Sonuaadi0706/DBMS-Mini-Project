import { RISK_FACTORS, type TrendPoint } from '@/lib/risk';
import { StatusChip } from './ui';

/** Level colours are used consistently everywhere (chips, bands, heatmap). */
export const LEVEL_COLOR = { low: '#16a34a', moderate: '#ca8a04', high: '#ea580c', critical: '#dc2626' } as const;

export function RiskSummary({ score, level }: { score: number; level: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="text-5xl font-semibold tabular-nums">{score.toFixed(1)}</div>
      <div><StatusChip status={level} /><div className="mt-1 text-xs text-slate-500">risk score out of 100</div></div>
    </div>
  );
}

/** One bar per factor: points earned out of the factor's cap. A zero bar still shows its cap, so nothing is hidden. */
export function FactorBars({ breakdown }: { breakdown: Record<string, number> }) {
  return (
    <ul className="space-y-3">
      {RISK_FACTORS.map((f) => {
        const pts = Number(breakdown[f.key] ?? 0);
        return (
          <li key={f.key}>
            <div className="flex justify-between text-sm"><span className="font-medium">{f.label}</span><span className="tabular-nums text-slate-600">{pts} / {f.max}</span></div>
            <div className="mt-1 h-2.5 rounded bg-slate-100" role="img" aria-label={`${f.label}: ${pts} of ${f.max} points`}>
              <div className="h-2.5 rounded" style={{ width: `${(pts / f.max) * 100}%`, background: pts === 0 ? 'transparent' : pts / f.max > 0.66 ? LEVEL_COLOR.critical : pts / f.max > 0.33 ? LEVEL_COLOR.high : LEVEL_COLOR.moderate }} />
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
  const bands: [number, number, string][] = [[0, 25, LEVEL_COLOR.low], [25, 50, LEVEL_COLOR.moderate], [50, 75, LEVEL_COLOR.high], [75, 100, LEVEL_COLOR.critical]];
  const short = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Risk score over time, latest ${points[points.length - 1]?.score ?? 'n/a'}`}>
      {bands.map(([a, b, c]) => <rect key={a} x={L} y={y(b)} width={iw} height={y(a) - y(b)} fill={c} opacity={0.1} />)}
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#cbd5e1" strokeWidth={0.5} /><text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="#64748b">{v}</text></g>
      ))}
      {points.length > 1 && <polyline fill="none" stroke="#4338ca" strokeWidth={2} points={points.map((p) => `${x(p.day)},${y(p.score)}`).join(' ')} />}
      {points.map((p) => (
        <circle key={p.day} cx={x(p.day)} cy={y(p.score)} r={4} fill="#4338ca" stroke="white" strokeWidth={1.5}><title>{`${short(p.day)}: ${p.score}`}</title></circle>
      ))}
      {points.length > 0 && <>
        <text x={x(points[0].day)} y={H - 8} fontSize={10} fill="#64748b" textAnchor="start">{short(points[0].day)}</text>
        {points.length > 1 && <text x={x(points[points.length - 1].day)} y={H - 8} fontSize={10} fill="#64748b" textAnchor="end">{short(points[points.length - 1].day)}</text>}
      </>}
    </svg>
  );
}
