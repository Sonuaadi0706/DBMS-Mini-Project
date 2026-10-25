import { query } from '@/lib/db/pg';

// Dashboard read models. They lean on the database views (v_faculty_risk_dashboard, v_unresolved_feedback,
// v_overdue_tasks_by_team, v_project_progress) so the numbers match the reports and the risk page exactly.

export interface DashProject {
  project_id: number; title: string; team_name: string; course_name: string; progress_pct: string;
  overdue_tasks: number; missing_evidence: number; unresolved_feedback: number;
  risk_score: string | null; risk_level: string | null; reason: string | null; days_to_next_deadline: number | null;
}

const GUIDE_PROJECTS = `SELECT ga.project_id FROM guide_allocations ga WHERE ga.user_id = $1 AND ga.allocation_role = 'guide'`;

export async function guideDashboard(userId: number) {
  const [projects, proposals, milestones, evidence, feedback, delayed] = await Promise.all([
    query<DashProject>(
      `SELECT d.project_id, d.title, d.team_name, d.course_name, d.progress_pct, d.overdue_tasks::int, d.missing_evidence::int,
              d.unresolved_feedback::int, d.risk_score, d.risk_level, d.reason, d.days_to_next_deadline
         FROM v_faculty_risk_dashboard d WHERE d.guide_id = $1 ORDER BY d.risk_score DESC NULLS LAST, d.days_to_next_deadline NULLS LAST`, [userId]),
    query<{ project_id: number; title: string; team_name: string; submitted_at: string }>(
      `SELECT p.project_id, p.title, t.team_name, p.submitted_at FROM projects p JOIN teams t ON t.team_id = p.team_id
        WHERE p.status = 'submitted' AND p.project_id IN (${GUIDE_PROJECTS}) ORDER BY p.submitted_at`, [userId]),
    query<{ milestone_id: number; project_id: number; title: string; team_name: string; status: string; submitted_at: string | null }>(
      `SELECT m.milestone_id, m.project_id, m.title, t.team_name, m.status, m.submitted_at
         FROM milestones m JOIN projects p ON p.project_id = m.project_id JOIN teams t ON t.team_id = p.team_id
        WHERE m.status IN ('submitted','under_review') AND m.project_id IN (${GUIDE_PROJECTS}) ORDER BY m.submitted_at`, [userId]),
    query<{ project_id: number; team_name: string; waiting: number }>(
      `SELECT ce.project_id, t.team_name, COUNT(*)::int AS waiting
         FROM contribution_evidence ce JOIN projects p ON p.project_id = ce.project_id JOIN teams t ON t.team_id = p.team_id
        WHERE NOT ce.verified_flag AND ce.project_id IN (${GUIDE_PROJECTS}) GROUP BY ce.project_id, t.team_name ORDER BY waiting DESC`, [userId]),
    query<{ feedback_id: number; description: string; project_id: number; team_name: string; assigned_to: string; resolution_status: string; due_date: string | null; is_overdue: boolean }>(
      `SELECT uf.feedback_id, uf.description, uf.project_id, uf.team_name, uf.assigned_to, uf.resolution_status, uf.due_date, uf.is_overdue
         FROM v_unresolved_feedback uf WHERE uf.project_id IN (${GUIDE_PROJECTS})
        ORDER BY uf.is_overdue DESC, uf.due_date NULLS LAST LIMIT 8`, [userId]),
    query<{ team_name: string; project_id: number; overdue_tasks: number; max_days_late: number }>(
      `SELECT v.team_name, p.project_id, v.overdue_tasks::int, v.max_days_late
         FROM v_overdue_tasks_by_team v JOIN projects p ON p.team_id = v.team_id
        WHERE p.project_id IN (${GUIDE_PROJECTS}) ORDER BY v.overdue_tasks DESC`, [userId]),
  ]);
  return { projects, proposals, milestones, evidence, feedback, delayed };
}

