import { query } from '@/lib/db/pg';
import { forbidden, notFound } from '@/lib/api/errors';
import type { CurrentUser } from './session';

/**
 * Who is this user in relation to one project? Always loaded from the database; ids and roles sent by
 * the browser are never trusted. Relationship (team member / allocated guide) is what grants access,
 * so a user holding several roles gets exactly the access each relationship gives.
 */
export interface ProjectAccess {
  projectId: number;
  teamId: number;
  courseId: number;
  status: string;
  isAdmin: boolean;
  isMember: boolean;
  isLeader: boolean;
  isGuide: boolean;
  isReviewer: boolean;
}

export async function loadProjectAccess(user: CurrentUser, projectId: number): Promise<ProjectAccess> {
  const [r] = await query<{
    team_id: number; course_id: number; status: string; is_member: boolean; is_leader: boolean; is_guide: boolean; is_reviewer: boolean;
  }>(
    `SELECT p.team_id, p.course_id, p.status,
            EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = p.team_id AND tm.user_id = $2) AS is_member,
            EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = p.team_id AND tm.user_id = $2 AND tm.member_role = 'leader') AS is_leader,
            EXISTS (SELECT 1 FROM guide_allocations ga WHERE ga.project_id = p.project_id AND ga.user_id = $2 AND ga.allocation_role = 'guide') AS is_guide,
            EXISTS (SELECT 1 FROM guide_allocations ga WHERE ga.project_id = p.project_id AND ga.user_id = $2 AND ga.allocation_role = 'reviewer') AS is_reviewer
       FROM projects p WHERE p.project_id = $1`,
    [projectId, user.userId],
  );
  if (!r) throw notFound('Project not found.');
  return {
    projectId, teamId: r.team_id, courseId: r.course_id, status: r.status,
    isAdmin: user.roles.includes('admin'),
    isMember: r.is_member, isLeader: r.is_leader, isGuide: r.is_guide, isReviewer: r.is_reviewer,
  };
}

const canSee = (a: ProjectAccess) => a.isAdmin || a.isMember || a.isGuide || a.isReviewer;

/** Team member, allocated guide/reviewer, or admin. Anyone else gets 404 so existence is not leaked. */
export async function requireProjectParticipant(user: CurrentUser, projectId: number): Promise<ProjectAccess> {
  const a = await loadProjectAccess(user, projectId);
  if (!canSee(a)) throw notFound('Project not found.');
  return a;
}

export async function requireTeamMember(user: CurrentUser, projectId: number): Promise<ProjectAccess> {
  const a = await requireProjectParticipant(user, projectId);
  if (!a.isMember) throw forbidden('Only members of this project\'s team can do that.');
  return a;
}

export async function requireProjectGuide(user: CurrentUser, projectId: number): Promise<ProjectAccess> {
  const a = await requireProjectParticipant(user, projectId);
  if (!a.isGuide) throw forbidden('Only the guide allocated to this project can do that.');
  return a;
}

/** Member or guide: people who may shape the plan (milestones, tasks). */
export async function requirePlanEditor(user: CurrentUser, projectId: number): Promise<ProjectAccess> {
  const a = await requireProjectParticipant(user, projectId);
  if (!a.isMember && !a.isGuide) throw forbidden('Only the team or its guide can change the plan.');
  return a;
}

export async function projectIdOfMilestone(milestoneId: number): Promise<number> {
  const [r] = await query<{ project_id: number }>(`SELECT project_id FROM milestones WHERE milestone_id = $1`, [milestoneId]);
  if (!r) throw notFound('Milestone not found.');
  return r.project_id;
}

export async function projectIdOfTask(taskId: number): Promise<{ projectId: number; milestoneId: number }> {
  const [r] = await query<{ project_id: number; milestone_id: number }>(
    `SELECT m.project_id, m.milestone_id FROM tasks t JOIN milestones m ON m.milestone_id = t.milestone_id WHERE t.task_id = $1`, [taskId]);
  if (!r) throw notFound('Task not found.');
  return { projectId: r.project_id, milestoneId: r.milestone_id };
}

export interface DeliverableContext {
  deliverableId: number; status: string; deliverableType: string; title: string; mongoDocId: string | null;
  milestoneId: number; milestoneStatus: string; projectId: number;
}

export async function loadDeliverable(deliverableId: number): Promise<DeliverableContext> {
  const [r] = await query<{ status: string; deliverable_type: string; title: string; mongo_doc_id: string | null; milestone_id: number; milestone_status: string; project_id: number }>(
    `SELECT d.status, d.deliverable_type, d.title, d.mongo_doc_id, d.milestone_id, m.status AS milestone_status, m.project_id
       FROM deliverables d JOIN milestones m ON m.milestone_id = d.milestone_id WHERE d.deliverable_id = $1`, [deliverableId]);
  if (!r) throw notFound('Deliverable not found.');
  return { deliverableId, status: r.status, deliverableType: r.deliverable_type, title: r.title, mongoDocId: r.mongo_doc_id,
    milestoneId: r.milestone_id, milestoneStatus: r.milestone_status, projectId: r.project_id };
}

export interface FeedbackContext {
  feedbackId: number; reviewId: number; status: string; assignedUserId: number; createdBy: number;
  projectId: number; milestoneId: number; reviewerId: number;
}

export async function loadFeedback(feedbackId: number): Promise<FeedbackContext> {
  const [r] = await query<{ review_id: number; resolution_status: string; assigned_user_id: number; created_by: number; project_id: number; milestone_id: number; reviewer_id: number }>(
    `SELECT f.review_id, f.resolution_status, f.assigned_user_id, f.created_by, m.project_id, m.milestone_id, r.reviewer_id
       FROM feedback_items f JOIN reviews r ON r.review_id = f.review_id JOIN milestones m ON m.milestone_id = r.milestone_id
      WHERE f.feedback_id = $1`, [feedbackId]);
  if (!r) throw notFound('Feedback not found.');
  return { feedbackId, reviewId: r.review_id, status: r.resolution_status, assignedUserId: r.assigned_user_id, createdBy: r.created_by,
    projectId: r.project_id, milestoneId: r.milestone_id, reviewerId: r.reviewer_id };
}

/**
 * Feedback privacy (permission matrix 4.1): a student only sees feedback ASSIGNED TO THEM; the allocated
 * guide / reviewers and admins see all of the project's feedback. Everyone else gets 404.
 */
export async function requireFeedbackAccess(user: CurrentUser, fb: FeedbackContext): Promise<ProjectAccess> {
  const a = await requireProjectParticipant(user, fb.projectId);
  if (a.isMember && !a.isGuide && !a.isReviewer && !a.isAdmin && fb.assignedUserId !== user.userId) throw notFound('Feedback not found.');
  return a;
}
