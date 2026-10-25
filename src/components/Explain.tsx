// "How is this calculated?" panels: the formulas from spec 9.6, written in plain language, so risk and
// contribution numbers are never a black box. Server component (no state): uses native <details>.
import { EVIDENCE_MULTIPLIERS } from '@/lib/data/contribution';
import { RISK_FACTORS, RISK_LEVELS } from '@/lib/risk';
import { StatusChip } from './ui';

export function ExplainRisk() {
  return (
    <details className="rounded-lg border bg-white p-4 text-sm">
      <summary className="cursor-pointer font-medium text-indigo-700">How is this calculated?</summary>
      <p className="mt-3 text-slate-600">The score (0 to 100) is the sum of six factors, each with a cap. It is a rule-based, explainable indicator for faculty, not a grade.</p>
      <table className="mt-2 w-full text-left text-xs">
        <thead className="text-slate-500"><tr><th className="py-1">Factor</th><th>Max</th><th>Rule</th></tr></thead>
        <tbody>{RISK_FACTORS.map((f) => <tr key={f.key} className="border-t"><td className="py-1 pr-2 font-medium">{f.label}</td><td className="pr-2">{f.max}</td><td className="text-slate-600">{f.rule}</td></tr>)}</tbody>
      </table>
      <div className="mt-3 flex flex-wrap gap-3 text-xs">{RISK_LEVELS.map((l) => <span key={l.level} className="flex items-center gap-1"><StatusChip status={l.level} /> {l.range}</span>)}</div>
    </details>
  );
}

export function ExplainContribution() {
  return (
    <details className="rounded-lg border bg-white p-4 text-sm">
      <summary className="cursor-pointer font-medium text-indigo-700">How is this calculated?</summary>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-600">
        <li><strong>Only verified evidence counts.</strong> The guide verifies uploads and commits; verified tasks and feedback fixes are verified automatically.</li>
        <li>Each piece of evidence earns <em>weight</em> (bigger tasks weigh more) multiplied by its type: {EVIDENCE_MULTIPLIERS.map(([n, m]) => `${n} x${m}`).join(', ')}.</li>
        <li><strong>Share</strong> = your points divided by the team&apos;s total points.</li>
        <li><strong>Indicator</strong> = 80% evidence share + 20% peer share (your average peer score divided by the team&apos;s sum of averages; evidence share is used if there are no peer scores yet).</li>
        <li>It is a signal to help faculty ask good questions, not a grade.</li>
      </ul>
    </details>
  );
}
