import { beforeAll, describe, expect, it } from 'vitest';
import { em, login, projectIdByTitle, serverUp, type Client } from './helpers';

/**
 * End-to-end workflow through the HTTP API. This CHANGES data (it approves Echo's proposal, builds its
 * plan, creates a team ...), so it only runs with ALLOW_MUTATING_TESTS=1. Afterwards restore the demo with
 *   npm run db:reset && npm run db:seed
 */
const enabled = (await serverUp()) && process.env.ALLOW_MUTATING_TESTS === '1';
const d = enabled ? describe : describe.skip;

d('proposal -> plan -> task workflow (Echo, DBMS)', () => {
  let admin: Client, guide1: Client, guide2: Client, echoLead: Client, echoMate: Client, alphaStudent: Client;
  let echo: number;
  let milestones: { milestone_id: number; sequence_no: number }[] = [];
  let taskId: number;

  beforeAll(async () => {
    [admin, guide1, guide2, echoLead, echoMate, alphaStudent] = await Promise.all([
      login(em.admin), login(em.guide(1)), login(em.guide(2)), login(em.student(11)), login(em.student(12)), login(em.student(1)),
    ]);
    echo = await projectIdByTitle(admin, 'CollegeEvents');
  });

  it('T-18: reject / request-revision needs a comment; non-assigned guide is refused', async () => {
    const noComment = await guide1.post(`/api/proposals/${echo}/decision`, { action: 'request_revision' });
    expect(noComment.status).toBe(422);
    expect(noComment.body.error.fields.comments).toBeTruthy();
    expect([403, 404]).toContain((await guide2.post(`/api/proposals/${echo}/decision`, { action: 'approve' })).status);
    const ok = await guide1.post(`/api/proposals/${echo}/decision`, { action: 'request_revision', comments: 'Please sharpen the objectives.' });
    expect(ok.body.status).toBe('revision_requested');
  });

  it('revision -> edit -> resubmit keeps full history; guide approves; approved proposal is locked', async () => {
    expect((await echoMate.patch(`/api/proposals/${echo}`, { objectives: '1. Plan events. 2. Coordinate helpers. 3. Track attendance. 4. Report participation.' })).status).toBe(200);
    expect((await alphaStudent.patch(`/api/proposals/${echo}`, { title: 'hijack attempt' })).status).toBeGreaterThanOrEqual(403);
    expect((await echoLead.post(`/api/proposals/${echo}/submit`)).body.status).toBe('submitted');
    expect((await echoLead.post(`/api/proposals/${echo}/submit`)).status).toBe(409);       // already submitted
    expect((await guide1.post(`/api/proposals/${echo}/decision`, { action: 'approve', comments: 'Good.' })).body.status).toBe('approved');
    const hist = (await echoLead.get(`/api/proposals/${echo}/history`)).body.history;
    expect(hist.map((h: { action: string }) => h.action)).toEqual(['submit', 'request_revision', 'resubmit', 'approve']);
    expect((await echoLead.patch(`/api/proposals/${echo}`, { title: 'Changed after approval' })).status).toBe(409);
  });

  it('plan is blocked before approval rules are met, then built from the template in one step', async () => {
    const tpl = (await echoLead.get('/api/templates')).body.templates[0];
    expect((await guide2.post(`/api/projects/${echo}/apply-template`, { templateId: tpl.template_id })).status).toBeGreaterThanOrEqual(403);
    const applied = await echoLead.post(`/api/projects/${echo}/apply-template`, { templateId: tpl.template_id });
    expect(applied.status).toBe(201);
    expect(applied.body.milestonesCreated).toBe(5);
    expect((await echoLead.post(`/api/projects/${echo}/apply-template`, { templateId: tpl.template_id })).status).toBe(409);
    milestones = (await echoLead.get(`/api/projects/${echo}/milestones`)).body.milestones;
    expect(milestones).toHaveLength(5);
    expect((await echoLead.get(`/api/proposals/${echo}`)).body.proposal.status).toBe('in_progress');
  });

  it('T-06/T-08: invalid dates and weightage are refused with field-level messages', async () => {
    const bad = await echoLead.post(`/api/projects/${echo}/milestones`, { title: 'Extra', startDate: '2030-02-10', dueDate: '2030-02-01', weightage: 5 });
    expect(bad.status).toBe(422);
    expect(bad.body.error.fields.dueDate).toBeTruthy();
    const heavy = await echoLead.post(`/api/projects/${echo}/milestones`, { title: 'Too heavy', dueDate: '2030-03-01', weightage: 10 });
    expect(heavy.status).toBe(422);                                    // 100 + 10 > 100, caught by the DB trigger at COMMIT
    expect(heavy.body.error.message).toContain('weightage');
    expect((await echoLead.get(`/api/projects/${echo}/milestones`)).body.milestones).toHaveLength(5); // rolled back
  });

  it('T-06/T-07: task validation, team-only assignees', async () => {
    const m1 = milestones[0].milestone_id;
    const base = { title: 'Collect event categories', effortHours: 4, plannedCompletionDate: '2030-01-10', ownerId: 0 };
    const members = (await echoLead.get(`/api/teams/${(await echoLead.get(`/api/proposals/${echo}`)).body.proposal.team_id}`)).body.members;
    const lead = members.find((m: { member_role: string }) => m.member_role === 'leader').user_id;
    const mate = members.find((m: { member_role: string }) => m.member_role === 'member').user_id;

    const badDates = await echoLead.post(`/api/milestones/${m1}/tasks`, { ...base, ownerId: lead, plannedStartDate: '2030-01-20' });
    expect(badDates.status).toBe(422);
    expect(badDates.body.error.fields.plannedCompletionDate).toBeTruthy();
    expect((await echoLead.post(`/api/milestones/${m1}/tasks`, { ...base, ownerId: lead, effortHours: -2 })).status).toBe(422);
    const outsider = (await alphaStudent.get('/api/auth/me')).body.user.userId;
    const out = await echoLead.post(`/api/milestones/${m1}/tasks`, { ...base, ownerId: outsider });
    expect(out.status).toBe(422);
    expect(out.body.error.message).toContain('not a member');

    const created = await echoLead.post(`/api/milestones/${m1}/tasks`, { ...base, ownerId: lead, collaboratorIds: [mate] });
    expect(created.status).toBe(201);
    taskId = created.body.taskId;
    const task = (await echoLead.get(`/api/projects/${echo}/tasks`)).body.tasks.find((t: { task_id: number }) => t.task_id === taskId);
    expect(task.assignees.map((a: { type: string }) => a.type).sort()).toEqual(['collaborator', 'owner']);

    // Moving the owner demotes the old owner to collaborator (exactly one owner per task).
    expect((await echoLead.post(`/api/tasks/${taskId}/assignments`, { userId: mate, assignmentType: 'owner' })).status).toBe(201);
    const t2 = (await echoLead.get(`/api/projects/${echo}/tasks`)).body.tasks.find((t: { task_id: number }) => t.task_id === taskId);
    expect(t2.assignees.find((a: { userId: number }) => a.userId === mate).type).toBe('owner');
    expect(t2.assignees.find((a: { userId: number }) => a.userId === lead).type).toBe('collaborator');
  });

  it('T-09/T-04: task workflow - illegal jumps refused by the DB, only the guide verifies', async () => {
    const jump = await echoLead.post(`/api/tasks/${taskId}/status`, { status: 'done' });
    expect(jump.status).toBe(422);
    expect(jump.body.error.message).toContain('Invalid task status change');
    expect((await echoLead.post(`/api/tasks/${taskId}/status`, { status: 'in_progress' })).status).toBe(200);
    expect((await echoLead.post(`/api/tasks/${taskId}/status`, { status: 'done' })).status).toBe(200);
    expect((await echoLead.post(`/api/tasks/${taskId}/status`, { status: 'verified' })).status).toBe(403);
    expect((await guide2.post(`/api/tasks/${taskId}/status`, { status: 'verified' })).status).toBeGreaterThanOrEqual(403);
    expect((await guide1.post(`/api/tasks/${taskId}/status`, { status: 'verified' })).status).toBe(200);
    expect((await echoLead.patch(`/api/tasks/${taskId}`, { title: 'edit after verify' })).status).toBe(409);
    expect((await echoLead.del(`/api/tasks/${taskId}`)).status).toBe(409);
  });

  it('milestone workflow: student starts, only the guide decides, and nothing skips a step', async () => {
    const m1 = milestones[0].milestone_id;
    expect((await echoLead.post(`/api/milestones/${m1}/start`)).body.status).toBe('in_progress');
    expect((await echoLead.post(`/api/milestones/${m1}/decision`, { action: 'approve' })).status).toBe(403);
    expect((await guide1.post(`/api/milestones/${m1}/decision`, { action: 'approve' })).status).toBe(409);   // not under review yet
    expect((await echoLead.post(`/api/milestones/${m1}/start`)).status).toBe(200);                         // starting twice is an idempotent no-op
    expect((await echoLead.get(`/api/projects/${echo}/milestones`)).body.milestones[0].status).toBe('in_progress');
    expect((await alphaStudent.post(`/api/milestones/${m1}/start`)).status).toBeGreaterThanOrEqual(403); // other team
  });

  it('T-07: duplicate team membership and guide allocation rules (admin)', async () => {
    const courses = (await admin.get('/api/courses')).body.courses;
    const se = courses.find((c: { course_code: string }) => c.course_code === 'CS-SE-P').course_id;
    const team = await admin.post('/api/teams', { courseId: se, teamName: 'Zulu', memberIds: [] });
    expect(team.status).toBe(201);
    const cands = (await admin.get(`/api/teams/candidates?courseId=${se}`)).body.students;
    expect(cands.some((s: { name: string }) => s.name === 'Tarun V')).toBe(false);     // already in Foxtrot
    const free = cands[0];
    expect((await admin.post(`/api/teams/${team.body.teamId}/members`, { userId: free.user_id, responsibility: 'Lead' })).status).toBe(201);
    const dupTeam = await admin.post('/api/teams', { courseId: se, teamName: 'Zulu', memberIds: [] });
    expect(dupTeam.status).toBe(409);
    const members = (await admin.get(`/api/teams/${team.body.teamId}`)).body.members;
    expect(members[0].member_role).toBe('leader');                                     // first member of an empty team leads
    const alreadyIn = await admin.post('/api/teams', { courseId: se, teamName: 'Yankee', memberIds: [free.user_id] });
    expect(alreadyIn.status).toBe(409);
    expect(alreadyIn.body.error.message).toContain('already in a team');

    const asGuide = await admin.post(`/api/projects/${echo}/allocations`, { userId: free.user_id, allocationRole: 'guide' });
    expect(asGuide.status).toBe(422);                                                  // a student cannot be a guide (DB trigger)
  });
});
