import Link from 'next/link';
import { pageProject } from '@/lib/auth/page';
import { contributionFor } from '@/lib/data/contribution';
import { listMilestones, teamMemberOptions } from '@/lib/data/queries';
import { peerSummaryStaff, peerSummaryStudent } from '@/lib/data/peer';
import { PeerEvaluationForm } from '@/components/PeerEvaluation';
import { Card, Empty, label } from '@/components/ui';
import { ExplainContribution } from '@/components/Explain';

export default async function ContributionPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, access, project: p } = await pageProject((await params).id);
  const onlyMine = access.isMember && !access.isGuide && !access.isReviewer && !access.isAdmin;
  const members = await contributionFor(p.project_id, onlyMine ? user.userId : null);
  if (members.length === 0) return <Empty>No contribution data yet.</Empty>;
  // Peer evaluation: students rate teammates (and see an anonymous summary); staff see who rated whom.
  const staff = access.isGuide || access.isReviewer || access.isAdmin;
  const [peerStaff, peerSelf, milestones, mates] = await Promise.all([
    staff ? peerSummaryStaff(p.project_id) : null,
    onlyMine ? peerSummaryStudent(p.project_id, user.userId) : null,
    onlyMine ? listMilestones(p.project_id) : [],
    onlyMine ? teamMemberOptions(p.team_id) : [],
  ]);
  const equal = members.length > 0 && !onlyMine ? 100 / members.length : null;
  const pending = members.reduce((a, m) => a + m.unverified_items, 0);
  const types = [...new Set(members.flatMap((m) => Object.keys(m.by_type)))].sort();

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        {onlyMine ? 'This is your own contribution record.' : 'Verified evidence per team member.'} Only <strong>verified</strong> evidence counts.
        {pending > 0 && <> {pending} item(s) {onlyMine ? 'of yours are' : 'are'} waiting for the guide. <Link className="text-indigo-700 underline" href={`/projects/${p.project_id}/evidence`}>{access.isGuide ? 'Open the evidence queue' : 'See evidence'}</Link>.</>}
      </p>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {members.map((m) => {
          const share = m.share_pct === null ? 0 : Number(m.share_pct);
          return (
            <Card key={m.user_id}>
              <div className="flex items-start justify-between"><div><div className="font-medium">{m.name}</div><div className="text-xs text-slate-500">{m.member_role === 'leader' ? 'Team leader' : 'Member'}{m.responsibility ? ` · ${m.responsibility}` : ''}</div></div>
                <div className="text-right"><div className="text-2xl font-semibold">{Number(m.indicator)}</div><div className="text-[11px] text-slate-500">indicator / 100</div></div></div>
              {!onlyMine && (
                <div className="mt-3">
                  <div className="relative h-3 rounded bg-slate-200" title={`${share}% of the team's verified points`}>
                    <div className="h-3 rounded bg-indigo-500" style={{ width: `${share}%` }} />
                    {equal !== null && <div className="absolute -top-1 h-5 w-0.5 bg-slate-700" style={{ left: `${equal}%` }} title={`Equal split: ${equal.toFixed(0)}%`} />}
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-slate-500"><span>{share}% of team points</span><span>| equal split {equal?.toFixed(0)}%</span></div>
                </div>
              )}
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded bg-slate-50 p-2"><dt className="text-slate-500">Points</dt><dd className="text-base font-semibold">{Number(m.evidence_points)}</dd></div>
                <div className="rounded bg-green-50 p-2"><dt className="text-slate-500">Verified</dt><dd className="text-base font-semibold">{m.verified_items}</dd></div>
                <div className="rounded bg-amber-50 p-2"><dt className="text-slate-500">Waiting</dt><dd className="text-base font-semibold">{m.unverified_items}</dd></div>
              </dl>
              {m.avg_peer_score !== null && <p className="mt-2 text-xs text-slate-600">Average peer score received: <strong>{Number(m.avg_peer_score)}</strong> / 5 (anonymised)</p>}
            </Card>
          );
        })}
      </div>

      <Card className="overflow-x-auto !p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="p-2">Member</th>{types.map((t) => <th key={t} className="p-2">{label(t)}</th>)}</tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.user_id} className="border-b last:border-0">
                <td className="p-2 font-medium">{m.name}</td>
                {types.map((t) => { const c = m.by_type[t]; return <td key={t} className="p-2">{c ? <><span className="font-medium">{c.verified}</span>{c.unverified > 0 && <span className="text-amber-700"> +{c.unverified} waiting</span>}</> : <span className="text-slate-300">0</span>}</td>; })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {peerSelf && (
        <>
          <PeerEvaluationForm projectId={p.project_id} milestones={milestones.filter((m) => m.status !== 'planned')}
            teammates={mates.filter((m) => m.user_id !== user.userId)} given={peerSelf.given} />
          <Card>
            <h2 className="mb-1 font-medium">Peer feedback you received</h2>
            {peerSelf.received.ratings === 0 ? <p className="text-sm text-slate-500">No ratings yet.</p> : (
              <>
                <p className="text-sm">Average <strong>{peerSelf.received.avg_score}</strong> / 5 from {peerSelf.received.ratings} rating(s). Ratings are anonymous.</p>
                {peerSelf.received.comments.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">{peerSelf.received.comments.map((c, i) => <li key={i}>{c}</li>)}</ul>}
              </>
            )}
          </Card>
        </>
      )}
      {peerStaff && (
        <Card className="overflow-x-auto">
          <h2 className="mb-2 font-medium">Peer evaluations</h2>
          {peerStaff.evaluations.length === 0 ? <p className="text-sm text-slate-500">No peer ratings yet.</p> : (
            <table className="w-full text-left text-sm">
              <thead className="border-b text-xs uppercase text-slate-500"><tr><th className="py-1">Milestone</th><th>From</th><th>About</th><th>Score</th><th>Comment</th></tr></thead>
              <tbody>{peerStaff.evaluations.map((e) => <tr key={e.evaluation_id} className="border-b last:border-0"><td className="py-1">{e.milestone ?? '—'}</td><td>{e.evaluator}</td><td>{e.evaluatee}</td><td className="tabular-nums">{Number(e.score)}</td><td className="text-slate-600">{e.comments}</td></tr>)}</tbody>
            </table>
          )}
        </Card>
      )}
      <ExplainContribution />
    </div>
  );
}
