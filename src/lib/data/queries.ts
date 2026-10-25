import { query } from '@/lib/db/pg';
import type { CurrentUser } from '@/lib/auth/session';

// Read queries shared by Route Handlers and Server Components. Parameterised SQL only.

export interface ProposalRow {
  project_id: number; title: string; status: string; domain: string | null; submitted_at: string | null;
  updated_at: string; team_id: number; team_name: string; course_id: number; course_name: string; guide_name: string | null;
}

/** Projects the user may see: admin = all; everyone else = own team's or allocated to them. */
export function listProjects(user: CurrentUser, status?: string | null): Promise<ProposalRow[]> {
  return query<ProposalRow>(
    `SELECT p.project_id, p.title, p.status, p.domain, p.submitted_at, p.updated_at,
            t.team_id, t.team_name, c.course_id, c.course_name,
            (SELECT u.name FROM guide_allocations ga JOIN users u ON u.user_id = ga.user_id
              WHERE ga.project_id = p.project_id AND ga.allocation_role = 'guide') AS guide_name
       FROM projects p
       JOIN teams t ON t.team_id = p.team_id
       JOIN courses c ON c.course_id = p.course_id
      WHERE ($1::text IS NULL OR p.status = $1)
        AND ($2::boolean
             OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = p.team_id AND tm.user_id = $3)
             OR EXISTS (SELECT 1 FROM guide_allocations ga WHERE ga.project_id = p.project_id AND ga.user_id = $3))
      ORDER BY p.updated_at DESC`,
    [status ?? null, user.roles.includes('admin'), user.userId],
  );
}

export interface ProjectDetail {
  project_id: number; team_id: number; course_id: number; template_id: number | null;
  title: string; abstract: string | null; problem_statement: string | null; objectives: string | null; scope: string | null;
  domain: string | null; technologies: string[]; repo_link: string | null; status: string;
  start_date: string | null; end_date: string | null; submitted_at: string | null; approved_at: string | null;
  team_name: string; course_name: string; created_by: number;
}

export async function getProject(projectId: number): Promise<ProjectDetail | undefined> {
  const [row] = await query<ProjectDetail>(
    `SELECT p.project_id, p.team_id, p.course_id, p.template_id, p.title, p.abstract, p.problem_statement, p.objectives,
            p.scope, p.domain, p.technologies, p.repo_link, p.status, p.start_date, p.end_date, p.submitted_at,
            p.approved_at, p.created_by, t.team_name, c.course_name
       FROM projects p JOIN teams t ON t.team_id = p.team_id JOIN courses c ON c.course_id = p.course_id
      WHERE p.project_id = $1`, [projectId]);
  return row;
}

export interface HistoryRow { action_id: number; action: string; from_status: string; to_status: string; comments: string | null; created_at: string; actor_name: string }

export function getProposalHistory(projectId: number): Promise<HistoryRow[]> {
  return query<HistoryRow>(
    `SELECT pa.action_id, pa.action, pa.from_status, pa.to_status, pa.comments, pa.created_at, u.name AS actor_name
       FROM proposal_actions pa JOIN users u ON u.user_id = pa.actor_id
      WHERE pa.project_id = $1 ORDER BY pa.created_at, pa.action_id`, [projectId]);
}

export interface Allocation { allocation_id: number; user_id: number; name: string; allocation_role: 'guide' | 'reviewer' }

export function getAllocations(projectId: number): Promise<Allocation[]> {
  return query<Allocation>(
    `SELECT ga.allocation_id, ga.user_id, u.name, ga.allocation_role
       FROM guide_allocations ga JOIN users u ON u.user_id = ga.user_id
      WHERE ga.project_id = $1 ORDER BY ga.allocation_role, u.name`, [projectId]);
}

// ---- teams ------------------------------------------------------------------------------------
export interface TeamRow { team_id: number; team_name: string; course_id: number; course_name: string; member_count: number; project_id: number | null; project_title: string | null; project_status: string | null }

