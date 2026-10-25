import { pageProject } from '@/lib/auth/page';
import { listDeliverables, listMilestones } from '@/lib/data/queries';
import { projectDocStats } from '@/lib/docs/stats';
import { Card, Empty, ProgressBar, StatusChip, bytes, fmt, label } from '@/components/ui';
import { AddVersionForm, DeleteDraftButton, GuideDeliverableActions, NewDeliverableForm, SubmitMilestonePanel } from '@/components/DeliverableControls';

const OPEN = ['in_progress', 'revision_requested'];

export default async function DeliverablesPage({ params }: { params: Promise<{ id: string }> }) {
  const { access, project: p } = await pageProject((await params).id);
  const [milestones, deliverables] = await Promise.all([listMilestones(p.project_id), listDeliverables(p.project_id)]);
  if (milestones.length === 0) return <Empty>Deliverables belong to milestones. Create the milestones first.</Empty>;
  // Document insights come from MongoDB; if it is down the rest of the page still works.
  const stats = await projectDocStats(p.project_id, false).catch(() => null);

  return (
    <div className="space-y-4">
      {stats && (
        <Card>
          <h2 className="mb-2 font-medium">Document insights</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1 text-sm text-slate-600">Required documents provided (milestones due within 7 days or overdue)</div>
              <ProgressBar pct={stats.completeness.pct} tone="green" />
              {stats.completeness.pct !== stats.completeness.sqlPct && <p className="text-xs text-amber-700">Document store and database disagree ({stats.completeness.sqlPct}% in SQL); run npm run mongo:reconcile.</p>}
            </div>
            <div>
              <div className="mb-1 text-sm text-slate-600">Versions per document</div>
              {stats.versions.length === 0 ? <p className="text-xs text-slate-500">No documents yet.</p> : (
                <ul className="text-xs">{stats.versions.map((v) => <li key={v._id} className="flex justify-between border-t py-0.5 first:border-0"><span className="truncate pr-2">{v.title}</span><span className="shrink-0 tabular-nums text-slate-600">{v.versionCount} version(s)</span></li>)}</ul>
              )}
            </div>
          </div>
        </Card>
      )}
      {milestones.map((m) => {
        const dels = deliverables.filter((d) => d.milestone_id === m.milestone_id);
        const open = OPEN.includes(m.status);
        const missing = m.required.filter((t) => !m.delivered.includes(t) && !dels.some((d) => d.status === 'draft' && d.deliverable_type === t));
        const drafts = dels.filter((d) => d.status === 'draft');
        return (
          <Card key={m.milestone_id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="font-medium">{m.sequence_no}. {m.title} <span className="text-xs font-normal text-slate-500">due {fmt(m.due_date)}</span></h2>
              <StatusChip status={m.status} />
            </div>
            {m.required.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-500">Mandatory:</span>
                {m.required.map((t) => {
                  const ok = m.delivered.includes(t);
                  const draft = !ok && dels.some((d) => d.status === 'draft' && d.deliverable_type === t);
                  return <span key={t} className={`rounded-full px-2 py-0.5 ${ok ? 'bg-green-100 text-green-800' : draft ? 'bg-amber-100 text-amber-800' : 'bg-red-50 text-red-700'}`}>{ok ? '✓ ' : draft ? '… ' : '✗ '}{label(t)}{draft ? ' (draft)' : ''}</span>;
                })}
              </div>
            )}

            {dels.length === 0 && <p className="mt-3 text-sm text-slate-500">No deliverables yet.</p>}
            <div className="mt-3 space-y-3">
              {dels.map((d) => (
                <div key={d.deliverable_id} className="rounded border bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{d.title}</span><span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{label(d.deliverable_type)}</span><StatusChip status={d.status} /></div>
                    <span className="text-xs text-slate-500">by {d.submitted_by_name}</span>
                  </div>
                  {(d.repo_link || d.evidence_url) && (
                    <p className="mt-1 text-xs">{d.repo_link && <a className="mr-3 text-indigo-700 underline" href={d.repo_link} target="_blank" rel="noreferrer noopener">Repository</a>}{d.evidence_url && <a className="text-indigo-700 underline" href={d.evidence_url} target="_blank" rel="noreferrer noopener">Evidence</a>}</p>
                  )}
                  <table className="mt-2 w-full text-left text-xs">
                    <thead className="text-slate-500"><tr><th className="py-1">Version</th><th>Change summary</th><th>File</th><th>Uploaded</th></tr></thead>
                    <tbody>
                      {d.versions.map((v) => {
                        const external = v.fileUrl && /^https?:/i.test(v.fileUrl);
                        return (
                          <tr key={v.versionId} className="border-t">
                            <td className="py-1 font-medium">v{v.versionNumber}</td>
                            <td className="pr-2">{v.changeSummary}</td>
                            <td className="pr-2">{external
                              ? <a className="text-indigo-700 underline" href={v.fileUrl!} target="_blank" rel="noreferrer noopener">{v.fileName ?? 'external link'}</a>
                              : <a className="text-indigo-700 underline" href={`/api/files/${v.versionId}`}>{v.fileName}</a>} <span className="text-slate-400">{bytes(v.sizeBytes)}</span></td>
                            <td>{v.uploadedBy}, {fmt(v.uploadedAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    {access.isMember && open && ['draft', 'rejected'].includes(d.status) && <AddVersionForm deliverableId={d.deliverable_id} />}
                    {access.isMember && open && d.status === 'draft' && <DeleteDraftButton deliverableId={d.deliverable_id} />}
                    {d.status === 'rejected' && access.isMember && <span className="text-xs text-amber-700">Returned by the guide: upload a new version to rework it.</span>}
                  </div>
                  {access.isGuide && d.status === 'submitted' && ['submitted', 'under_review'].includes(m.status) && <GuideDeliverableActions deliverableId={d.deliverable_id} />}
                </div>
              ))}
            </div>

            {access.isMember && open && (
              <div className="mt-4 space-y-3">
                <NewDeliverableForm milestoneId={m.milestone_id} />
                <SubmitMilestonePanel milestoneId={m.milestone_id} drafts={drafts.map((d) => d.title)} missing={missing} resubmitting={m.status === 'revision_requested'} />
              </div>
            )}
            {access.isMember && m.status === 'planned' && <p className="mt-3 text-xs text-slate-500">Start this milestone on the Milestones tab before adding deliverables.</p>}
          </Card>
        );
      })}
    </div>
  );
}
