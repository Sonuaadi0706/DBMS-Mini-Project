import { pageProject } from '@/lib/auth/page';
import { listFeedback, listReviews, teamMemberOptions } from '@/lib/data/queries';
import { Card, Empty, StatusChip, fmt, label } from '@/components/ui';
import { FeedbackActions, NewFeedbackForm, ReviewEditor, ThreadPanel } from '@/components/FeedbackControls';

const SEVERITY: Record<string, string> = { minor: 'bg-slate-100 text-slate-700', major: 'bg-orange-100 text-orange-800', critical: 'bg-red-100 text-red-800' };

export default async function FeedbackPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, access, project: p } = await pageProject((await params).id);
  const staff = access.isGuide || access.isReviewer;
  const studentOnly = access.isMember && !staff && !access.isAdmin;
  const [reviews, feedback, people] = await Promise.all([
    listReviews(p.project_id), listFeedback(p.project_id, studentOnly ? user.userId : null), teamMemberOptions(p.team_id),
  ]);
  const open = feedback.filter((f) => f.resolution_status !== 'verified');
  const done = feedback.filter((f) => f.resolution_status === 'verified');

  const item = (f: (typeof feedback)[number]) => (
    <Card key={f.feedback_id}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-medium">{f.description}</p>
        <div className="flex items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-xs ${SEVERITY[f.severity]}`}>{label(f.severity)}</span><StatusChip status={f.resolution_status} /></div>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        M{f.sequence_no} {f.milestone_title} · assigned to {f.assigned_to} · raised by {f.created_by_name}
        {f.due_date && <> · due <span className={f.is_overdue ? 'font-medium text-red-600' : ''}>{fmt(f.due_date)}{f.is_overdue ? ' (overdue)' : ''}</span></>}
      </p>
      {f.response_text && <p className="mt-2 rounded bg-slate-50 p-2 text-sm"><span className="font-medium">Response:</span> {f.response_text}</p>}
      <FeedbackActions feedbackId={f.feedback_id} status={f.resolution_status} isAssignee={f.assigned_user_id === user.userId} isGuide={access.isGuide} />
      <ThreadPanel feedbackId={f.feedback_id} canPost={!access.isAdmin || access.isMember || staff} />
    </Card>
  );

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-lg font-semibold">Reviews</h2>
        {reviews.length === 0 ? <Empty>No reviews yet. A review is requested when the team submits a milestone.</Empty> : (
          <div className="space-y-3">
            {reviews.map((r) => {
              const mine = r.reviewer_id === user.userId && staff;
              return (
                <Card key={r.review_id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div><div className="font-medium">M{r.sequence_no} {r.milestone_title}</div><div className="text-xs text-slate-500">Reviewer: {r.reviewer_name}{r.review_date && ` · ${fmt(r.review_date)}`} · {r.feedback_count} feedback item(s)</div></div>
                    <div className="flex items-center gap-2">{r.total_score !== null && <span className="text-sm font-medium">{Number(r.total_score)} / 100</span>}<StatusChip status={r.decision} /></div>
                  </div>
                  {r.scores.length > 0 && (
                    <table className="mt-2 text-xs"><tbody>{r.scores.map((s) => <tr key={s.criterion}><td className="pr-4 text-slate-600">{s.criterion}</td><td className="font-medium">{s.score} / {s.maxScore}</td></tr>)}</tbody></table>
                  )}
                  {r.comments && <p className="mt-2 rounded bg-slate-50 p-2 text-sm">{r.comments}</p>}
                  {mine && (
                    <div className="mt-3 space-y-2">
                      <ReviewEditor reviewId={r.review_id} comments={r.comments} scores={r.scores} isGuide={access.isGuide} decision={r.decision} />
                      <NewFeedbackForm reviewId={r.review_id} people={people} />
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">{studentOnly ? 'Feedback assigned to you' : 'Feedback items'} <span className="text-sm font-normal text-slate-500">({open.length} open)</span></h2>
        {feedback.length === 0 ? <Empty>No feedback items.</Empty> : <div className="space-y-3">{open.map(item)}{done.length > 0 && <details className="text-sm"><summary className="cursor-pointer text-slate-600">Verified ({done.length})</summary><div className="mt-2 space-y-3">{done.map(item)}</div></details>}</div>}
      </section>
    </div>
  );
}
