import { query } from '@/lib/db/pg';
import type { CurrentUser } from '@/lib/auth/session';

/**
 * Faculty reports (spec 10.2: Q1, Q2, Q5, Q10 and the feedback / imbalance variants). Every query is scoped:
 * an admin sees every project; a guide or reviewer sees only the projects allocated to them.
 * All values are bound parameters. The only dynamic SQL is ORDER BY, which comes from a fixed whitelist.
 */
export const REPORTS = {
  'high-risk': 'High-risk projects',
  'delayed-teams': 'Delayed teams',
  'unapproved-milestones': 'Unapproved milestones',
  'unresolved-feedback': 'Unresolved feedback',
  'missing-deliverables': 'Missing deliverables',
  'contribution-imbalance': 'Contribution imbalance',
} as const;
export type ReportName = keyof typeof REPORTS;

export interface ReportFilters {
  courseId?: number; guideId?: number; teamId?: number; status?: string;
  min: number; threshold: number; level: 'low' | 'moderate' | 'high' | 'critical'; overdueOnly: boolean;
  sort?: string; dir: 'asc' | 'desc';
}
export interface Column { key: string; label: string; kind?: 'text' | 'date' | 'chip' | 'num' | 'bool' | 'long' }
export interface ReportResult { columns: Column[]; rows: Record<string, any>[]; sortable: string[]; note?: string }

const LEVEL_SETS: Record<string, string[]> = {
  low: ['low', 'moderate', 'high', 'critical'], moderate: ['moderate', 'high', 'critical'], high: ['high', 'critical'], critical: ['critical'],
};

const PROJECT_COLS: Column[] = [{ key: 'team_name', label: 'Team' }, { key: 'course_name', label: 'Course' }, { key: 'guide', label: 'Guide' }];
const FROM_PROJECT = `JOIN teams t ON t.team_id = p.team_id JOIN courses c ON c.course_id = p.course_id`;
const GUIDE_NAME = `(SELECT u.name FROM guide_allocations ga JOIN users u ON u.user_id = ga.user_id WHERE ga.project_id = p.project_id AND ga.allocation_role = 'guide') AS guide`;

/** Builds the shared WHERE fragment (scope + filters) and its parameters, starting at $firstParam. */
function conditions(user: CurrentUser, f: ReportFilters, firstParam: number) {
  const params: unknown[] = [];
  const next = (v: unknown) => { params.push(v); return `$${firstParam + params.length - 1}`; };
  const where: string[] = [];
  if (!user.roles.includes('admin')) {
    where.push(`EXISTS (SELECT 1 FROM guide_allocations sga WHERE sga.project_id = p.project_id AND sga.user_id = ${next(user.userId)})`);
  }
  if (f.courseId) where.push(`p.course_id = ${next(f.courseId)}`);
  if (f.teamId) where.push(`p.team_id = ${next(f.teamId)}`);
  if (f.status) where.push(`p.status = ${next(f.status)}`);
  if (f.guideId) where.push(`EXISTS (SELECT 1 FROM guide_allocations fg WHERE fg.project_id = p.project_id AND fg.allocation_role = 'guide' AND fg.user_id = ${next(f.guideId)})`);
  return { sql: where.length ? ' AND ' + where.join(' AND ') : '', params };
}

function order(sortable: Record<string, string>, f: ReportFilters, fallback: string): string {
  const col = f.sort && sortable[f.sort] ? sortable[f.sort] : fallback;
  return `ORDER BY ${col} ${f.dir === 'asc' ? 'ASC' : 'DESC'} NULLS LAST, 1`;
}

