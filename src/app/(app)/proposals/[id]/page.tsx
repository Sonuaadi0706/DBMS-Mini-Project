import Link from 'next/link';
import { pageProject } from '@/lib/auth/page';
import { getAllocations, getProposalHistory } from '@/lib/data/queries';
import { ButtonLink, Card, PageTitle, StatusChip, fmt, label } from '@/components/ui';
import { ProposalForm } from '@/components/ProposalForm';
import { DecisionPanel, SubmitProposalButton } from '@/components/ProposalActions';
import { OriginalityCheck } from '@/components/SimilarityControls';

const SECTIONS: [string, 'abstract' | 'problem_statement' | 'objectives' | 'scope'][] = [
  ['Abstract', 'abstract'], ['Problem statement', 'problem_statement'], ['Objectives', 'objectives'], ['Scope', 'scope'],
];

export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { access, project: p } = await pageProject((await params).id);
  const [history, allocations] = await Promise.all([getProposalHistory(p.project_id), getAllocations(p.project_id)]);
  const editable = access.isMember && ['draft', 'revision_requested'].includes(p.status);
  const guide = allocations.find((a) => a.allocation_role === 'guide');
  const running = ['approved', 'in_progress', 'completed'].includes(p.status);

  return (
    <section className="space-y-4">
      <PageTitle title={p.title} subtitle={<>Team {p.team_name} · {p.course_name} · Guide: {guide?.name ?? 'not allocated yet'}</>}
        actions={<><StatusChip status={p.status} />{running && <ButtonLink href={`/projects/${p.project_id}`} primary>Open project</ButtonLink>}</>} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {editable ? (
            <ProposalForm projectId={p.project_id} initial={{
              title: p.title, abstract: p.abstract ?? '', problemStatement: p.problem_statement ?? '', objectives: p.objectives ?? '',
              scope: p.scope ?? '', domain: p.domain ?? '', technologies: p.technologies.join(', '), repoLink: p.repo_link ?? '',
            }} />
          ) : (
            <Card className="space-y-3">
              {SECTIONS.map(([title, key]) => (
                <div key={key}><h2 className="text-sm font-semibold text-slate-700">{title}</h2><p className="whitespace-pre-line text-sm text-slate-800">{p[key] || '—'}</p></div>
              ))}
              <div className="flex flex-wrap gap-6 text-sm">
                <div><span className="font-semibold text-slate-700">Domain: </span>{p.domain ?? '—'}</div>
                <div><span className="font-semibold text-slate-700">Technologies: </span>{p.technologies.join(', ') || '—'}</div>
                {p.repo_link && <div><a className="text-indigo-700 underline" href={p.repo_link} target="_blank" rel="noreferrer noopener">Repository</a></div>}
              </div>
            </Card>
          )}
          {editable && (
            <Card><p className="mb-2 text-sm text-slate-600">Already saved? Submit the saved version for review.</p><SubmitProposalButton projectId={p.project_id} resubmit={p.status === 'revision_requested'} /></Card>
          )}
        </div>

        <div className="space-y-4">
          {editable && <OriginalityCheck projectId={p.project_id} />}
          {access.isGuide && p.status === 'submitted' && <DecisionPanel projectId={p.project_id} />}
          <Card>
            <h2 className="mb-2 font-medium">History</h2>
            {history.length === 0 ? <p className="text-sm text-slate-500">Nothing recorded yet. Decisions are kept permanently and cannot be edited.</p> : (
              <ol className="space-y-3 border-l-2 border-slate-200 pl-4">
                {history.map((h) => (
                  <li key={h.action_id} className="text-sm">
                    <div className="font-medium">{label(h.action)} <span className="font-normal text-slate-500">by {h.actor_name}</span></div>
                    <div className="text-xs text-slate-500">{fmt(h.created_at)} · {label(h.from_status)} → {label(h.to_status)}</div>
                    {h.comments && <p className="mt-1 rounded bg-slate-50 p-2 text-slate-700">{h.comments}</p>}
                  </li>
                ))}
              </ol>
            )}
          </Card>
          <Link href="/proposals" className="text-sm text-slate-500 hover:text-slate-900">← All proposals</Link>
        </div>
      </div>
    </section>
  );
}
