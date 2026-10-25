import { query } from '@/lib/db/pg';

export interface MemberContribution {
  user_id: number; name: string; member_role: string; responsibility: string | null;
  verified_items: number; unverified_items: number; evidence_points: string; share_pct: string | null;
  avg_peer_score: string | null; indicator: string;
  by_type: Record<string, { verified: number; unverified: number }>;
}

/**
 * Per-member contribution for one project. Only VERIFIED evidence counts towards points and share (view
 * v_contribution_summary); the indicator is the database function fn_contribution_indicator (80% evidence
 * share + 20% peer share). `onlyUser` limits the result to one row (students see only their own).
 */
export async function contributionFor(projectId: number, onlyUser: number | null): Promise<MemberContribution[]> {
  const rows = await query<Omit<MemberContribution, 'by_type'>>(
    `SELECT cs.user_id, cs.name, tm.member_role, tm.responsibility, cs.verified_items::int, cs.unverified_items::int,
            cs.evidence_points, cs.share_pct, cs.avg_peer_score, fn_contribution_indicator(cs.project_id, cs.user_id) AS indicator
       FROM v_contribution_summary cs
       JOIN projects p ON p.project_id = cs.project_id
       JOIN team_members tm ON tm.team_id = p.team_id AND tm.user_id = cs.user_id
      WHERE cs.project_id = $1 AND ($2::int IS NULL OR cs.user_id = $2)
      ORDER BY cs.evidence_points DESC, cs.name`, [projectId, onlyUser]);
  // Q3 (conditional aggregation): evidence counts per member and type
  const types = await query<{ user_id: number; evidence_type: string; verified: number; unverified: number }>(
    `SELECT user_id, evidence_type,
            COUNT(*) FILTER (WHERE verified_flag)::int AS verified, COUNT(*) FILTER (WHERE NOT verified_flag)::int AS unverified
       FROM contribution_evidence WHERE project_id = $1 GROUP BY user_id, evidence_type`, [projectId]);
  return rows.map((r) => ({
    ...r,
    by_type: Object.fromEntries(types.filter((t) => t.user_id === r.user_id).map((t) => [t.evidence_type, { verified: t.verified, unverified: t.unverified }])),
  }));
}

export const EVIDENCE_MULTIPLIERS = [
  ['Verified task', 3], ['Document upload', 2], ['Feedback resolved', 2], ['Review participation', 1], ['Git activity', 1],
] as const;