export async function runReport(user: CurrentUser, name: ReportName, f: ReportFilters): Promise<ReportResult> {
  switch (name) {
    case 'high-risk': { // Q1
      const s = { team_name: 't.team_name', course_name: 'c.course_name', risk_score: 'd.risk_score', progress_pct: 'd.progress_pct', days_to_next_deadline: 'd.days_to_next_deadline' };
      const c = conditions(user, f, 2);
      const rows = await query(
        `SELECT p.project_id, t.team_name, c.course_name, ${GUIDE_NAME}, d.risk_score, d.risk_level, d.reason, d.progress_pct, d.days_to_next_deadline
           FROM v_faculty_risk_dashboard d JOIN projects p ON p.project_id = d.project_id ${FROM_PROJECT}
          WHERE d.risk_level = ANY($1::text[])${c.sql} ${order(s, f, 'd.risk_score')}`, [LEVEL_SETS[f.level], ...c.params]);
      return { rows, sortable: Object.keys(s), note: `Projects whose latest risk level is ${f.level === 'low' ? 'any' : f.level + ' or worse'}.`,
        columns: [...PROJECT_COLS, { key: 'risk_level', label: 'Risk', kind: 'chip' }, { key: 'risk_score', label: 'Score', kind: 'num' }, { key: 'progress_pct', label: 'Progress %', kind: 'num' }, { key: 'days_to_next_deadline', label: 'Days to deadline', kind: 'num' }, { key: 'reason', label: 'Why', kind: 'long' }] };
    }
    case 'delayed-teams': { // Q2: JOIN + GROUP BY + HAVING + date arithmetic
      const s = { team_name: 't.team_name', course_name: 'c.course_name', overdue_tasks: 'COUNT(*)', max_days_late: 'MAX(CURRENT_DATE - tk.due_date)' };
      const c = conditions(user, f, 2);
      const rows = await query(
        `SELECT p.project_id, t.team_name, c.course_name, ${GUIDE_NAME}, COUNT(*)::int AS overdue_tasks, MAX(CURRENT_DATE - tk.due_date)::int AS max_days_late
           FROM tasks tk JOIN milestones m ON m.milestone_id = tk.milestone_id JOIN projects p ON p.project_id = m.project_id ${FROM_PROJECT}
          WHERE tk.due_date < CURRENT_DATE AND tk.status NOT IN ('done','verified')${c.sql}
          GROUP BY p.project_id, t.team_name, c.course_name
         HAVING COUNT(*) > $1 ${order(s, f, 'COUNT(*)')}`, [f.min, ...c.params]);
      return { rows, sortable: Object.keys(s), note: `Teams with more than ${f.min} overdue task(s).`,
        columns: [...PROJECT_COLS, { key: 'overdue_tasks', label: 'Overdue tasks', kind: 'num' }, { key: 'max_days_late', label: 'Most days late', kind: 'num' }] };
    }
    case 'unapproved-milestones': { // Q10
      const s = { team_name: 't.team_name', course_name: 'c.course_name', days_overdue: 'days_overdue', due_date: 'm.due_date' };
      const c = conditions(user, f, 1);
      const rows = await query(
        `SELECT p.project_id, t.team_name, c.course_name, ${GUIDE_NAME}, m.sequence_no, m.title, m.status, m.due_date, (CURRENT_DATE - m.due_date)::int AS days_overdue
           FROM milestones m JOIN projects p ON p.project_id = m.project_id ${FROM_PROJECT}
          WHERE m.status <> 'approved' AND m.due_date < CURRENT_DATE AND p.status IN ('approved','in_progress')${c.sql} ${order(s, f, 'days_overdue')}`, c.params);
      return { rows, sortable: Object.keys(s), note: 'Milestones past their due date that are not approved yet.',
        columns: [...PROJECT_COLS, { key: 'title', label: 'Milestone' }, { key: 'status', label: 'Status', kind: 'chip' }, { key: 'due_date', label: 'Due', kind: 'date' }, { key: 'days_overdue', label: 'Days overdue', kind: 'num' }] };
    }
    case 'unresolved-feedback': {
      const s = { team_name: 't.team_name', due_date: 'uf.due_date', age_days: 'uf.age_days', severity: 'uf.severity' };
      const c = conditions(user, f, 1);
      const rows = await query(
        `SELECT p.project_id, t.team_name, c.course_name, ${GUIDE_NAME}, uf.milestone_title, uf.description, uf.severity, uf.resolution_status, uf.assigned_to, uf.due_date, uf.is_overdue, uf.age_days::int AS age_days
           FROM v_unresolved_feedback uf JOIN projects p ON p.project_id = uf.project_id ${FROM_PROJECT}
          WHERE true${f.overdueOnly ? ' AND uf.is_overdue' : ''}${c.sql} ${order(s, f, 'uf.due_date')}`, c.params);
      return { rows, sortable: Object.keys(s), note: 'Feedback items that are not verified yet (open, in progress, reopened or resolved but unchecked).',
        columns: [...PROJECT_COLS, { key: 'milestone_title', label: 'Milestone' }, { key: 'description', label: 'Feedback', kind: 'long' }, { key: 'severity', label: 'Severity', kind: 'chip' }, { key: 'resolution_status', label: 'Status', kind: 'chip' }, { key: 'assigned_to', label: 'Assigned to' }, { key: 'due_date', label: 'Due', kind: 'date' }, { key: 'age_days', label: 'Age (days)', kind: 'num' }] };
    }
    case 'missing-deliverables': { // Q5: anti-join view + GROUP BY / HAVING
      const s = { team_name: 't.team_name', course_name: 'c.course_name', missing_count: 'COUNT(*)' };
      const c = conditions(user, f, 1);
      const rows = await query(
        `SELECT p.project_id, t.team_name, c.course_name, ${GUIDE_NAME}, COUNT(*)::int AS missing_count,
                string_agg(vm.milestone_title || ': ' || replace(vm.missing_type, '_', ' '), '; ' ORDER BY vm.due_date) AS missing
           FROM v_missing_mandatory_deliverables vm JOIN projects p ON p.project_id = vm.project_id ${FROM_PROJECT}
          WHERE true${c.sql} GROUP BY p.project_id, t.team_name, c.course_name HAVING COUNT(*) >= 1 ${order(s, f, 'COUNT(*)')}`, c.params);
      return { rows, sortable: Object.keys(s), note: 'Mandatory deliverable types still missing on milestones that are overdue or due within 7 days.',
        columns: [...PROJECT_COLS, { key: 'missing_count', label: 'Missing', kind: 'num' }, { key: 'missing', label: 'Which', kind: 'long' }] };
    }
    case 'contribution-imbalance': {
      const s = { team_name: 't.team_name', course_name: 'c.course_name', top_share: 's.share_pct', team_points: 's.total' };
      const c = conditions(user, f, 2);
      const rows = await query(
        `WITH s AS (
           SELECT cs.project_id, cs.name, cs.share_pct, cs.evidence_points,
                  COUNT(*) OVER (PARTITION BY cs.project_id) AS members, SUM(cs.evidence_points) OVER (PARTITION BY cs.project_id) AS total,
                  ROW_NUMBER() OVER (PARTITION BY cs.project_id ORDER BY cs.evidence_points DESC, cs.name) AS rn
             FROM v_contribution_summary cs)
         SELECT p.project_id, t.team_name, c.course_name, ${GUIDE_NAME}, s.name AS top_member, s.share_pct AS top_share, s.members::int AS members, s.total AS team_points
           FROM s JOIN projects p ON p.project_id = s.project_id ${FROM_PROJECT}
          WHERE s.rn = 1 AND s.members >= 2 AND s.total >= 5 AND s.share_pct >= $1${c.sql} ${order(s, f, 's.share_pct')}`, [f.threshold, ...c.params]);
      return { rows, sortable: Object.keys(s), note: `Teams where one member holds ${f.threshold}% or more of the verified evidence points (needs 2+ members and 5+ points).`,
        columns: [...PROJECT_COLS, { key: 'top_member', label: 'Top contributor' }, { key: 'top_share', label: 'Share %', kind: 'num' }, { key: 'members', label: 'Members', kind: 'num' }, { key: 'team_points', label: 'Team points', kind: 'num' }] };
    }
  }
}

/** CSV with a guard against spreadsheet formula injection (cells starting with = + - @ are prefixed). */
export function toCsv(columns: Column[], rows: Record<string, any>[]): string {
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map((c) => cell(c.label)).join(','), ...rows.map((r) => columns.map((c) => cell(r[c.key])).join(','))].join('\r\n') + '\r\n';
}
