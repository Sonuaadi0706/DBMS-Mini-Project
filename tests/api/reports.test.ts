import { beforeAll, describe, expect, it } from 'vitest';
import { em, login, projectIdByTitle, serverUp, type Client } from './helpers';

/** Read-only: reports (scoping, filters, sorting, CSV), contribution and risk privacy, dashboards. Safe to repeat. */
const up = await serverUp();
const d = up ? describe : describe.skip;
const teams = (r: { body: any }) => r.body.rows.map((x: any) => x.team_name).sort();

d('reports, contribution, risk and dashboards (seeded demo)', () => {
  let anon: Client, admin: Client, guide1: Client, guide2: Client, reviewer1: Client, s1: Client, s4: Client;
  let alpha: number, bravo: number;
  const report = (c: Client, name: string, qs = '') => c.get(`/api/reports/${name}${qs ? '?' + qs : ''}`);

  beforeAll(async () => {
    [anon, admin, guide1, guide2, reviewer1, s1, s4] = await Promise.all([
      login(null), login(em.admin), login(em.guide(1)), login(em.guide(2)), login('reviewer1@projectpulse.test'), login(em.student(1)), login(em.student(4)),
    ]);
    alpha = await projectIdByTitle(admin, 'CampusConnect');
    bravo = await projectIdByTitle(admin, 'LibrarySeat');
  });

  it('reports need a faculty or admin session', async () => {
    expect((await report(anon, 'high-risk')).status).toBe(401);
    expect((await report(s1, 'high-risk')).status).toBe(403);
    expect((await report(admin, 'nonsense')).status).toBe(404);
    expect((await report(admin, 'high-risk', 'level=catastrophic')).status).toBe(422);
  });

  it('Q1 high-risk: default is high+critical; the level filter widens it', async () => {
    expect(teams(await report(admin, 'high-risk'))).toEqual(['Bravo']);
    expect(teams(await report(admin, 'high-risk', 'level=moderate'))).toEqual(['Bravo', 'Charlie', 'Delta']);
    expect(teams(await report(admin, 'high-risk', 'level=low'))).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta']);
    const top = (await report(admin, 'high-risk')).body.rows[0];
    expect(top).toMatchObject({ risk_level: 'high', guide: expect.any(String) });
    expect(Number(top.risk_score)).toBeGreaterThanOrEqual(50);
  });

  it('scope: a guide only sees their own projects; admin filters by guide, course and team', async () => {
    expect(teams(await report(guide1, 'high-risk', 'level=low'))).toEqual(['Alpha', 'Charlie']);      // Echo is not running yet
    expect(teams(await report(guide2, 'high-risk', 'level=low'))).toEqual(['Bravo', 'Delta']);
    expect(teams(await report(reviewer1, 'high-risk', 'level=low'))).toEqual(['Alpha', 'Bravo']);     // allocated as reviewer
    const g2 = (await guide2.get('/api/auth/me')).body.user.userId;
    expect(teams(await report(admin, 'high-risk', `level=low&guideId=${g2}`))).toEqual(['Bravo', 'Delta']);
    const courses = (await admin.get('/api/courses')).body.courses;
    const se = courses.find((c: any) => c.course_code === 'CS-SE-P').course_id;
    expect((await report(admin, 'high-risk', `level=low&courseId=${se}`)).body.rows).toHaveLength(0);
    const bravoTeam = (await admin.get(`/api/proposals/${bravo}`)).body.proposal.team_id;
    expect(teams(await report(admin, 'high-risk', `level=low&teamId=${bravoTeam}`))).toEqual(['Bravo']);
    // a guide cannot widen their scope by asking for someone else's team
    expect((await report(guide1, 'high-risk', `level=low&teamId=${bravoTeam}`)).body.rows).toHaveLength(0);
  });

  it('Q2 delayed teams: HAVING threshold, sorting, and a hostile sort key is ignored (no SQL injection)', async () => {
    const all = await report(admin, 'delayed-teams');
    expect(all.body.rows.map((r: any) => [r.team_name, r.overdue_tasks])).toEqual([['Bravo', 4], ['Charlie', 2]]);
    expect(teams(await report(admin, 'delayed-teams', 'min=2'))).toEqual(['Bravo']);                  // strictly more than 2
    expect((await report(admin, 'delayed-teams', 'min=4')).body.rows).toHaveLength(0);
    expect((await report(admin, 'delayed-teams', 'sort=overdue_tasks&dir=asc')).body.rows[0].team_name).toBe('Charlie');
    const evil = await report(admin, 'delayed-teams', `sort=${encodeURIComponent('1; DROP TABLE tasks;--')}`);
    expect(evil.status).toBe(200);
    expect((await report(admin, 'delayed-teams')).body.rows).toHaveLength(2);                          // table still there
  });

  it('Q10 unapproved milestones, unresolved feedback and missing deliverables match the seeded scenarios', async () => {
    const ms = (await report(admin, 'unapproved-milestones')).body.rows;
    expect(ms.map((r: any) => [r.team_name, r.days_overdue]).sort()).toEqual([['Bravo', 12], ['Charlie', 5]]);
    const fb = await report(admin, 'unresolved-feedback');
    expect(fb.body.rows).toHaveLength(7);                                                              // 1 Alpha + 1 Bravo + 5 Delta
    expect((await report(admin, 'unresolved-feedback', 'overdue=1')).body.rows).toHaveLength(3);      // Bravo 1 + Delta 2
    const miss = await report(admin, 'missing-deliverables');
    expect(miss.body.rows.map((r: any) => [r.team_name, r.missing]).sort()).toEqual([['Bravo', expect.stringContaining('srs')], ['Delta', expect.stringContaining('test report')]]);
  });

  it('contribution imbalance: threshold decides who is flagged', async () => {
    const t = teams(await report(admin, 'contribution-imbalance'));
    expect(t).toContain('Charlie');
    expect(t).not.toContain('Alpha');
    expect(t).not.toContain('Delta');
    expect((await report(admin, 'contribution-imbalance', 'threshold=99')).body.rows).toHaveLength(0);
  });

  it('CSV export: same data, text/csv, scoped like the screen', async () => {
    const res = await admin.raw('/api/reports/delayed-teams?format=csv');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain('delayed-teams.csv');
    const lines = res.bytes.toString().trim().split('\r\n');
    expect(lines[0]).toBe('Team,Course,Guide,Overdue tasks,Most days late');
    expect(lines).toHaveLength(3);
    const g1 = (await guide1.raw('/api/reports/delayed-teams?format=csv')).bytes.toString().trim().split('\r\n');
    expect(g1).toHaveLength(2);                                                                        // only Charlie is guide1's
  });

  it('CON-04: a student sees only their own contribution row; staff see the team', async () => {
    const mine = (await s1.get(`/api/projects/${alpha}/contribution`)).body;
    expect(mine.scope).toBe('self');
    expect(mine.members).toHaveLength(1);
    const all = (await guide1.get(`/api/projects/${alpha}/contribution`)).body;
    expect(all.scope).toBe('team');
    expect(all.members).toHaveLength(3);
    for (const m of all.members) { expect(Number(m.indicator)).toBeGreaterThanOrEqual(0); expect(Number(m.indicator)).toBeLessThanOrEqual(100); }
    expect(all.members.reduce((a: number, m: any) => a + Number(m.share_pct), 0)).toBeGreaterThan(99);
    expect([403, 404]).toContain((await s4.get(`/api/projects/${alpha}/contribution`)).status);       // other team
    expect((await reviewer1.get(`/api/projects/${alpha}/contribution`)).body.members).toHaveLength(3);
  });

  it('risk: the team sees level + reasons only; staff see the breakdown and history; other teams see nothing', async () => {
    const team = (await s1.get(`/api/projects/${alpha}/risk`)).body.risk;
    expect(team).toMatchObject({ level: 'low', reason: expect.any(String) });
    expect(team.breakdown).toBeUndefined();
    const staff = (await guide1.get(`/api/projects/${alpha}/risk`)).body.risk;
    expect(Object.keys(staff.breakdown).sort()).toEqual(['contribution_imbalance', 'inactivity', 'missing_deliverables', 'overdue_milestones', 'overdue_tasks', 'unresolved_feedback']);
    expect((await s1.get(`/api/projects/${alpha}/risk/history`)).status).toBe(403);
    const h = (await guide1.get(`/api/projects/${alpha}/risk/history`)).body;
    expect(h.history.length).toBeGreaterThanOrEqual(4);
    expect(h.trend.length).toBeGreaterThanOrEqual(4);
    expect([403, 404]).toContain((await s4.get(`/api/projects/${alpha}/risk`)).status);
    expect((await s1.post(`/api/projects/${alpha}/risk/recalculate`)).status).toBe(403);
  });

  it('T-30: dashboards render the right widgets for each role', async () => {
    const page = async (c: Client, path: string) => { const r = await c.raw(path); return { status: r.status, html: r.bytes.toString() }; };
    const st = await page(s1, '/dashboard');
    expect(st.status).toBe(200);
    for (const text of ['Team progress', 'My open tasks', 'Feedback to resolve', 'My contribution', 'Delivery risk']) expect(st.html).toContain(text);
    const g = await page(guide1, '/dashboard');
    for (const text of ['Approval queue', 'Unresolved feedback', 'Delayed teams', 'CollegeEvents Hub']) expect(g.html).toContain(text);   // Echo's proposal waits in guide1's queue
    for (const level of ['Low', 'Moderate', 'High', 'Critical']) expect(g.html).toMatch(new RegExp(`${level}(<!-- -->)? risk`));   // the four risk cards
    const a = await page(admin, '/dashboard');
    for (const text of ['Risk by course', 'Allocations needing action', 'Run risk sweep', 'projects without a guide']) expect(a.html).toContain(text);
    const r = await page(reviewer1, '/dashboard');
    for (const text of ['Waiting for your review', 'reviews completed']) expect(r.html).toContain(text);
    expect((await page(s1, '/reports')).status).toBe(404);
    expect((await page(guide1, '/reports?report=delayed-teams&min=1')).status).toBe(200);
    expect((await page(s1, `/projects/${alpha}/contribution`)).status).toBe(200);
    expect((await page(s1, `/projects/${alpha}/risk`)).status).toBe(200);
    expect((await page(s4, `/projects/${alpha}/risk`)).status).toBe(404);
  });
});
