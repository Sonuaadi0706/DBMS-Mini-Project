import Link from 'next/link';
import { notFound } from 'next/navigation';
import { pageUser } from '@/lib/auth/page';
import { query } from '@/lib/db/pg';
import { listSimilarity } from '@/lib/data/similarity';
import { similarityBreakdown } from '@/lib/embeddings/service';
import { config, SECTION_LABEL, SECTION_WEIGHTS, type Section } from '@/lib/embeddings/scoring';
import { Card, Empty, PageTitle, StatusChip, fmt } from '@/components/ui';
import { DecisionForm, SemanticSearch } from '@/components/SimilarityControls';

const FILTERS: [string, string | undefined][] = [['Pending', 'pending'], ['Escalated', 'escalated'], ['Needs revision', 'needs_revision'], ['Acceptable overlap', 'acceptable_overlap'], ['Not similar', 'not_similar'], ['All', undefined]];
const tone = (s: number) => (s >= 0.9 ? '#dc2626' : s >= 0.8 ? '#ea580c' : '#ca8a04');

export default async function SimilarityPage({ searchParams }: { searchParams: Promise<{ decision?: string }> }) {
  const user = await pageUser();
  if (!user.roles.some((r) => ['faculty_guide', 'reviewer', 'admin'].includes(r))) notFound();   // students never reach other teams' text
  const { decision } = await searchParams;
  const active = decision === undefined ? 'pending' : FILTERS.some(([, v]) => v === decision) ? decision : undefined;
  const rows = await listSimilarity(user, active ?? null);
  const guideOf = new Set((await query<{ project_id: number }>(`SELECT project_id FROM guide_allocations WHERE user_id = $1 AND allocation_role = 'guide'`, [user.userId])).map((r) => r.project_id));
  const sections = new Map(await Promise.all(rows.map(async (r) => [r.similarity_id, await similarityBreakdown(r.source_project_id, r.matched_project_id)] as const)));
  const c = config();

  return (
    <section className="space-y-4">
      <PageTitle title="Similarity review" subtitle={<>Proposals that may overlap with another proposal in the same course. This is a <strong>review signal</strong>, never a verdict: you decide. A pair is flagged at {Math.round(c.threshold * 100)}% overall similarity, or when one section reaches {Math.round(c.sectionLimit * 100)}%.</>} />
      <div className="flex flex-wrap gap-2 text-sm">
        {FILTERS.map(([text, v]) => (
          <Link key={text} href={v === undefined ? '/similarity?decision=' : `/similarity?decision=${v}`} className={`rounded-full border px-3 py-1 ${active === v ? 'bg-indigo-600 text-onbrand' : 'bg-white hover:bg-slate-50'}`}>{text}</Link>
        ))}
      </div>

      {rows.length === 0 ? <Empty>Nothing to review here.</Empty> : rows.map((r) => {
        const score = Number(r.similarity_score);
        const canDecide = user.roles.includes('admin') || guideOf.has(r.source_project_id);
        const secs = sections.get(r.similarity_id) ?? [];
        return (
          <Card key={r.similarity_id} className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1 text-sm">
                <div><span className="text-xs uppercase text-slate-500">Submitted proposal</span><br /><Link className="font-medium text-indigo-700 hover:underline" href={`/proposals/${r.source_project_id}`}>{r.source_title}</Link> <span className="text-xs text-slate-500">· Team {r.source_team}</span> <StatusChip status={r.source_status} /></div>
                <div><span className="text-xs uppercase text-slate-500">Possibly overlaps with</span><br /><Link className="font-medium text-indigo-700 hover:underline" href={`/proposals/${r.matched_project_id}`}>{r.matched_title}</Link> <span className="text-xs text-slate-500">· Team {r.matched_team}</span> <StatusChip status={r.matched_status} /></div>
              </div>
              <div className="text-right"><div className="text-3xl font-semibold tabular-nums" style={{ color: tone(score) }}>{Math.round(score * 100)}%</div><div className="text-xs text-slate-500">possible overlap</div><div className="mt-1"><StatusChip status={r.faculty_decision} /></div></div>
            </div>

            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500"><tr><th className="py-1">Section</th><th>Weight</th><th className="w-1/2">Similarity</th></tr></thead>
              <tbody>{secs.map((s) => { const v = Number(s.similarity); return (
                <tr key={s.section_type} className="border-t"><td className="py-1">{SECTION_LABEL[s.section_type as Section]}{r.matched_section === s.section_type && <span className="ml-2 text-xs text-slate-500">(best)</span>}</td><td>{Math.round(SECTION_WEIGHTS[s.section_type as Section] * 100)}%</td>
                  <td><div className="flex items-center gap-2"><div className="h-2 w-full rounded bg-slate-100"><div className="h-2 rounded" style={{ width: `${Math.max(0, v) * 100}%`, background: tone(v) }} /></div><span className="w-10 text-right tabular-nums">{Math.round(v * 100)}%</span></div></td></tr>); })}</tbody>
            </table>

            <details className="text-sm"><summary className="cursor-pointer font-medium text-indigo-700">Compare the text side by side</summary>
              <div className="mt-2 space-y-3">{secs.map((s) => (
                <div key={s.section_type}><div className="mb-1 text-xs font-semibold uppercase text-slate-500">{SECTION_LABEL[s.section_type as Section]} · {Math.round(Number(s.similarity) * 100)}%</div>
                  <div className="grid gap-2 md:grid-cols-2"><p className="rounded bg-slate-50 p-2">{s.source_text}</p><p className="rounded bg-slate-50 p-2">{s.matched_text}</p></div></div>))}</div>
            </details>

            {r.faculty_decision !== 'pending' && (
              <p className="rounded bg-slate-50 p-2 text-sm">Decision by {r.reviewed_by_name ?? 'unknown'} on {fmt(r.decided_at)}{r.comments ? `: ${r.comments}` : '.'}</p>
            )}
            {canDecide && ['pending', 'escalated'].includes(r.faculty_decision) && <DecisionForm similarityId={r.similarity_id} current={r.faculty_decision} />}
            {!canDecide && r.faculty_decision === 'pending' && <p className="text-xs text-slate-500">Only the guide of the submitted proposal (or an admin) records the decision.</p>}
          </Card>
        );
      })}
      <SemanticSearch />
    </section>
  );
}