export function listTeams(user: CurrentUser): Promise<TeamRow[]> {
  return query<TeamRow>(
    `SELECT t.team_id, t.team_name, c.course_id, c.course_name,
            (SELECT COUNT(*)::int FROM team_members tm WHERE tm.team_id = t.team_id) AS member_count,
            p.project_id, p.title AS project_title, p.status AS project_status
       FROM teams t JOIN courses c ON c.course_id = t.course_id
       LEFT JOIN projects p ON p.team_id = t.team_id AND p.status NOT IN ('rejected','archived')
      WHERE $1::boolean
         OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = t.team_id AND tm.user_id = $2)
         OR EXISTS (SELECT 1 FROM guide_allocations ga JOIN projects gp ON gp.project_id = ga.project_id
                     WHERE gp.team_id = t.team_id AND ga.user_id = $2)
      ORDER BY c.course_name, t.team_name`,
    [user.roles.includes('admin'), user.userId]);
}

export interface MemberRow { user_id: number; name: string; email: string; identifier: string | null; member_role: string; responsibility: string | null }

export function getTeamMembers(teamId: number): Promise<MemberRow[]> {
  return query<MemberRow>(
    `SELECT tm.user_id, u.name, u.email::text AS email, u.identifier, tm.member_role, tm.responsibility
       FROM team_members tm JOIN users u ON u.user_id = tm.user_id
      WHERE tm.team_id = $1 ORDER BY (tm.member_role = 'leader') DESC, u.name`, [teamId]);
}

/** Active students not yet in any team of this course. */
export function teamCandidates(courseId: number): Promise<{ user_id: number; name: string; identifier: string | null }[]> {
  return query(
    `SELECT u.user_id, u.name, u.identifier
       FROM users u JOIN user_roles ur ON ur.user_id = u.user_id JOIN roles r ON r.role_id = ur.role_id AND r.role_name = 'student'
      WHERE u.status = 'active'
        AND NOT EXISTS (SELECT 1 FROM team_members tm WHERE tm.course_id = $1 AND tm.user_id = u.user_id)
      ORDER BY u.name`, [courseId]);
}

export function listCourses() {
  return query<{ course_id: number; course_code: string; course_name: string; semester: string; academic_year: string }>(
    `SELECT course_id, course_code, course_name, semester, academic_year FROM courses WHERE is_active ORDER BY course_name`);
}

export function listTemplates() {
  return query<{ template_id: number; name: string; description: string | null; milestones: number }>(
    `SELECT t.template_id, t.name, t.description,
            (SELECT COUNT(*)::int FROM template_milestones tm WHERE tm.template_id = t.template_id) AS milestones
       FROM project_templates t WHERE t.is_active ORDER BY t.name`);
}

// ---- milestones / tasks -----------------------------------------------------------------------
export interface MilestoneRow {
  milestone_id: number; sequence_no: number; title: string; description: string | null;
  start_date: string | null; due_date: string; status: string; weightage: string;
  submitted_at: string | null; approved_at: string | null; approval_comments: string | null;
  completion_pct: string; task_count: number; tasks_done: number; days_to_due: number;
  required: string[]; delivered: string[];
}

export function listMilestones(projectId: number): Promise<MilestoneRow[]> {
  return query<MilestoneRow>(
    `SELECT m.milestone_id, m.sequence_no, m.title, m.description, m.start_date, m.due_date, m.status, m.weightage,
            m.submitted_at, m.approved_at, m.approval_comments,
            fn_milestone_completion_pct(m.milestone_id) AS completion_pct,
            (SELECT COUNT(*)::int FROM tasks t WHERE t.milestone_id = m.milestone_id) AS task_count,
            (SELECT COUNT(*)::int FROM tasks t WHERE t.milestone_id = m.milestone_id AND t.status IN ('done','verified')) AS tasks_done,
            (m.due_date - CURRENT_DATE) AS days_to_due,
            COALESCE((SELECT array_agg(r.deliverable_type ORDER BY r.deliverable_type) FROM milestone_required_deliverables r
                       WHERE r.milestone_id = m.milestone_id), '{}') AS required,
            COALESCE((SELECT array_agg(DISTINCT d.deliverable_type) FROM deliverables d
                       WHERE d.milestone_id = m.milestone_id AND d.status IN ('submitted','accepted')), '{}') AS delivered
       FROM milestones m WHERE m.project_id = $1 ORDER BY m.sequence_no`, [projectId]);
}

