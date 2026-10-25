import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import {
  addMilestone, addTask, advanceTask, buildFixture, closeTx, expectDbError, one, openTx, type Fixture,
} from './helpers';

let c: Client;
let f: Fixture;

beforeEach(async () => {
  c = await openTx();
  f = await buildFixture(c);
});
afterEach(async () => {
  await closeTx(c);
});

/** planned -> in_progress -> submitted -> under_review (the legal path to a decision) */
async function moveToReview(milestoneId: number) {
  for (const s of ['in_progress', 'submitted', 'under_review']) {
    await c.query(`UPDATE milestones SET status = $2 WHERE milestone_id = $1`, [milestoneId, s]);
  }
}

describe('T-06 invalid dates and numbers (CHECK constraints)', () => {
  it('rejects a milestone due before it starts', async () => {
    const err = await expectDbError(c,
      `INSERT INTO milestones(project_id, sequence_no, title, start_date, due_date, weightage)
       VALUES ($1, 1, 'Bad dates', CURRENT_DATE + 10, CURRENT_DATE + 1, 10)`, [f.projectId]);
    expect(err.code).toBe('23514');
  });
  it('rejects a task whose planned completion precedes its planned start', async () => {
    const m = await addMilestone(c, f.projectId, 1, { dueOffset: 30 });
    const err = await expectDbError(c,
      `INSERT INTO tasks(milestone_id, title, planned_start_date, planned_completion_date, due_date)
       VALUES ($1, 'Bad task', CURRENT_DATE + 5, CURRENT_DATE + 2, CURRENT_DATE + 6)`, [m]);
    expect(err.code).toBe('23514');
  });
  it('rejects negative effort and non-positive weightage', async () => {
    const m = await addMilestone(c, f.projectId, 1, { dueOffset: 30 });
    expect((await expectDbError(c,
      `INSERT INTO tasks(milestone_id, title, effort_hours, planned_completion_date, due_date)
       VALUES ($1, 'x', -1, CURRENT_DATE, CURRENT_DATE)`, [m])).code).toBe('23514');
    expect((await expectDbError(c,
      `INSERT INTO milestones(project_id, sequence_no, title, due_date, weightage)
       VALUES ($1, 9, 'w', CURRENT_DATE, 0)`, [f.projectId])).code).toBe('23514');
  });
});

describe('T-07 duplicate team / project records', () => {
  it('allows only one active project per team', async () => {
    const err = await expectDbError(c,
      `INSERT INTO projects(team_id, course_id, title, created_by) VALUES ($1, $2, 'Another idea here', $3)`,
      [f.teamId, f.courseId, f.s1]);
    expect(err.code).toBe('23505');
  });
  it('allows a student in only one team per course', async () => {
    const t2 = await one<number>(c, `INSERT INTO teams(course_id, team_name) VALUES ($1, 'Team Two') RETURNING team_id`, [f.courseId]);
    const err = await expectDbError(c,
      `INSERT INTO team_members(team_id, course_id, user_id) VALUES ($1, $2, $3)`, [t2, f.courseId, f.s1]);
    expect(err.code).toBe('23505');
  });
  it('rejects a duplicate project title in the same course, ignoring case', async () => {
    const t2 = await one<number>(c, `INSERT INTO teams(course_id, team_name) VALUES ($1, 'Team Two') RETURNING team_id`, [f.courseId]);
    const err = await expectDbError(c,
      `INSERT INTO projects(team_id, course_id, title, created_by) VALUES ($1, $2, 'TEST PROJECT ALPHA', $3)`,
      [t2, f.courseId, f.s3]);
    expect(err.code).toBe('23505');
  });
  it('allows only one leader per team', async () => {
    const err = await expectDbError(c,
      `UPDATE team_members SET member_role = 'leader' WHERE team_id = $1 AND user_id = $2`, [f.teamId, f.s2]);
    expect(err.code).toBe('23505');
  });
});

