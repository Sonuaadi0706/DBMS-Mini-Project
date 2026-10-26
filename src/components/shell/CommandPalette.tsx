'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, type IconName } from '../icons';

export interface PaletteItem { id: string; label: string; hint: string; icon: IconName; run: () => void }

/** ⌘K quick switcher: type to filter, arrow keys to move, Enter to run. */
export function CommandPalette({ open, onClose, items }: { open: boolean; onClose: () => void; items: PaletteItem[] }) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? items.filter((i) => i.label.toLowerCase().includes(t) || i.hint.toLowerCase().includes(t)) : items;
  }, [q, items]);

  useEffect(() => { if (open) { setQ(''); setIdx(0); window.setTimeout(() => input.current?.focus(), 30); } }, [open]);
  useEffect(() => { setIdx(0); }, [q]);

  if (!open) return null;
  const run = (i: PaletteItem | undefined) => { if (i) { onClose(); i.run(); } };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[14vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <div onClick={onClose} className="absolute inset-0 animate-fade-in bg-black/55 backdrop-blur-sm" />
      <div className="glass relative w-full max-w-lg animate-scale-in overflow-hidden rounded-2xl border border-slate-300 shadow-lift">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4">
          <Icon name="search" className="h-5 w-5 text-slate-400" />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a page or action…"
            className="!mt-0 w-full !border-0 !bg-transparent !px-0 !py-4 !shadow-none !ring-0 focus:!ring-0"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((v) => Math.min(v + 1, shown.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((v) => Math.max(v - 1, 0)); }
              else if (e.key === 'Enter') run(shown[idx]);
              else if (e.key === 'Escape') onClose();
            }} />
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {shown.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-500">Nothing matches “{q}”.</li>}
          {shown.map((i, n) => (
            <li key={i.id}>
              <button onMouseMove={() => setIdx(n)} onClick={() => run(i)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${n === idx ? 'bg-indigo-500/15 text-slate-900' : 'text-slate-600'}`}>
                <Icon name={i.icon} className={`h-[18px] w-[18px] ${n === idx ? 'text-indigo-600' : ''}`} />
                <span className="flex-1">{i.label}</span>
                <span className="text-[11px] uppercase tracking-wider text-slate-400">{i.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