export interface TaskRow {
  task_id: number; milestone_id: number; milestone_title: string; sequence_no: number;
  title: string; description: string | null; status: string; priority: string; effort_hours: string;
  planned_start_date: string | null; planned_completion_date: string; actual_completion_date: string | null; due_date: string;
  is_overdue: boolean; assignees: { userId: number; name: string; type: 'owner' | 'collaborator' }[];
}

export function listProjectTasks(projectId: number): Promise<TaskRow[]> {
  return query<TaskRow>(
    `SELECT tk.task_id, tk.milestone_id, m.title AS milestone_title, m.sequence_no, tk.title, tk.description, tk.status,
            tk.priority, tk.effort_hours, tk.planned_start_date, tk.planned_completion_date, tk.actual_completion_date, tk.due_date,
            (tk.due_date < CURRENT_DATE AND tk.status NOT IN ('done','verified')) AS is_overdue,
            COALESCE(json_agg(json_build_object('userId', u.user_id, 'name', u.name, 'type', ta.assignment_type)
                              ORDER BY ta.assignment_type DESC, u.name) FILTER (WHERE u.user_id IS NOT NULL), '[]') AS assignees
       FROM tasks tk
       JOIN milestones m ON m.milestone_id = tk.milestone_id
       LEFT JOIN task_assignments ta ON ta.task_id = tk.task_id
       LEFT JOIN users u ON u.user_id = ta.user_id
      WHERE m.project_id = $1
      GROUP BY tk.task_id, m.milestone_id
      ORDER BY m.sequence_no, tk.due_date, tk.task_id`, [projectId]);
}

export function projectProgress(projectId: number) {
  return query<{ progress_pct: string; milestone_count: number; milestones_approved: number }>(
    `SELECT progress_pct, milestone_count::int, milestones_approved::int FROM v_project_progress WHERE project_id = $1`, [projectId]);
}

export function latestRisk(projectId: number) {
  return query<{ risk_score: string; risk_level: string; reason: string; calculated_at: string }>(
    `SELECT risk_score, risk_level, reason, calculated_at FROM v_latest_risk WHERE project_id = $1`, [projectId]);
}

export function teamMemberOptions(teamId: number) {
  return query<{ user_id: number; name: string }>(
    `SELECT tm.user_id, u.name FROM team_members tm JOIN users u ON u.user_id = tm.user_id WHERE tm.team_id = $1 ORDER BY u.name`, [teamId]);
}

// ---- deliverables -----------------------------------------------------------------------------
export interface VersionView {
  versionId: number; versionNumber: number; changeSummary: string; fileName: string | null; fileUrl: string | null;
  sizeBytes: number | null; uploadedAt: string; uploadedBy: string;
}
export interface DeliverableRow {
  deliverable_id: number; milestone_id: number; deliverable_type: string; title: string; status: string;
  repo_link: string | null; evidence_url: string | null; submitted_at: string | null; submitted_by_name: string; versions: VersionView[];
}

export function listDeliverables(projectId: number): Promise<DeliverableRow[]> {
  return query<DeliverableRow>(
    `SELECT d.deliverable_id, d.milestone_id, d.deliverable_type, d.title, d.status, d.repo_link, d.evidence_url,
            d.submitted_at, u.name AS submitted_by_name,
            COALESCE((SELECT json_agg(json_build_object('versionId', v.version_id, 'versionNumber', v.version_number,
                        'changeSummary', v.change_summary, 'fileName', v.file_name, 'fileUrl', v.file_url,
                        'sizeBytes', v.file_size_bytes, 'uploadedAt', v.uploaded_at, 'uploadedBy', uu.name) ORDER BY v.version_number DESC)
                       FROM document_versions v JOIN users uu ON uu.user_id = v.uploaded_by WHERE v.deliverable_id = d.deliverable_id), '[]') AS versions
       FROM deliverables d JOIN milestones m ON m.milestone_id = d.milestone_id JOIN users u ON u.user_id = d.submitted_by
      WHERE m.project_id = $1 ORDER BY m.sequence_no, d.deliverable_id`, [projectId]);
}