describe('T-08 milestone weightage total', () => {
  it('rejects a total above 100 when the deferred constraint is checked', async () => {
    await addMilestone(c, f.projectId, 1, { dueOffset: 10, weightage: 60 });
    await addMilestone(c, f.projectId, 2, { dueOffset: 20, weightage: 60 });
    await expectDbError(c, `SET CONSTRAINTS trg_milestone_weightage IMMEDIATE`, [], 'weightage');
  });
});

describe('T-09 illegal status transitions', () => {
  it('rejects planned -> approved on a milestone', async () => {
    const m = await addMilestone(c, f.projectId, 1, { dueOffset: 10 });
    await expectDbError(c,
      `UPDATE milestones SET status = 'approved', approved_by = $2, approved_at = now() WHERE milestone_id = $1`,
      [m, f.guide], 'Invalid milestone status change');
  });
  it('rejects todo -> verified on a task', async () => {
    const m = await addMilestone(c, f.projectId, 1, { dueOffset: 10 });
    const t = await addTask(c, m, { dueOffset: 5, owner: f.s1 });
    await expectDbError(c,
      `UPDATE tasks SET status = 'verified', verified_by = $2, verified_at = now() WHERE task_id = $1`,
      [t, f.guide], 'Invalid task status change');
  });
  it('rejects draft -> approved on a project', async () => {
    const t2 = await one<number>(c, `INSERT INTO teams(course_id, team_name) VALUES ($1, 'Team Two') RETURNING team_id`, [f.courseId]);
    const p2 = await one<number>(c,
      `INSERT INTO projects(team_id, course_id, title, created_by) VALUES ($1,$2,'Draft Project Two',$3) RETURNING project_id`,
      [t2, f.courseId, f.s3]);
    await expectDbError(c, `UPDATE projects SET status = 'approved' WHERE project_id = $1`, [p2], 'Invalid project status change');
  });
});

describe('T-10 append-only history', () => {
  it('blocks UPDATE and DELETE on proposal_actions', async () => {
    const id = await one<number>(c,
      `INSERT INTO proposal_actions(project_id, actor_id, action, from_status, to_status, comments)
       VALUES ($1, $2, 'approve', 'submitted', 'approved', 'ok') RETURNING action_id`, [f.projectId, f.guide]);
    await expectDbError(c, `UPDATE proposal_actions SET comments = 'edited' WHERE action_id = $1`, [id], 'append-only');
    await expectDbError(c, `DELETE FROM proposal_actions WHERE action_id = $1`, [id], 'append-only');
  });
  it('blocks UPDATE and DELETE on audit_logs', async () => {
    const m = await addMilestone(c, f.projectId, 1, { dueOffset: 10 });
    await c.query(`UPDATE milestones SET status = 'in_progress' WHERE milestone_id = $1`, [m]);
    const logId = await one<number>(c, `SELECT log_id FROM audit_logs ORDER BY log_id DESC LIMIT 1`);
    await expectDbError(c, `UPDATE audit_logs SET action = 'x' WHERE log_id = $1`, [logId], 'append-only');
    await expectDbError(c, `DELETE FROM audit_logs WHERE log_id = $1`, [logId], 'append-only');
  });
  it('requires a comment to reject a proposal', async () => {
    const err = await expectDbError(c,
      `INSERT INTO proposal_actions(project_id, actor_id, action, from_status, to_status)
       VALUES ($1, $2, 'reject', 'submitted', 'rejected')`, [f.projectId, f.guide]);
    expect(err.code).toBe('23514');
  });
});

