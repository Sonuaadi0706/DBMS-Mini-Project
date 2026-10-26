/** Tiny trend line for tables and cards. Server-rendered SVG; the last point is highlighted. */
export function Sparkline({ points, width = 96, height = 28, color = 'var(--c-brand-500)' }: { points: number[]; width?: number; height?: number; color?: string }) {
  if (points.length < 2) return <span className="text-xs text-slate-400">no trend</span>;
  const max = Math.max(...points, 1), min = Math.min(...points, 0), span = max - min || 1, pad = 3;
  const xy = points.map((v, i) => [pad + (i / (points.length - 1)) * (width - pad * 2), height - pad - ((v - min) / span) * (height - pad * 2)] as const);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const [lx, ly] = xy[xy.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Trend: ${points.join(', ')}`}>
      <path d={`${d} L${lx} ${height} L${xy[0][0]} ${height} Z`} fill={`rgb(${color} / .12)`} />
      <path d={d} fill="none" stroke={`rgb(${color})`} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="3" fill={`rgb(${color})`} stroke="rgb(var(--c-surface))" strokeWidth="1.5" />
    </svg>
  );
}
