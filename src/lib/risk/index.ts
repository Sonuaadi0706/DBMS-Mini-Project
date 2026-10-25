import { query } from '@/lib/db/pg';

/**
 * Delivery risk is calculated INSIDE PostgreSQL (fn_calculate_project_risk, sp_recalculate_risk) so the API, the
 * sweep script and psql always agree. This module only calls those routines and reads the stored snapshots.
 */
export interface RiskSnapshot {
  risk_id: number; risk_score: string; risk_level: 'low' | 'moderate' | 'high' | 'critical';
  reason: string; breakdown: Record<string, number>; calculated_at: string;
}

/** Same factors and caps as spec 9.6 (and the SQL function). Shown in the UI so nothing is a black box. */
export const RISK_FACTORS = [
  { key: 'overdue_milestones', label: 'Overdue milestones', max: 25, rule: '12.5 points for each unapproved milestone past its due date' },
  { key: 'overdue_tasks', label: 'Overdue tasks', max: 20, rule: '4 points for each open task past its due date' },
  { key: 'missing_deliverables', label: 'Missing mandatory deliverables', max: 20, rule: '10 points for each required deliverable type missing on a milestone due within 7 days or overdue' },
  { key: 'unresolved_feedback', label: 'Unresolved feedback', max: 15, rule: '3 points per unverified item, plus 2 more if it is overdue' },
  { key: 'inactivity', label: 'Inactivity', max: 10, rule: 'No task update, upload or evidence: up to 5 days 0, 6 to 10 days 5, more than 10 days 10' },
  { key: 'contribution_imbalance', label: 'Contribution imbalance', max: 10, rule: '10 x how far the top member\'s share is above an equal split (needs 2+ members and 5+ verified points)' },
] as const;

export const RISK_LEVELS = [
  { level: 'low', range: '0 to 24.99' }, { level: 'moderate', range: '25 to 49.99' },
  { level: 'high', range: '50 to 74.99' }, { level: 'critical', range: '75 to 100' },
] as const;

export async function latestSnapshot(projectId: number): Promise<RiskSnapshot | undefined> {
  const [r] = await query<RiskSnapshot>(
    `SELECT risk_id, risk_score, risk_level, reason, breakdown, calculated_at FROM risk_assessments
      WHERE project_id = $1 ORDER BY calculated_at DESC, risk_id DESC LIMIT 1`, [projectId]);
  return r;
}

/** Always stores a new snapshot (explicit "Recalculate" and the sweep). */
export async function recalculateRisk(projectId: number): Promise<RiskSnapshot> {
  await query(`CALL sp_recalculate_risk($1)`, [projectId]);
  return (await latestSnapshot(projectId))!;
}

/**
 * Called after key events (milestone / task / feedback / evidence changes). Stores a snapshot only when the
 * result differs from the latest one, so the history shows real changes instead of noise. Never throws:
 * the action that triggered it has already succeeded.
 */
export async function refreshRiskSafely(projectId: number): Promise<void> {
  try {
    await query(
      `INSERT INTO risk_assessments(project_id, risk_score, risk_level, reason, breakdown)
       SELECT $1, c.risk_score, c.risk_level, c.reason, c.breakdown
         FROM fn_calculate_project_risk($1) c JOIN projects p ON p.project_id = $1 AND p.status IN ('approved','in_progress')
        WHERE NOT EXISTS (SELECT 1 FROM (SELECT risk_score, reason FROM risk_assessments WHERE project_id = $1
                                          ORDER BY calculated_at DESC, risk_id DESC LIMIT 1) l
                           WHERE l.risk_score = c.risk_score AND l.reason = c.reason)`, [projectId]);
  } catch (e) {
    console.error('Risk refresh failed', e);
  }
}

export interface TrendPoint { day: string; score: number }

/** Q8: one point per day (the day's highest score) for the trend chart. */
export async function riskTrend(projectId: number): Promise<TrendPoint[]> {
  const rows = await query<{ day: string; score: string }>(
    `SELECT calculated_at::date::text AS day, MAX(risk_score) AS score FROM risk_assessments
      WHERE project_id = $1 GROUP BY 1 ORDER BY 1`, [projectId]);
  return rows.map((r) => ({ day: r.day, score: Number(r.score) }));
}

export function riskEvents(projectId: number) {
  return query<{ event_id: number; event_type: string; details: string | null; created_at: string; resolved_at: string | null; milestone_title: string | null }>(
    `SELECT e.event_id, e.event_type, e.details, e.created_at, e.resolved_at, m.title AS milestone_title
       FROM risk_events e LEFT JOIN milestones m ON m.milestone_id = e.milestone_id
      WHERE e.project_id = $1 ORDER BY (e.resolved_at IS NOT NULL), e.created_at DESC`, [projectId]);
}