describe('T-11 guide / reviewer allocation rules', () => {
  it('rejects a user without the faculty_guide role as guide', async () => {
    await c.query(`DELETE FROM guide_allocations WHERE project_id = $1`, [f.projectId]);
    await expectDbError(c,
      `INSERT INTO guide_allocations(project_id, user_id, allocation_role) VALUES ($1, $2, 'guide')`,
      [f.projectId, f.reviewer], 'faculty_guide');
  });
  it('rejects a team member allocated as reviewer of their own team', async () => {
    await c.query(`INSERT INTO user_roles(user_id, role_id) SELECT $1, role_id FROM roles WHERE role_name = 'reviewer'`, [f.s1]);
    await expectDbError(c,
      `INSERT INTO guide_allocations(project_id, user_id, allocation_role) VALUES ($1, $2, 'reviewer')`,
      [f.projectId, f.s1], 'member of the project team');
  });
  it('rejects a second guide on the same project', async () => {
    const g2 = await one<number>(c,
      `INSERT INTO users(name, email, password_hash) VALUES ('Guide Two','g2@t.test','h') RETURNING user_id`);
    await c.query(`INSERT INTO user_roles(user_id, role_id) SELECT $1, role_id FROM roles WHERE role_name = 'faculty_guide'`, [g2]);
    const err = await expectDbError(c,
      `INSERT INTO guide_allocations(project_id, user_id, allocation_role) VALUES ($1, $2, 'guide')`, [f.projectId, g2]);
    expect(err.code).toBe('23505');
  });
  it('rejects a non-student joining a team', async () => {
    await expectDbError(c,
      `INSERT INTO team_members(team_id, course_id, user_id) VALUES ($1, $2, $3)`,
      [f.teamId, f.courseId, f.guide], 'student role');
  });
  it('rejects assigning a task to someone outside the team', async () => {
    const m = await addMilestone(c, f.projectId, 1, { dueOffset: 10 });
    const t = await addTask(c, m, { dueOffset: 5 });
    await expectDbError(c,
      `INSERT INTO task_assignments(task_id, user_id) VALUES ($1, $2)`, [t, f.s3], 'not a member');
  });
});

describe('T-12 overdue milestone flag', () => {
  it('creates exactly one open risk event and resolves it on approval', async () => {
    const m = await addMilestone(c, f.projectId, 1, { dueOffset: -5 });
    const open = () => one<number>(c,
      `SELECT COUNT(*)::int FROM risk_events WHERE milestone_id = $1 AND event_type = 'milestone_overdue' AND resolved_at IS NULL`, [m]);
    expect(await open()).toBe(1);
    await c.query(`UPDATE milestones SET due_date = due_date WHERE milestone_id = $1`, [m]); // re-fires trigger
    await c.query(`SELECT fn_flag_overdue_milestones()`);                                      // sweep path
    expect(await open()).toBe(1);                                                              // no duplicates
    await moveToReview(m);
    await c.query(`UPDATE milestones SET status = 'approved', approved_by = $2, approved_at = now() WHERE milestone_id = $1`, [m, f.guide]);
    expect(await open()).toBe(0);
  });
});

describe('T-13 / T-14 risk calculation', () => {
  it('matches the hand calculation: 1 overdue milestone + 4 overdue tasks + 1 missing deliverable = 38.5', async () => {
    const m = await addMilestone(c, f.projectId, 1, { dueOffset: -12, required: ['srs'] });
    for (let i = 0; i < 4; i++) await addTask(c, m, { dueOffset: -3, owner: f.s1 });
    await c.query(`CALL sp_recalculate_risk($1)`, [f.projectId]);
    const { rows } = await c.query(`SELECT * FROM risk_assessments WHERE project_id = $1`, [f.projectId]);
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].risk_score)).toBe(38.5);   // 12.5 + 16 + 10
    expect(rows[0].risk_level).toBe('moderate');
    expect(rows[0].breakdown.overdue_milestones).toBe(12.5);
    expect(rows[0].breakdown.overdue_tasks).toBe(16);
    expect(rows[0].breakdown.missing_deliverables).toBe(10);
    expect(rows[0].reason).toContain('1 milestone(s) overdue');
  });
  it('rejects a risk level that does not match the score band', async () => {
    const err = await expectDbError(c,
      `INSERT INTO risk_assessments(project_id, risk_score, risk_level, reason) VALUES ($1, 80, 'low', 'x')`, [f.projectId]);
    expect(err.code).toBe('23514');
  });
  it('reports "no risk factors" for a healthy project', async () => {
    const { rows } = await c.query(`SELECT * FROM fn_calculate_project_risk($1)`, [f.projectId]);
    expect(rows[0].risk_level).toBe('low');
  });
});

