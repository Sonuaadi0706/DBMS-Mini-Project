// The ProjectPulse signature: an ECG line whose rhythm follows project risk. A healthy project beats slowly and evenly;
// a critical one races and stumbles. Pure SVG + CSS (no JS), so it is cheap enough to put on every card.
export type PulseLevel = 'idle' | 'low' | 'moderate' | 'high' | 'critical';

const LOOK: Record<PulseLevel, { color: string; amp: number; seconds: number; irregular: 0 | 1 | 2 }> = {
  idle:     { color: 'var(--c-brand-500)',  amp: 0.55, seconds: 6.5, irregular: 0 },
  low:      { color: 'var(--c-green-500)',  amp: 0.55, seconds: 6,   irregular: 0 },
  moderate: { color: 'var(--c-amber-500)',  amp: 0.7,  seconds: 4,   irregular: 0 },
  high:     { color: 'var(--c-orange-500)', amp: 0.9,  seconds: 2.6, irregular: 1 },
  critical: { color: 'var(--c-red-500)',    amp: 1,    seconds: 1.5, irregular: 2 },
};

/** One heartbeat starting at x0: P wave, QRS spike, T wave. Irregular rhythms add a premature extra beat. */
function beat(x0: number, w: number, h: number, amp: number, irregular: number): string {
  const m = h / 2, a = (f: number) => (m - amp * h * f).toFixed(1), x = (f: number) => (x0 + w * f).toFixed(1);
  let d = `L${x(0.1)} ${m} Q${x(0.15)} ${a(0.12)} ${x(0.2)} ${m} L${x(0.28)} ${m} L${x(0.31)} ${a(-0.14)} L${x(0.36)} ${a(0.5)} L${x(0.41)} ${a(-0.3)} L${x(0.45)} ${m} L${x(0.52)} ${m} Q${x(0.6)} ${a(0.22)} ${x(0.68)} ${m}`;
  if (irregular >= 1) d += ` L${x(0.76)} ${m} L${x(0.79)} ${a(-0.1)} L${x(0.83)} ${a(0.38)} L${x(0.87)} ${a(-0.2)} L${x(0.9)} ${m}`;
  if (irregular >= 2) d += ` L${x(0.93)} ${a(0.18)} L${x(0.96)} ${a(-0.12)}`;
  return d + ` L${x(1)} ${m}`;
}

export function pulseLevel(level: string | null | undefined): PulseLevel {
  return level === 'low' || level === 'moderate' || level === 'high' || level === 'critical' ? level : 'idle';
}

export function Pulse({ level = 'idle', width = 240, height = 48, className = '', glow = false }: { level?: PulseLevel; width?: number; height?: number; className?: string; glow?: boolean }) {
  const look = LOOK[level];
  const w = width / 2;                                  // two heartbeats are visible at a time
  let d = `M0 ${height / 2}`;
  for (let i = 0; i < 4; i++) d += ' ' + beat(i * w, w, height, look.amp, look.irregular);   // 4 beats, scrolled by half = seamless loop
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width, height, WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent)', maskImage: 'linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent)' }} role="img" aria-label={`Heartbeat: ${level} risk`}>
      <svg width={width * 2} height={height} viewBox={`0 0 ${width * 2} ${height}`} className="ecg-run block" style={{ animationDuration: `${look.seconds}s` }}>
        <path d={d} fill="none" stroke={`rgb(${look.color})`} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" style={glow ? { filter: `drop-shadow(0 0 5px rgb(${look.color} / .8))` } : undefined} />
      </svg>
    </div>
  );
}
