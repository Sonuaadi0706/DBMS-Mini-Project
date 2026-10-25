import { z } from 'zod';

// These mirror the database rules so people get field-level messages before the DB is hit.
// The database remains the last line of defence (CHECK constraints, triggers).

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD');
const optionalText = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));
const httpUrl = z.string().trim().max(500).regex(/^https?:\/\//i, 'Must start with http:// or https://');

export const DELIVERABLE_TYPES = ['proposal', 'srs', 'design_doc', 'source_code', 'screenshot', 'test_report', 'presentation', 'final_report', 'other'] as const;

// ---- proposals --------------------------------------------------------------------------------
const proposalFields = {
  title: z.string().trim().min(5, 'Title must be at least 5 characters').max(200),
  abstract: optionalText(5000),
  problemStatement: optionalText(5000),
  objectives: optionalText(5000),
  scope: optionalText(5000),
  domain: optionalText(80),
  technologies: z.array(z.string().trim().min(1).max(40)).max(15).default([]),
  repoLink: z.union([httpUrl, z.literal(''), z.null()]).optional().transform((v) => (v ? v : null)),
};

export const ProposalDraft = z.object({ ...proposalFields, teamId: z.number().int().positive().optional() });
export const ProposalPatch = z.object(proposalFields).partial();

/** A proposal may only be submitted once the full text exists (same rule as the projects CHECK). */
export const ProposalComplete = z.object({
  title: z.string().min(5),
  abstract: z.string({ required_error: 'Abstract is required to submit' }).min(50, 'Abstract must be at least 50 characters'),
  problemStatement: z.string({ required_error: 'Problem statement is required to submit' }).min(30, 'Problem statement must be at least 30 characters'),
  objectives: z.string({ required_error: 'Objectives are required to submit' }).min(1, 'Objectives are required to submit'),
  scope: z.string({ required_error: 'Scope is required to submit' }).min(1, 'Scope is required to submit'),
  domain: z.string({ required_error: 'Domain is required to submit' }).min(1, 'Domain is required to submit'),
});

export const ProposalDecision = z.object({
  action: z.enum(['approve', 'reject', 'request_revision']),
  comments: z.string().trim().max(2000).optional().default(''),
}).refine((v) => v.action === 'approve' || v.comments.length > 0, {
  path: ['comments'], message: 'Please explain why (required for reject / request revision)',
});

// ---- teams ------------------------------------------------------------------------------------
export const TeamCreate = z.object({
  courseId: z.number().int().positive(),
  teamName: z.string().trim().min(2, 'Team name is too short').max(80),
  memberIds: z.array(z.number().int().positive()).max(6).default([]), // admin only; first = leader
});
export const MemberAdd = z.object({
  userId: z.number().int().positive(),
  responsibility: optionalText(200),
});
export const MemberPatch = z.object({ responsibility: optionalText(200) });

export const AllocationBody = z.object({
  userId: z.number().int().positive(),
  allocationRole: z.enum(['guide', 'reviewer']),
});

// ---- milestones -------------------------------------------------------------------------------
export const MilestoneCreate = z.object({
  title: z.string().trim().min(2).max(150),
  description: optionalText(2000),
  startDate: isoDate.optional().nullable(),
  dueDate: isoDate,
  weightage: z.number().gt(0, 'Weightage must be above 0').max(100, 'Weightage cannot exceed 100'),
  requiredDeliverables: z.array(z.enum(DELIVERABLE_TYPES)).default([]),
}).refine((v) => !v.startDate || v.dueDate >= v.startDate, { path: ['dueDate'], message: 'Due date cannot be before the start date' });

export const MilestonePatch = z.object({
  title: z.string().trim().min(2).max(150),
  description: optionalText(2000),
  startDate: isoDate.nullable(),
  dueDate: isoDate,
  weightage: z.number().gt(0).max(100),
}).partial();

export const ApplyTemplate = z.object({
  templateId: z.number().int().positive(),
  startDate: isoDate.optional(),
});

export const MilestoneDecision = z.object({
  action: z.enum(['review', 'approve', 'request_revision', 'reject']),
  comments: z.string().trim().max(2000).optional().default(''),
}).refine((v) => v.action === 'approve' || v.action === 'review' || v.comments.length > 0, {
  path: ['comments'], message: 'Please explain why (required for revision / rejection)',
});

// ---- tasks ------------------------------------------------------------------------------------
export const TaskCreate = z.object({
  title: z.string().trim().min(2, 'Title is too short').max(150),
  description: optionalText(2000),
  effortHours: z.number().gt(0, 'Effort must be above 0').max(200, 'Effort must be 200 hours or less'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  plannedStartDate: isoDate.optional().nullable(),
  plannedCompletionDate: isoDate,
  dueDate: isoDate.optional(),
  ownerId: z.number().int().positive(),
  collaboratorIds: z.array(z.number().int().positive()).max(5).default([]),
}).superRefine((v, ctx) => {
  if (v.plannedStartDate && v.plannedCompletionDate < v.plannedStartDate) {
    ctx.addIssue({ code: 'custom', path: ['plannedCompletionDate'], message: 'Planned completion cannot be before the planned start' });
  }
  const due = v.dueDate ?? v.plannedCompletionDate;
  if (v.plannedStartDate && due < v.plannedStartDate) {
    ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'Due date cannot be before the planned start' });
  }
});

