import { execSync } from 'node:child_process';
import { beforeAll, describe, expect, it } from 'vitest';
import { em, login, projectIdByTitle, serverUp, type Client } from './helpers';
import { sql } from './stores';

/**
 * Risk recalculation, the sweep job + script, and automatic refresh after key events.
 * Adds risk snapshots and moves a Bravo task, so it needs ALLOW_MUTATING_TESTS=1 (demo is restored afterwards).
 */
const enabled = (await serverUp()) && process.env.ALLOW_MUTATING_TESTS === '1';
const d = enabled ? describe : describe.skip;
const count = async (project: number) => Number((await sql(`SELECT COUNT(*) AS n FROM risk_assessments WHERE project_id = $1`, [project]))[0].n);

d('risk calculation wiring', () => {
  let anon: Client, admin: Client, guide1: Client, guide2: Client, s1: Client, s4: Client;
  let alpha: number, bravo: number;

  beforeAll(async () => {
    [anon, admin, guide1, guide2, s1, s4] = await Promise.all([login(null), login(em.admin), login(em.guide(1)), login(em.guide(2)), login(em.student(1)), login(em.student(4))]);
    alpha = await projectIdByTitle(admin, 'CampusConnect');
    bravo = await projectIdByTitle(admin, 'LibrarySeat');
  });

  it('recalculate: only the project\'s guide or an admin; it stores a new snapshot and returns the breakdown', async () => {
    expect((await s1.post(`/api/projects/${alpha}/risk/recalculate`)).status).toBe(403);
    expect([403, 404]).toContain((await guide2.post(`/api/projects/${alpha}/risk/recalculate`)).status);     // not their project
    const before = await count(alpha);
    const r = await guide1.post(`/api/projects/${alpha}/risk/recalculate`);
    expect(r.status).toBe(200);
    expect(r.body.risk.level).toBe('low');
    expect(r.body.risk.breakdown.overdue_tasks).toBe(0);
    expect(await count(alpha)).toBe(before + 1);
    expect((await admin.post(`/api/projects/${alpha}/risk/recalculate`)).status).toBe(200);
  });

  it('a project that is not running cannot be assessed', async () => {
    const echo = await projectIdByTitle(admin, 'CollegeEvents');
    expect((await admin.post(`/api/projects/${echo}/risk/recalculate`)).status).toBe(409);
  });

  it('sweep job: needs the job secret or an admin session', async () => {
    expect((await anon.post('/api/jobs/risk-sweep')).status).toBe(401);
    expect((await guide1.post('/api/jobs/risk-sweep')).status).toBe(403);
    const bad = await fetch('http://localhost:3100/api/jobs/risk-sweep', { method: 'POST', headers: { 'x-job-secret': 'wrong-secret' } });
    expect(bad.status).toBe(401);
    const before = await count(bravo);
    const viaAdmin = await admin.post('/api/jobs/risk-sweep');
    expect(viaAdmin.status).toBe(200);
    expect(viaAdmin.body.projects).toBe(4);
    const viaSecret = await fetch(`${process.env.TEST_BASE_URL ?? 'http://localhost:3100'}/api/jobs/risk-sweep`, { method: 'POST', headers: { 'x-job-secret': process.env.JOB_SECRET! } });
    expect(viaSecret.status).toBe(200);
    expect(await count(bravo)).toBe(before + 2);
  });

  it('sweep script: stores one snapshot per running project', async () => {
    const total = async () => Number((await sql(`SELECT COUNT(*) AS n FROM risk_assessments`))[0].n);
    const before = await total();
    execSync('npm run risk:sweep --silent', { stdio: 'ignore' });
    expect(await total()).toBe(before + 4);
  });

  it('events refresh the assessment automatically, and unchanged state adds no noise', async () => {
    const ms = (await s4.get(`/api/projects/${bravo}/milestones`)).body.milestones.find((m: any) => m.sequence_no === 2).milestone_id;
    const tasks = (await s4.get(`/api/projects/${bravo}/tasks`)).body.tasks;
    const open = tasks.find((t: any) => t.milestone_id === ms && t.status === 'in_progress' && t.is_overdue);
    const level = async () => (await guide2.get(`/api/projects/${bravo}/risk`)).body.risk;
    const before = await level();
    expect((await s4.post(`/api/tasks/${open.task_id}/status`, { status: 'done' })).status).toBe(200);
    const after = await level();
    expect(after.score).toBeLessThan(before.score);                              // one task less overdue, and the team is active again
    expect(after.reason).not.toBe(before.reason);
    const n = await count(bravo);
    expect((await s4.post(`/api/milestones/${ms}/start`)).status).toBe(200);     // no-op: nothing changed...
    expect(await count(bravo)).toBe(n);                                          // ...so no new snapshot
  });
});
