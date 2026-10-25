import { query } from '@/lib/db/pg';

export interface PeerSummaryStaff {
  perMember: { user_id: number; name: string; avg_score: string | null; ratings: number }[];
  evaluations: { evaluation_id: number; milestone: string | null; evaluator: string; evaluatee: string; score: string; comments: string | null; created_at: string }[];
}
export interface PeerSummaryStudent {
  received: { avg_score: number | null; ratings: number; comments: string[] };
  given: { milestone_id: number | null; evaluatee_id: number }[];
}

/**
 * Staff see who rated whom (accountability). A student sees only an AGGREGATE of what they received, with the
 * comments stripped of any author, plus which ratings they have already given (so they can finish the rest).
 */
export async function peerSummaryStaff(projectId: number): Promise<PeerSummaryStaff> {
  const [perMember, evaluations] = await Promise.all([
    query<PeerSummaryStaff['perMember'][number]>(
      `SELECT tm.user_id, u.name, ROUND(AVG(pe.score), 2) AS avg_score, COUNT(pe.evaluation_id)::int AS ratings
         FROM projects p JOIN team_members tm ON tm.team_id = p.team_id JOIN users u ON u.user_id = tm.user_id
         LEFT JOIN peer_evaluations pe ON pe.project_id = p.project_id AND pe.evaluatee_id = tm.user_id
        WHERE p.project_id = $1 GROUP BY tm.user_id, u.name ORDER BY u.name`, [projectId]),
    query<PeerSummaryStaff['evaluations'][number]>(
      `SELECT pe.evaluation_id, m.title AS milestone, ev.name AS evaluator, ee.name AS evaluatee, pe.score, pe.comments, pe.created_at
         FROM peer_evaluations pe LEFT JOIN milestones m ON m.milestone_id = pe.milestone_id
         JOIN users ev ON ev.user_id = pe.evaluator_id JOIN users ee ON ee.user_id = pe.evaluatee_id
        WHERE pe.project_id = $1 ORDER BY pe.created_at DESC, pe.evaluation_id DESC`, [projectId]),
  ]);
  return { perMember, evaluations };
}

export async function peerSummaryStudent(projectId: number, userId: number): Promise<PeerSummaryStudent> {
  const [agg, comments, given] = await Promise.all([
    query<{ avg: string | null; n: number }>(`SELECT ROUND(AVG(score), 2) AS avg, COUNT(*)::int AS n FROM peer_evaluations WHERE project_id = $1 AND evaluatee_id = $2`, [projectId, userId]),
    query<{ comments: string }>(`SELECT comments FROM peer_evaluations WHERE project_id = $1 AND evaluatee_id = $2 AND comments IS NOT NULL AND comments <> '' ORDER BY evaluation_id`, [projectId, userId]),
    query<{ milestone_id: number | null; evaluatee_id: number }>(`SELECT milestone_id, evaluatee_id FROM peer_evaluations WHERE project_id = $1 AND evaluator_id = $2`, [projectId, userId]),
  ]);
  return { received: { avg_score: agg[0].avg === null ? null : Number(agg[0].avg), ratings: agg[0].n, comments: comments.map((c) => c.comments) }, given };
}