export const TaskPatch = z.object({
  title: z.string().trim().min(2).max(150),
  description: optionalText(2000),
  effortHours: z.number().gt(0).max(200),
  priority: z.enum(['low', 'medium', 'high']),
  plannedStartDate: isoDate.nullable(),
  plannedCompletionDate: isoDate,
  dueDate: isoDate,
}).partial();

export const TaskStatusBody = z.object({ status: z.enum(['todo', 'in_progress', 'blocked', 'done', 'verified']) });
export const AssignmentBody = z.object({
  userId: z.number().int().positive(),
  assignmentType: z.enum(['owner', 'collaborator']).default('collaborator'),
});

// ---- reviews / feedback / evidence ------------------------------------------------------------
export const FEEDBACK_THEMES = ['documentation', 'requirements', 'design', 'implementation', 'testing', 'presentation', 'other'] as const;

export const ReviewPatch = z.object({
  comments: z.string().trim().max(4000).optional(),
  decision: z.enum(['approved', 'revision_requested', 'rejected']).optional(),
  scores: z.array(z.object({
    criterion: z.string().trim().min(1).max(80),
    maxScore: z.number().gt(0).max(100),
    score: z.number().min(0),
  }).refine((s) => s.score <= s.maxScore, { message: 'Score cannot exceed the maximum', path: ['score'] })).max(10)
    .refine((a) => new Set(a.map((x) => x.criterion.toLowerCase())).size === a.length, 'Criteria must be different from each other')
    .optional(),
});

export const FeedbackCreate = z.object({
  assignedUserId: z.number().int().positive(),
  description: z.string().trim().min(3, 'Describe what needs to change').max(2000),
  severity: z.enum(['minor', 'major', 'critical']).default('minor'),
  dueDate: isoDate.optional().nullable(),
  theme: z.enum(FEEDBACK_THEMES).default('other'),
});
export const FeedbackResponse = z.object({ responseText: z.string().trim().min(1, 'Write a short response').max(4000) });
export const FeedbackResolve = z.object({ responseText: z.string().trim().max(4000).optional() });
export const FeedbackReopen = z.object({ comment: z.string().trim().max(2000).optional() });
export const ThreadMessage = z.object({ text: z.string().trim().min(1, 'Write a message').max(4000) });

