import { Icon } from './icons';

/** Brand mark: a heartbeat in a glowing rounded square, plus the wordmark. */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <span className="relative inline-flex items-center justify-center rounded-xl text-onbrand shadow-glow" style={{ width: size, height: size, background: 'linear-gradient(135deg, rgb(var(--c-brand-500)), rgb(var(--c-blue-500)))' }}>
      <Icon name="pulse" className="h-[58%] w-[58%]" strokeWidth={2.4} />
      <span className="pointer-events-none absolute inset-0 rounded-xl border border-shine/30" />
    </span>
  );
}

export function Logo({ size = 36, tagline = false }: { size?: number; tagline?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3">
      <LogoMark size={size} />
      <span className="leading-tight">
        <span className="block font-display text-lg font-semibold tracking-tight text-slate-900">Project<span className="text-indigo-600">Pulse</span></span>
        {tagline && <span className="block text-[11px] uppercase tracking-[0.18em] text-slate-500">Project vital signs</span>}
      </span>
    </span>
  );
}
