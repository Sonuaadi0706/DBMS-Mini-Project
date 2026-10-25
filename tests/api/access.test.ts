import { beforeAll, describe, expect, it } from 'vitest';
import { em, login, projectIdByTitle, serverUp, type Client } from './helpers';

/**
 * Read-only authorization tests (T-04, T-05): safe to run repeatedly against the seeded database.
 * Needs the app running (`npm run dev -- -p 3100`); skipped when it is not reachable.
 */
const up = await serverUp();
const d = up ? describe : describe.skip;

d('authentication and authorization', () => {
  let anon: Client, admin: Client, alphaStudent: Client, bravoStudent: Client, guide1: Client, guide2: Client;
  let alpha: number, bravo: number, echo: number;

  beforeAll(async () => {
    [anon, admin, alphaStudent, bravoStudent, guide1, guide2] = await Promise.all([
      login(null), login(em.admin), login(em.student(1)), login(em.student(4)), login(em.guide(1)), login(em.guide(2)),
    ]);
    alpha = await projectIdByTitle(admin, 'CampusConnect');
    bravo = await projectIdByTitle(admin, 'LibrarySeat');
    echo = await projectIdByTitle(admin, 'CollegeEvents');
  });

  it('anonymous requests are rejected with 401', async () => {
    expect((await anon.get('/api/proposals')).status).toBe(401);
    expect((await anon.get(`/api/projects/${alpha}/tasks`)).status).toBe(401);
  });

  it('T-05: a student cannot read another team\'s project, plan or tasks', async () => {
    for (const path of [`/api/proposals/${bravo}`, `/api/projects/${bravo}/milestones`, `/api/projects/${bravo}/tasks`, `/api/proposals/${bravo}/history`]) {
      const r = await alphaStudent.get(path);
      expect([403, 404], path).toContain(r.status);
      expect(JSON.stringify(r.body)).not.toContain('LibrarySeat');
    }
  });

  it('T-05: a student\'s list contains only their own team\'s project', async () => {
    const r = await alphaStudent.get('/api/proposals');
    expect(r.body.proposals.map((p: { team_name: string }) => p.team_name)).toEqual(['Alpha']);
    const teams = await alphaStudent.get('/api/teams');
    expect(teams.body.teams.map((t: { team_name: string }) => t.team_name)).toEqual(['Alpha']);
  });

  it('a guide only sees the projects allocated to them', async () => {
    const g1 = (await guide1.get('/api/proposals')).body.proposals.map((p: { team_name: string }) => p.team_name).sort();
    expect(g1).toEqual(['Alpha', 'Charlie', 'Echo']);
    const g2 = (await guide2.get('/api/proposals')).body.proposals.map((p: { team_name: string }) => p.team_name).sort();
    expect(g2).toEqual(['Bravo', 'Delta']);
    expect([403, 404]).toContain((await guide2.get(`/api/proposals/${alpha}`)).status);
  });

  it('T-04: a student cannot call guide-only endpoints; nothing changes', async () => {
    const dec = await alphaStudent.post(`/api/proposals/${alpha}/decision`, { action: 'approve' });
    expect(dec.status).toBe(403);
    const ms = (await alphaStudent.get(`/api/projects/${alpha}/milestones`)).body.milestones;
    const m3 = ms.find((m: { sequence_no: number }) => m.sequence_no === 3);
    expect((await alphaStudent.post(`/api/milestones/${m3.milestone_id}/decision`, { action: 'approve' })).status).toBe(403);
    const tasks = (await alphaStudent.get(`/api/projects/${alpha}/tasks`)).body.tasks;
    const done = tasks.find((t: { status: string }) => t.status === 'done');
    expect((await alphaStudent.post(`/api/tasks/${done.task_id}/status`, { status: 'verified' })).status).toBe(403);
    const after = (await alphaStudent.get(`/api/projects/${alpha}/tasks`)).body.tasks.find((t: { task_id: number }) => t.task_id === done.task_id);
    expect(after.status).toBe('done');
  });

  it('only an admin can allocate guides', async () => {
    expect((await guide1.post(`/api/projects/${echo}/allocations`, { userId: 3, allocationRole: 'reviewer' })).status).toBe(403);
    expect((await alphaStudent.post(`/api/projects/${echo}/allocations`, { userId: 3, allocationRole: 'reviewer' })).status).toBe(403);
  });

  it('a student from another team cannot change a task or its assignees', async () => {
    const tasks = (await alphaStudent.get(`/api/projects/${alpha}/tasks`)).body.tasks;
    const t = tasks.find((x: { status: string }) => x.status === 'todo');
    expect([403, 404]).toContain((await bravoStudent.patch(`/api/tasks/${t.task_id}`, { title: 'hijacked' })).status);
    expect([403, 404]).toContain((await bravoStudent.post(`/api/tasks/${t.task_id}/assignments`, { userId: 4 })).status);
    expect([403, 404]).toContain((await bravoStudent.del(`/api/tasks/${t.task_id}`)).status);
  });

  it('rejects a malformed id and a cross-origin write', async () => {
    expect((await admin.get('/api/proposals/abc')).status).toBe(400);
    const res = await fetch(`${process.env.TEST_BASE_URL ?? 'http://localhost:3100'}/api/teams`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://evil.example' }, body: '{}',
    });
    expect([401, 403]).toContain(res.status);
  });
});