describe('T-17 auto-numbered document versions', () => {
  it('numbers versions 1, 2, 3 when the column is omitted', async () => {
    const m = await addMilestone(c, f.projectId, 1, { dueOffset: 10 });
    const d = await one<number>(c,
      `INSERT INTO deliverables(milestone_id, deliverable_type, title, submitted_by) VALUES ($1,'srs','SRS',$2) RETURNING deliverable_id`, [m, f.s1]);
    for (const s of ['first', 'second', 'third']) {
      await c.query(`INSERT INTO document_versions(deliverable_id, change_summary, file_name, uploaded_by) VALUES ($1,$2,'srs.pdf',$3)`, [d, s, f.s1]);
    }
    const { rows } = await c.query(`SELECT version_number FROM document_versions WHERE deliverable_id = $1 ORDER BY 1`, [d]);
    expect(rows.map((r) => r.version_number)).toEqual([1, 2, 3]);
  });
});

describe('T-19 status changes are audited with the acting user', () => {
  it('writes a STATUS_CHANGE row carrying app.current_user_id', async () => {
    const m = await addMilestone(c, f.projectId, 1, { dueOffset: 10 });
    const t = await addTask(c, m, { dueOffset: 5, owner: f.s1 });
    await c.query(`SELECT set_config('app.current_user_id', $1, true)`, [String(f.s1)]);
    await c.query(`UPDATE tasks SET status = 'in_progress' WHERE task_id = $1`, [t]);
    const { rows } = await c.query(
      `SELECT * FROM audit_logs WHERE entity_type = 'tasks' AND entity_id = $1 AND action = 'STATUS_CHANGE'`, [String(t)]);
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe(f.s1);
    expect(rows[0].old_values.status).toBe('todo');
    expect(rows[0].new_values.status).toBe('in_progress');
  });
});

describe('T-21 ON DELETE RESTRICT protects history', () => {
  it('blocks deleting a project that has milestones', async () => {
    await addMilestone(c, f.projectId, 1, { dueOffset: 10 });
    const err = await expectDbError(c, `DELETE FROM projects WHERE project_id = $1`, [f.projectId]);
    expect(err.code).toBe('23001');                       // restrict_violation (ON DELETE RESTRICT)
  });
  it('blocks deleting a user referenced by task assignments', async () => {
    const m = await addMilestone(c, f.projectId, 1, { dueOffset: 10 });
    await addTask(c, m, { dueOffset: 5, owner: f.s1 });
    const err = await expectDbError(c, `DELETE FROM users WHERE user_id = $1`, [f.s1]);
    expect(err.code).toBe('23001');
  });
  it('rejects an INSERT that violates a foreign key', async () => {
    const err = await expectDbError(c,
      `INSERT INTO milestones(project_id, sequence_no, title, due_date, weightage) VALUES (-1, 1, 'x', CURRENT_DATE, 10)`);
    expect(err.code).toBe('23503');
  });
});