// ---- reviews / feedback / evidence ------------------------------------------------------------
export interface ReviewRow {
  review_id: number; milestone_id: number; milestone_title: string; sequence_no: number; reviewer_id: number; reviewer_name: string;
  review_type: string; decision: string; comments: string | null; total_score: string | null; review_date: string | null; created_at: string;
  scores: { criterion: string; maxScore: number; score: number }[]; feedback_count: number;
}

export function listReviews(projectId: number): Promise<ReviewRow[]> {
  return query<ReviewRow>(
    `SELECT r.review_id, r.milestone_id, m.title AS milestone_title, m.sequence_no, r.reviewer_id, u.name AS reviewer_name, r.review_type,
            r.decision, r.comments, r.total_score, r.review_date, r.created_at,
            COALESCE((SELECT json_agg(json_build_object('criterion', s.criterion, 'maxScore', s.max_score, 'score', s.score) ORDER BY s.criterion)
                        FROM review_scores s WHERE s.review_id = r.review_id), '[]') AS scores,
            (SELECT COUNT(*)::int FROM feedback_items f WHERE f.review_id = r.review_id) AS feedback_count
       FROM reviews r JOIN milestones m ON m.milestone_id = r.milestone_id JOIN users u ON u.user_id = r.reviewer_id
      WHERE m.project_id = $1 ORDER BY m.sequence_no, r.created_at, r.review_id`, [projectId]);
}

export interface FeedbackRow {
  feedback_id: number; review_id: number; milestone_id: number; milestone_title: string; sequence_no: number;
  description: string; severity: string; resolution_status: string; response_text: string | null; due_date: string | null;
  is_overdue: boolean; created_at: string; resolved_at: string | null; assigned_user_id: number; assigned_to: string; created_by_name: string;
}

/** `onlyAssignedTo` limits the list for students (they see only feedback assigned to them). */
export function listFeedback(projectId: number, onlyAssignedTo: number | null): Promise<FeedbackRow[]> {
  return query<FeedbackRow>(
    `SELECT f.feedback_id, f.review_id, m.milestone_id, m.title AS milestone_title, m.sequence_no, f.description, f.severity,
            f.resolution_status, f.response_text, f.due_date,
            (f.due_date IS NOT NULL AND f.due_date < CURRENT_DATE AND f.resolution_status <> 'verified') AS is_overdue,
            f.created_at, f.resolved_at, f.assigned_user_id, au.name AS assigned_to, cu.name AS created_by_name
       FROM feedback_items f JOIN reviews r ON r.review_id = f.review_id JOIN milestones m ON m.milestone_id = r.milestone_id
       JOIN users au ON au.user_id = f.assigned_user_id JOIN users cu ON cu.user_id = f.created_by
      WHERE m.project_id = $1 AND ($2::int IS NULL OR f.assigned_user_id = $2)
      ORDER BY (f.resolution_status = 'verified'), f.due_date NULLS LAST, f.feedback_id`, [projectId, onlyAssignedTo]);
}

export interface EvidenceRow {
  evidence_id: number; user_id: number; user_name: string; evidence_type: string; description: string | null; weight: string;
  verified_flag: boolean; verified_by_name: string | null; verified_at: string | null; created_at: string;
}

export function listEvidence(projectId: number, onlyUser: number | null, verified: boolean | null): Promise<EvidenceRow[]> {
  return query<EvidenceRow>(
    `SELECT ce.evidence_id, ce.user_id, u.name AS user_name, ce.evidence_type, ce.description, ce.weight, ce.verified_flag,
            vb.name AS verified_by_name, ce.verified_at, ce.created_at
       FROM contribution_evidence ce JOIN users u ON u.user_id = ce.user_id LEFT JOIN users vb ON vb.user_id = ce.verified_by
      WHERE ce.project_id = $1 AND ($2::int IS NULL OR ce.user_id = $2) AND ($3::boolean IS NULL OR ce.verified_flag = $3)
      ORDER BY ce.verified_flag, ce.created_at DESC`, [projectId, onlyUser, verified]);
}
