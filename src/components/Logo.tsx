import { Icon } from './icons';

/** Brand mark: a heartbeat line in a solid rounded square, plus the wordmark. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <span className="inline-flex items-center justify-center rounded-lg bg-indigo-600 text-onbrand" style={{ width: size, height: size }}>
      <Icon name="pulse" className="h-[58%] w-[58%]" strokeWidth={2.4} />
    </span>
  );
}

export function Logo({ size = 32, tagline = false }: { size?: number; tagline?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold tracking-tight text-slate-900">ProjectPulse</span>
        {tagline && <span className="block text-[11px] text-slate-500">Project governance and risk monitor</span>}
      </span>
    </span>
  );
}
