import { pageProject } from '@/lib/auth/page';
import { listEvidence } from '@/lib/data/queries';
import { Card, Empty, fmt, label } from '@/components/ui';
import { GitReferenceForm, VerifyEvidenceButton } from '@/components/EvidenceControls';

export default async function EvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const { user, access, project: p } = await pageProject((await params).id);
  const studentOnly = access.isMember && !access.isGuide && !access.isReviewer && !access.isAdmin;
  const evidence = await listEvidence(p.project_id, studentOnly ? user.userId : null, null);
  const pending = evidence.filter((e) => !e.verified_flag);
  const row = (e: (typeof evidence)[number]) => (
    <tr key={e.evidence_id} className="border-b last:border-0">
      <td className="p-2">{e.user_name}</td><td className="p-2">{label(e.evidence_type)}</td><td className="p-2">{e.description}</td>
      <td className="p-2">{Number(e.weight)}</td><td className="p-2 text-xs text-slate-500">{fmt(e.created_at)}</td>
      <td className="p-2">{e.verified_flag ? <span className="text-green-700">✓ by {e.verified_by_name}</span> : access.isGuide ? <VerifyEvidenceButton evidenceId={e.evidence_id} /> : <span className="text-amber-700">Waiting for the guide</span>}</td>
    </tr>
  );
  return (
    <div>
      <p className="mb-3 text-sm text-slate-600">Only <strong>verified</strong> evidence counts towards contribution and the risk score. {studentOnly ? 'You see your own evidence.' : `${pending.length} item(s) are waiting for verification.`}</p>
      {access.isMember && <GitReferenceForm projectId={p.project_id} />}
      {evidence.length === 0 ? <Empty>No evidence recorded yet.</Empty> : (
        <Card className="overflow-x-auto !p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-2">Member</th><th className="p-2">Type</th><th className="p-2">Description</th><th className="p-2">Weight</th><th className="p-2">Recorded</th><th className="p-2">Status</th></tr></thead>
            <tbody>{pending.map(row)}{evidence.filter((e) => e.verified_flag).map(row)}</tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
