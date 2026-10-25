import { beforeAll, describe, expect, it } from 'vitest';
import { em, login, projectIdByTitle, serverUp, type Client } from './helpers';
import { sql } from './stores';

/**
 * T-22 / T-23 end to end: a new proposal is embedded and screened when it is SUBMITTED, faculty record decisions,
 * the student hint stays generic. Creates a team and a proposal, so it needs ALLOW_MUTATING_TESTS=1.
 */
const enabled = (await serverUp()) && process.env.ALLOW_MUTATING_TESTS === '1';
const d = enabled ? describe : describe.skip;

const OVERLAP = {
  title: 'ClubSpace: Campus Event and Volunteer Management Platform',
  abstract: 'ClubSpace is a web platform that lets student clubs create campus events, publish schedules, manage registrations and coordinate volunteers. Organisers assign volunteers to event shifts while attendees receive reminders and check in with QR codes.',
  problemStatement: 'Student clubs coordinate events and volunteers through scattered chat groups and spreadsheets, which leads to clashing bookings, forgotten volunteer shifts and no record of participation.',
  objectives: '1. Provide a single place to create and approve campus events. 2. Automate volunteer shift allocation and reminders. 3. Track attendance with QR check-in. 4. Report participation for each club.',
  scope: 'Event creation, registration, volunteer scheduling, QR attendance and basic analytics for one campus. Online payments and ticketing are excluded.',
  domain: 'Campus Management', technologies: ['Next.js', 'PostgreSQL'],
};
const UNRELATED = {
  title: 'CanteenBill: Billing and Stock Control for a University Canteen',
  abstract: 'CanteenBill records every meal sold at a university canteen, keeps track of the ingredients in stock and warns the manager when supplies run low so that food is not wasted.',
  problemStatement: 'The canteen manager counts stock by hand each evening, so shortages are noticed only when a dish cannot be cooked and leftover food is thrown away.',
  objectives: '1. Fast billing at the counter. 2. Automatic stock deduction per dish. 3. Low-stock alerts. 4. Daily wastage report.',
  scope: 'Billing, recipes, stock levels and wastage reports for one canteen. Online ordering is excluded.',
  domain: 'Food Services', technologies: ['React', 'PostgreSQL'],
};

