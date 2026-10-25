import { beforeAll, describe, expect, it } from 'vitest';
import { em, login, projectIdByTitle, serverUp, type Client } from './helpers';

/** Peer evaluation (P1): controlled, one rating per teammate per milestone, anonymous to the person rated. Changes data. */
const enabled = (await serverUp()) && process.env.ALLOW_MUTATING_TESTS === '1';
const d = enabled ? describe : describe.skip;

d('peer evaluation (Alpha)', () => {
  let admin: Client, s1: Client, s2: Client, s3: Client, s4: Client, guide1: Client;
  let alpha: number, bravo: number, id1: number, id2: number, id3: number, m3: number, m4: number, bravoMs: number;
  const rate = (c: Client, body: object) => c.post(`/api/projects/${alpha}/peer-evaluations`, body);

  beforeAll(async () => {
    [admin, s1, s2, s3, s4, guide1] = await Promise.all([login(em.admin), login(em.student(1)), login(em.student(2)), login(em.student(3)), login(em.student(4)), login(em.guide(1))]);
    alpha = await projectIdByTitle(admin, 'CampusConnect');
    bravo = await projectIdByTitle(admin, 'LibrarySeat');
    [id1, id2, id3] = await Promise.all([s1, s2, s3].map(async (c) => (await c.get('/api/auth/me')).body.user.userId));
    const ms = (await s1.get(`/api/projects/${alpha}/milestones`)).body.milestones;
    m3 = ms.find((m: any) => m.sequence_no === 3).milestone_id;
    m4 = ms.find((m: any) => m.sequence_no === 4).milestone_id;
    bravoMs = (await s4.get(`/api/projects/${bravo}/milestones`)).body.milestones[0].milestone_id;
  });

  it('a student rates a teammate; the same pair cannot be rated twice for one milestone', async () => {
    expect((await rate(s1, { milestoneId: m3, evaluateeId: id2, score: 4.5, comments: 'Great ER diagram.' })).status).toBe(201);
    const dup = await rate(s1, { milestoneId: m3, evaluateeId: id2, score: 3 });
    expect(dup.status).toBe(409);
    expect(dup.body.error.message).toContain('already rated');
    expect((await rate(s1, { milestoneId: m3, evaluateeId: id3, score: 4 })).status).toBe(201);          // a different teammate is fine
    expect((await rate(s2, { milestoneId: m3, evaluateeId: id1, score: 5 })).status).toBe(201);          // the other direction is a different rating
  });

  it('is controlled: no self-rating, only teammates, valid milestone, scores 1 to 5 in half points', async () => {
    expect((await rate(s3, { milestoneId: m3, evaluateeId: id3, score: 4 })).status).toBe(422);
    const outsider = (await s4.get('/api/auth/me')).body.user.userId;
    const notMate = await rate(s3, { milestoneId: m3, evaluateeId: outsider, score: 4 });
    expect(notMate.status).toBe(422);
    expect(notMate.body.error.message).toContain('not in your team');
    expect((await rate(s3, { milestoneId: bravoMs, evaluateeId: id1, score: 4 })).status).toBe(422);     // other project's milestone
    expect((await rate(s3, { milestoneId: m4, evaluateeId: id1, score: 4 })).status).toBe(409);          // milestone not started yet
    for (const score of [0, 6, 4.3]) expect((await rate(s3, { milestoneId: m3, evaluateeId: id1, score })).status).toBe(422);
    expect((await rate(guide1, { milestoneId: m3, evaluateeId: id1, score: 4 })).status).toBe(403);       // staff do not rate students
    expect([403, 404]).toContain((await s4.post(`/api/projects/${alpha}/peer-evaluations`, { milestoneId: m3, evaluateeId: id1, score: 4 })).status);
  });

  it('a student sees only an anonymous aggregate of what they received, plus which ratings they already gave', async () => {
    const self = (await s2.get(`/api/projects/${alpha}/peer-evaluations/summary`)).body;
    expect(self.view).toBe('self');
    expect(self.received.ratings).toBe(3);                                                              // 2 seeded + the new one
    expect(self.received.comments).toContain('Great ER diagram.');
    expect(JSON.stringify(self)).not.toMatch(/Chiranthan|evaluator/);                                   // no names of raters
    expect(self.given).toContainEqual({ milestone_id: m3, evaluatee_id: id1 });                        // plus the two seeded ratings for milestone 2
    expect((await s4.get(`/api/projects/${alpha}/peer-evaluations/summary`)).status).toBeGreaterThanOrEqual(403);
  });

  it('the guide sees who rated whom, and the averages feed the contribution indicator', async () => {
    const staff = (await guide1.get(`/api/projects/${alpha}/peer-evaluations/summary`)).body;
    expect(staff.view).toBe('staff');
    const mine = staff.evaluations.find((e: any) => e.comments === 'Great ER diagram.');
    expect(mine).toMatchObject({ evaluator: expect.any(String), evaluatee: expect.any(String), score: '4.5' });
    expect(staff.perMember).toHaveLength(3);
    expect(staff.perMember.every((m: any) => m.ratings >= 2)).toBe(true);
    const contrib = (await guide1.get(`/api/projects/${alpha}/contribution`)).body.members;
    expect(contrib.every((m: any) => m.avg_peer_score !== null)).toBe(true);
  });
});