export const GitActivityBody = z.object({
  projectId: z.number().int().positive(),
  taskId: z.number().int().positive().optional().nullable(),
  repoUrl: httpUrl,
  commitRef: z.string().trim().min(4, 'Commit reference is too short').max(64).regex(/^[A-Za-z0-9._\/-]+$/, 'Use letters, digits, dots and dashes only'),
  commitMessage: z.string().trim().max(300).optional(),
  committedAt: z.string().datetime().optional(),
});

// ---- similarity ---------------------------------------------------------------------------------
export const SimilarityCheck = z.object({ projectId: z.number().int().positive() });
export const SimilaritySearch = z.object({
  query: z.string().trim().min(3, 'Type at least a few words').max(500),
  k: z.number().int().min(1).max(10).default(5),
});
export const SimilarityDecision = z.object({
  decision: z.enum(['not_similar', 'acceptable_overlap', 'needs_revision', 'escalated']),
  comments: z.string().trim().max(2000).optional().default(''),
}).refine((v) => !['needs_revision', 'escalated'].includes(v.decision) || v.comments.length > 0, {
  path: ['comments'], message: 'Please explain why (required to ask for revision or to escalate)',
});

// ---- peer evaluation ----------------------------------------------------------------------------
export const PeerEvaluationBody = z.object({
  milestoneId: z.number().int().positive(),             // the evaluation period: one rating per pair per milestone
  evaluateeId: z.number().int().positive(),
  score: z.number().min(1, 'Score is from 1 to 5').max(5, 'Score is from 1 to 5').refine((v) => Math.round(v * 2) === v * 2, 'Use whole or half points'),
  comments: z.string().trim().max(500).optional(),
});

// ---- admin setup (users, roles, departments, courses, templates) ---------------------------------
export const ROLE_NAMES = ['student', 'faculty_guide', 'reviewer', 'admin'] as const;
const optId = z.number().int().positive().nullable().optional();

export const UserCreate = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(120),
  email: z.string().trim().email('Enter a valid email').max(254),
  password: z.string().max(200),
  roles: z.array(z.enum(ROLE_NAMES)).min(1, 'Give the user at least one role'),
  deptId: optId, identifier: z.string().trim().max(30).optional().nullable(),
});
export const UserPatch = z.object({
  name: z.string().trim().min(2).max(120), status: z.enum(['active', 'inactive', 'suspended']),
  deptId: optId, identifier: z.string().trim().max(30).nullable(), newPassword: z.string().max(200),
}).partial();
export const RoleChange = z.object({ role: z.enum(ROLE_NAMES), op: z.enum(['add', 'remove']) });

export const DepartmentBody = z.object({
  code: z.string().trim().toUpperCase().min(2, 'Code is too short').max(10), name: z.string().trim().min(3, 'Name is too short').max(120),
});
export const CourseBody = z.object({
  deptId: z.number().int().positive(), code: z.string().trim().min(2).max(20), name: z.string().trim().min(3).max(150),
  semester: z.string().trim().min(2).max(20), academicYear: z.string().regex(/^\d{4}-\d{4}$/, 'Use the format 2026-2027'),
});
export const CoursePatch = z.object({ name: z.string().trim().min(3).max(150), isActive: z.boolean() }).partial();

const TemplateMilestone = z.object({
  title: z.string().trim().min(2).max(150), offsetDays: z.number().int().min(0).max(1000),
  weightage: z.number().gt(0).max(100), requiredDeliverableTypes: z.array(z.enum(DELIVERABLE_TYPES)).default([]),
});
export const TemplateBody = z.object({
  name: z.string().trim().min(3, 'Name is too short').max(120), description: z.string().trim().max(1000).optional().nullable(),
  courseId: optId, isActive: z.boolean().default(true),
  milestones: z.array(TemplateMilestone).min(1, 'Add at least one milestone').max(12),
}).refine((t) => t.milestones.reduce((a, m) => a + m.weightage, 0) <= 100, { path: ['milestones'], message: 'The weightages add up to more than 100' });