d('similarity: embed on submit, faculty decisions, student hint (new team Hotel)', () => {
  let admin: Client, s13: Client, s14: Client, guide1: Client, guide2: Client, s11: Client;
  let project: number, dbms: number, echo: number, alpha: number;
  const reviews = async (c: Client) => (await c.get('/api/similarity/reviews')).body.reviews as any[];

  beforeAll(async () => {
    [admin, s13, s14, guide1, guide2, s11] = await Promise.all([login(em.admin), login(em.student(13)), login(em.student(14)), login(em.guide(1)), login(em.guide(2)), login(em.student(11))]);
    echo = await projectIdByTitle(admin, 'CollegeEvents');
    alpha = await projectIdByTitle(admin, 'CampusConnect');
    dbms = (await admin.get('/api/courses')).body.courses.find((c: any) => c.course_code === 'CS-DBMS-P').course_id;
  });

  it('T-23: the student hint says only "possible overlap" or not; it never names another team', async () => {
    const ids = await Promise.all([s13, s14].map(async (c) => (await c.get('/api/auth/me')).body.user.userId));
    const team = await admin.post('/api/teams', { courseId: dbms, teamName: 'Hotel', memberIds: ids });
    expect(team.status).toBe(201);
    const created = await s13.post('/api/proposals', { ...OVERLAP, teamId: team.body.teamId });
    expect(created.status).toBe(201);
    project = created.body.projectId;

    const yes = await s13.post('/api/similarity/check', { projectId: project });
    expect(yes.body.possibleOverlap).toBe(true);
    expect(Object.keys(yes.body).sort()).toEqual(['message', 'possibleOverlap']);
    expect(JSON.stringify(yes.body)).not.toMatch(/CampusConnect|CollegeEvents|Alpha|Echo|\d\.\d/);       // no titles, teams or scores

    expect((await s13.patch(`/api/proposals/${project}`, { ...UNRELATED })).status).toBe(200);
    expect((await s13.post('/api/similarity/check', { projectId: project })).body.possibleOverlap).toBe(false);
    expect((await s13.patch(`/api/proposals/${project}`, { ...OVERLAP })).status).toBe(200);
  });

  it('T-22: submitting embeds the proposal and flags it against Alpha and Echo, but not against unrelated teams', async () => {
    expect((await admin.post(`/api/projects/${project}/allocations`, { userId: (await guide1.get('/api/auth/me')).body.user.userId, allocationRole: 'guide' })).status).toBe(201);
    expect((await reviews(guide1)).filter((r) => r.source_team === 'Hotel')).toHaveLength(0);           // nothing before submission
    expect((await s13.post(`/api/proposals/${project}/submit`)).status).toBe(200);
    const emb = await sql(`SELECT COUNT(*)::int AS n FROM project_embeddings WHERE project_id = $1 AND is_current`, [project]);
    expect(emb[0].n).toBeGreaterThanOrEqual(5);
    const mine = (await reviews(guide1)).filter((r) => r.source_team === 'Hotel');
    expect(mine.map((r) => r.matched_team).sort()).toEqual(['Alpha', 'Echo']);
    for (const r of mine) { expect(Number(r.similarity_score)).toBeGreaterThanOrEqual(0.8); expect(r.faculty_decision).toBe('pending'); }
    expect((await guide2.get('/api/similarity/reviews')).body.reviews.filter((r: any) => r.source_team === 'Hotel')).toHaveLength(0);
    // resubmitting later would update, not duplicate, these rows (unique pair)
    const dupes = await sql(`SELECT COUNT(*)::int AS n FROM (SELECT 1 FROM similarity_reviews GROUP BY source_project_id, matched_project_id HAVING COUNT(*) > 1) x`);
    expect(dupes[0].n).toBe(0);
  });

  it('T-23: only the source proposal\'s guide records a decision; illegal changes are refused; everything is audited', async () => {
    const pairs = (await reviews(guide1)).filter((r) => r.source_team === 'Hotel');
    const toEcho = pairs.find((r) => r.matched_team === 'Echo'), toAlpha = pairs.find((r) => r.matched_team === 'Alpha');
    const decide = (c: Client, id: number, body: object) => c.post(`/api/similarity/reviews/${id}/decision`, body);
    expect((await decide(guide2, toEcho.similarity_id, { decision: 'not_similar' })).status).toBe(403);
    expect((await decide(s13, toEcho.similarity_id, { decision: 'not_similar' })).status).toBe(403);
    const noWhy = await decide(guide1, toEcho.similarity_id, { decision: 'needs_revision' });
    expect(noWhy.status).toBe(422);
    expect(noWhy.body.error.fields.comments).toBeTruthy();

    expect((await decide(guide1, toEcho.similarity_id, { decision: 'acceptable_overlap', comments: 'Different campus focus; shared idea is common.' })).status).toBe(200);
    const row = (await sql(`SELECT faculty_decision, reviewed_by, decided_at, comments FROM similarity_reviews WHERE similarity_id = $1`, [toEcho.similarity_id]))[0];
    expect(row).toMatchObject({ faculty_decision: 'acceptable_overlap', comments: expect.stringContaining('Different campus') });
    expect(row.reviewed_by).not.toBeNull();
    expect(row.decided_at).not.toBeNull();
    const audit = await sql(`SELECT user_id, new_values FROM audit_logs WHERE entity_type = 'similarity_reviews' AND entity_id = $1 AND action = 'STATUS_CHANGE'`, [String(toEcho.similarity_id)]);
    expect(audit).toHaveLength(1);
    expect(audit[0].user_id).toBe(row.reviewed_by);
    expect(audit[0].new_values.faculty_decision).toBe('acceptable_overlap');
    expect((await decide(guide1, toEcho.similarity_id, { decision: 'escalated', comments: 'changed my mind' })).status).toBe(422);   // a decided pair is final

    expect((await decide(guide1, toAlpha.similarity_id, { decision: 'escalated', comments: 'Needs the coordinator.' })).status).toBe(200);
    expect((await decide(guide1, toAlpha.similarity_id, { decision: 'not_similar', comments: 'Coordinator agreed.' })).status).toBe(200);   // escalated -> decided
    expect((await sql(`SELECT faculty_decision FROM similarity_reviews WHERE similarity_id = $1`, [toAlpha.similarity_id]))[0].faculty_decision).toBe('not_similar');
    expect((await reviews(guide1)).filter((r) => r.faculty_decision === 'pending' && r.source_team === 'Hotel')).toHaveLength(0);
  });

  it('a rejected proposal stops being matched: its embeddings are retired', async () => {
    expect((await s11.get(`/api/proposals/${project}`)).status).toBeGreaterThanOrEqual(403);           // other teams cannot read it
    expect((await guide1.post(`/api/proposals/${project}/decision`, { action: 'reject', comments: 'Duplicates an existing proposal.' })).body.status).toBe('rejected');
    expect((await sql(`SELECT COUNT(*)::int AS n FROM project_embeddings WHERE project_id = $1 AND is_current`, [project]))[0].n).toBe(0);
    const hit = (await admin.post('/api/similarity/search', { query: 'ClubSpace volunteer management platform for campus clubs', k: 5 })).body.results;
    expect(hit.some((h: any) => h.title.startsWith('ClubSpace'))).toBe(false);
    void echo; void alpha;
  });
});