export async function reviewerDashboard(userId: number) {
  const [pending, decided, projects] = await Promise.all([
    query<{ review_id: number; milestone_id: number; milestone_title: string; sequence_no: number; milestone_status: string; project_id: number; project_title: string; team_name: string; due_date: string; submitted_at: string | null }>(
      `SELECT r.review_id, m.milestone_id, m.title AS milestone_title, m.sequence_no, m.status AS milestone_status, p.project_id,
              p.title AS project_title, t.team_name, m.due_date, m.submitted_at
         FROM reviews r JOIN milestones m ON m.milestone_id = r.milestone_id JOIN projects p ON p.project_id = m.project_id JOIN teams t ON t.team_id = p.team_id
        WHERE r.reviewer_id = $1 AND r.decision = 'pending' ORDER BY m.submitted_at NULLS LAST`, [userId]),
    query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM reviews WHERE reviewer_id = $1 AND decision <> 'pending'`, [userId]),
    query<{ project_id: number; title: string; team_name: string; status: string }>(
      `SELECT p.project_id, p.title, t.team_name, p.status FROM guide_allocations ga JOIN projects p ON p.project_id = ga.project_id
         JOIN teams t ON t.team_id = p.team_id WHERE ga.user_id = $1 AND ga.allocation_role = 'reviewer' ORDER BY t.team_name`, [userId]),
  ]);
  return { pending, decided: decided[0].n, projects };
}

export async function adminDashboard() {
  const [users, projects, counts, heat, noGuide, unassessed] = await Promise.all([
    query<{ role_name: string; n: number }>(`SELECT r.role_name, COUNT(*)::int AS n FROM user_roles ur JOIN roles r USING (role_id) JOIN users u USING (user_id) WHERE u.status = 'active' GROUP BY r.role_name`),
    query<{ status: string; n: number }>(`SELECT status, COUNT(*)::int AS n FROM projects GROUP BY status`),
    query<{ teams: number; open_feedback: number; overdue_milestones: number; pending_evidence: number; open_events: number }>(
      `SELECT (SELECT COUNT(*) FROM teams)::int AS teams,
              (SELECT COUNT(*) FROM feedback_items WHERE resolution_status <> 'verified')::int AS open_feedback,
              (SELECT COUNT(*) FROM milestones m JOIN projects p USING (project_id) WHERE m.status <> 'approved' AND m.due_date < CURRENT_DATE AND p.status IN ('approved','in_progress'))::int AS overdue_milestones,
              (SELECT COUNT(*) FROM contribution_evidence WHERE NOT verified_flag)::int AS pending_evidence,
              (SELECT COUNT(*) FROM risk_events WHERE resolved_at IS NULL)::int AS open_events`),
    query<{ course_name: string; risk_level: string | null; n: number }>(
      `SELECT course_name, COALESCE(risk_level, 'unassessed') AS risk_level, COUNT(*)::int AS n FROM v_faculty_risk_dashboard GROUP BY 1, 2 ORDER BY 1`),
    query<{ project_id: number; title: string; team_name: string; status: string }>(
      `SELECT p.project_id, p.title, t.team_name, p.status FROM projects p JOIN teams t ON t.team_id = p.team_id
        WHERE p.status IN ('submitted','approved','in_progress') AND NOT EXISTS (SELECT 1 FROM guide_allocations ga WHERE ga.project_id = p.project_id AND ga.allocation_role = 'guide')
        ORDER BY p.status, t.team_name`),
    query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM projects p WHERE p.status IN ('approved','in_progress') AND NOT EXISTS (SELECT 1 FROM risk_assessments r WHERE r.project_id = p.project_id)`),
  ]);
  return { users, projects, counts: counts[0], heat, noGuide, unassessed: unassessed[0].n };
}

export async function studentOverview(userId: number, projectId: number) {
  const [tasks, nextMilestones] = await Promise.all([
    query<{ task_id: number; title: string; status: string; due_date: string; is_overdue: boolean; sequence_no: number }>(
      `SELECT t.task_id, t.title, t.status, t.due_date, (t.due_date < CURRENT_DATE AND t.status NOT IN ('done','verified')) AS is_overdue, m.sequence_no
         FROM task_assignments ta JOIN tasks t ON t.task_id = ta.task_id JOIN milestones m ON m.milestone_id = t.milestone_id
        WHERE ta.user_id = $1 AND m.project_id = $2 AND t.status <> 'verified'
        ORDER BY (t.due_date < CURRENT_DATE AND t.status NOT IN ('done','verified')) DESC, t.due_date, t.task_id LIMIT 8`, [userId, projectId]),
    query<{ milestone_id: number; title: string; due_date: string; status: string; days_to_due: number; sequence_no: number }>(
      `SELECT milestone_id, title, due_date, status, (due_date - CURRENT_DATE) AS days_to_due, sequence_no
         FROM milestones WHERE project_id = $1 AND status <> 'approved' ORDER BY due_date LIMIT 3`, [projectId]),
  ]);
  return { tasks, nextMilestones };
}
