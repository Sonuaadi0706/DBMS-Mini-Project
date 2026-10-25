import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public fields?: Record<string, string>) {
    super(message);
  }
}

export const unauthorized = () => new ApiError(401, 'unauthorized', 'Please sign in.');
export const forbidden = (msg = 'You do not have permission to do that.') => new ApiError(403, 'forbidden', msg);
export const notFound = (msg = 'Not found.') => new ApiError(404, 'not_found', msg);

export function errorBody(code: string, message: string, fields?: Record<string, string>) {
  return { error: { code, message, ...(fields ? { fields } : {}) } };
}

// Friendly messages for Postgres error codes. Raw SQL errors are never sent to the browser.
const PG_MESSAGES: Record<string, [number, string, string]> = {
  '23505': [409, 'duplicate', 'That record already exists or conflicts with an existing one.'],
  '23503': [409, 'invalid_reference', 'A referenced record does not exist.'],
  '23001': [409, 'in_use', 'That record is still referenced by other data and cannot be removed.'],
  '23514': [422, 'rule_violation', 'That change breaks a data rule.'],
  '23502': [422, 'missing_value', 'A required value is missing.'],
};

// Friendly text for the unique indexes / constraints a user can realistically hit.
const CONSTRAINT_MESSAGES: Record<string, string> = {
  uq_projects_active_team: 'This team already has an active project.',
  uq_projects_course_title: 'Another active proposal in this course already uses that title.',
  team_members_course_id_user_id_key: 'That student is already in a team for this course.',
  teams_course_id_team_name_key: 'A team with that name already exists in this course.',
  uq_one_leader_per_team: 'This team already has a leader.',
  uq_one_guide_per_project: 'This project already has a guide. Remove the current guide first.',
  guide_allocations_project_id_user_id_allocation_role_key: 'That person is already allocated in this role.',
  uq_one_owner_per_task: 'This task already has an owner.',
  milestones_project_id_sequence_no_key: 'A milestone with that sequence number already exists.',
  peer_evaluations_project_id_milestone_id_evaluator_id_evalu_key: 'You have already rated that teammate for this milestone.',
  users_email_key: 'That email address is already registered.',
  users_identifier_key: 'That identifier (USN / employee id) is already in use.',
  departments_dept_code_key: 'A department with that code already exists.',
  departments_dept_name_key: 'A department with that name already exists.',
  courses_course_code_semester_academic_year_key: 'That course already exists for this semester and year.',
  project_templates_name_key: 'A template with that name already exists.',
  chk_task_effort_max: 'Effort must be 200 hours or less.',
};

/** Convert any thrown value into a JSON error response. */
export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(errorBody(err.code, err.message, err.fields), { status: err.status });
  }
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) fields[issue.path.join('.') || '_'] = issue.message;
    return NextResponse.json(errorBody('validation', 'Please correct the highlighted fields.', fields), { status: 422 });
  }
  const pg = err as { code?: string; message?: string; constraint?: string; table?: string };
  if (pg?.code && PG_MESSAGES[pg.code]) {
    const [status, code, fallback] = PG_MESSAGES[pg.code];
    // 1) a message we wrote for this constraint, 2) a message raised by our own triggers
    // (RAISE EXCEPTION ... check_violation is already written for people), 3) a generic fallback.
    const named = pg.constraint ? CONSTRAINT_MESSAGES[pg.constraint] : undefined;
    const own = pg.code === '23514' && pg.message && !/violates check constraint/.test(pg.message) ? pg.message : undefined;
    const generic = pg.code === '23514' && pg.table ? `${fallback} Check the dates and numbers you entered (${pg.table}).` : fallback;
    return NextResponse.json(errorBody(code, named ?? own ?? generic), { status });
  }
  // MongoDB driver errors: the document store being down must not look like a bug or lose data silently.
  if ((err as Error)?.name?.startsWith('MongoServerSelection') || (err as Error)?.name === 'MongoNetworkError') {
    return NextResponse.json(errorBody('document_store_unavailable', 'The document store is unavailable. Nothing was saved. Please try again.'), { status: 503 });
  }
  if (pg?.code === 'P0001') {
    return NextResponse.json(errorBody('rule_violation', pg.message ?? 'Rule violation.'), { status: 422 });
  }
  console.error('Unhandled API error:', err);
  return NextResponse.json(errorBody('internal', 'Something went wrong. Please try again.'), { status: 500 });
}

/** CSRF defence in depth on top of SameSite cookies: state-changing requests must come from our origin. */
export function assertSameOrigin(req: Request): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
  const origin = req.headers.get('origin');
  if (!origin) return; // non-browser clients (tests, curl) do not send Origin
  const host = req.headers.get('host');
  if (new URL(origin).host !== host) throw forbidden('Cross-origin request blocked.');
}