describe('T-24 contribution evidence', () => {
  it('creates verified evidence on task verification; unverified evidence is excluded from the summary', async () => {
    const m = await addMilestone(c, f.projectId, 1, { dueOffset: 10 });
    const t = await addTask(c, m, { dueOffset: 5, owner: f.s1, effort: 8 });
    await advanceTask(c, t, 'verified', f.guide);

    const d = await one<number>(c,
      `INSERT INTO deliverables(milestone_id, deliverable_type, title, submitted_by) VALUES ($1,'srs','SRS',$2) RETURNING deliverable_id`, [m, f.s2]);
    await c.query(`INSERT INTO document_versions(deliverable_id, change_summary, file_name, uploaded_by) VALUES ($1,'v1','a.pdf',$2)`, [d, f.s2]);

    const ev = await c.query(`SELECT user_id, evidence_type, verified_flag, weight FROM contribution_evidence WHERE project_id = $1 ORDER BY evidence_id`, [f.projectId]);
    expect(ev.rows).toHaveLength(2);
    expect(ev.rows[0]).toMatchObject({ user_id: f.s1, evidence_type: 'task_completed', verified_flag: true });
    expect(Number(ev.rows[0].weight)).toBe(2);                      // 8 h / 4
    expect(ev.rows[1]).toMatchObject({ user_id: f.s2, evidence_type: 'document_upload', verified_flag: false });

    const { rows } = await c.query(`SELECT user_id, verified_items, unverified_items, evidence_points, share_pct FROM v_contribution_summary WHERE project_id = $1`, [f.projectId]);
    const s1 = rows.find((r) => r.user_id === f.s1)!; const s2 = rows.find((r) => r.user_id === f.s2)!;
    expect(Number(s1.evidence_points)).toBe(6);                     // weight 2 x multiplier 3
    expect(Number(s1.share_pct)).toBe(100);
    expect(Number(s2.evidence_points)).toBe(0);
    expect(Number(s2.unverified_items)).toBe(1);
  });
});

describe('T-25 approval blocked while mandatory deliverables are missing', () => {
  it('blocks approval, then allows it once the deliverable is submitted', async () => {
    const m = await addMilestone(c, f.projectId, 1, { dueOffset: 10, required: ['srs'] });
    await moveToReview(m);
    const approve = `UPDATE milestones SET status = 'approved', approved_by = $2, approved_at = now() WHERE milestone_id = $1`;
    await expectDbError(c, approve, [m, f.guide], 'mandatory deliverable');
    await c.query(
      `INSERT INTO deliverables(milestone_id, deliverable_type, title, status, submitted_by, submitted_at)
       VALUES ($1,'srs','SRS','submitted',$2, now())`, [m, f.s1]);
    await c.query(approve, [m, f.guide]);
    expect(await one<string>(c, `SELECT status FROM milestones WHERE milestone_id = $1`, [m])).toBe('approved');
  });
  it('after migration 011, also enforces required_evidence_type', async () => {
    const m = await addMilestone(c, f.projectId, 1, { dueOffset: 10 });
    await c.query(`UPDATE milestones SET required_evidence_type = 'test_report' WHERE milestone_id = $1`, [m]);
    await moveToReview(m);
    await expectDbError(c,
      `UPDATE milestones SET status = 'approved', approved_by = $2, approved_at = now() WHERE milestone_id = $1`,
      [m, f.guide], 'required evidence');
  });
});

describe('feedback workflow and evidence', () => {
  it('resolved feedback makes unverified evidence; verifying it flips the flag', async () => {
    const m = await addMilestone(c, f.projectId, 1, { dueOffset: 10 });
    const r = await one<number>(c,
      `INSERT INTO reviews(milestone_id, reviewer_id) VALUES ($1,$2) RETURNING review_id`, [m, f.guide]);
    const fb = await one<number>(c,
      `INSERT INTO feedback_items(review_id, created_by, assigned_user_id, description) VALUES ($1,$2,$3,'Fix the ER diagram') RETURNING feedback_id`,
      [r, f.guide, f.s2]);
    await c.query(`UPDATE feedback_items SET resolution_status='resolved', resolved_at=now(), response_text='done' WHERE feedback_id=$1`, [fb]);
    expect(await one<boolean>(c, `SELECT verified_flag FROM contribution_evidence WHERE source_id=$1 AND source_table='feedback_items'`, [fb])).toBe(false);
    await c.query(`UPDATE feedback_items SET resolution_status='verified', verified_by=$2, verified_at=now() WHERE feedback_id=$1`, [fb, f.guide]);
    expect(await one<boolean>(c, `SELECT verified_flag FROM contribution_evidence WHERE source_id=$1 AND source_table='feedback_items'`, [fb])).toBe(true);
    expect(await one<number>(c, `SELECT COUNT(*)::int FROM v_unresolved_feedback WHERE project_id=$1`, [f.projectId])).toBe(0);
  });
});
