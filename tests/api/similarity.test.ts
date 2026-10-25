import { beforeAll, describe, expect, it } from 'vitest';
import { em, login, projectIdByTitle, serverUp, type Client } from './helpers';
import { mongo, sql } from './stores';

/** Read-only: similarity screening (T-22), student hint privacy, MongoDB aggregations (T-26), audit viewer. */
const up = await serverUp();
const d = up ? describe : describe.skip;

d('similarity screening (seeded Echo vs Alpha)', () => {
  let anon: Client, admin: Client, guide1: Client, guide2: Client, reviewer1: Client, s1: Client, s11: Client, s13: Client;
  let echo: number, fox: number;

  beforeAll(async () => {
    [anon, admin, guide1, guide2, reviewer1, s1, s11, s13] = await Promise.all([
      login(null), login(em.admin), login(em.guide(1)), login(em.guide(2)), login('reviewer1@projectpulse.test'), login(em.student(1)), login(em.student(11)), login(em.student(13)),
    ]);
    echo = await projectIdByTitle(admin, 'CollegeEvents');
    fox = await projectIdByTitle(admin, 'FestFlow');
  });

  it('T-22: Echo is flagged against Alpha above the threshold, with matching text and per-section scores', async () => {
    const r = (await guide1.get('/api/similarity/reviews?sections=1')).body.reviews;
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ source_team: 'Echo', matched_team: 'Alpha', faculty_decision: 'pending' });
    expect(Number(r[0].similarity_score)).toBeGreaterThanOrEqual(0.8);
    expect(r[0].source_excerpt.length).toBeGreaterThan(20);
    expect(r[0].matched_excerpt.length).toBeGreaterThan(20);
    expect(r[0].sections.map((s: any) => s.section_type).sort()).toEqual(['abstract', 'objectives', 'problem_statement', 'scope', 'title']);
    for (const s of r[0].sections) { expect(Number(s.similarity)).toBeGreaterThan(0.5); expect(s.source_text).toBeTruthy(); }
  });

  it('T-22: unrelated teams are below the threshold and Foxtrot (other course) is never matched', async () => {
    const pairs = await sql(`SELECT s.title AS source, m.title AS matched FROM similarity_reviews sr JOIN projects s ON s.project_id = sr.source_project_id JOIN projects m ON m.project_id = sr.matched_project_id`);
    expect(pairs).toHaveLength(1);
    expect(JSON.stringify(pairs)).not.toMatch(/FestFlow|LibrarySeat|ClinicQueue|AgriAdvisor/);
    // Foxtrot is embedded, but the course filter keeps it out of every DBMS comparison
    expect(Number((await sql(`SELECT COUNT(*) AS n FROM project_embeddings WHERE project_id = $1 AND is_current`, [fox]))[0].n)).toBeGreaterThanOrEqual(5);
    const all = (await admin.get('/api/similarity/reviews')).body.reviews;
    expect(all.every((x: any) => x.source_team !== 'Foxtrot' && x.matched_team !== 'Foxtrot')).toBe(true);
  });

  it('visibility: only the source proposal\'s guide (and admin) see the pair; students never reach it', async () => {
    expect((await admin.get('/api/similarity/reviews')).body.reviews).toHaveLength(1);
    expect((await guide2.get('/api/similarity/reviews')).body.reviews).toHaveLength(0);
    expect((await reviewer1.get('/api/similarity/reviews')).body.reviews).toHaveLength(0);
    for (const c of [s1, s11, s13]) expect((await c.get('/api/similarity/reviews')).status).toBe(403);
    expect((await anon.get('/api/similarity/reviews')).status).toBe(401);
    expect((await s11.post('/api/similarity/reviews/1/decision', { decision: 'not_similar' })).status).toBe(403);
  });

  it('free-text search finds proposals by meaning, scoped to the courses a faculty member supervises', async () => {
    const campus = (await admin.post('/api/similarity/search', { query: 'volunteer scheduling for campus events with QR check-in', k: 3 })).body.results;
    expect(campus.slice(0, 2).map((r: any) => r.title.split(':')[0]).sort()).toEqual(['CampusConnect', 'CollegeEvents Hub']);
    const clinic = (await guide1.post('/api/similarity/search', { query: 'software for tracking patients waiting at a hospital', k: 3 })).body.results;
    expect(clinic[0].title).toContain('ClinicQueue');
    const g1 = (await guide1.post('/api/similarity/search', { query: 'registration for a college fest', k: 10 })).body.results;
    expect(g1.some((r: any) => r.title.startsWith('FestFlow'))).toBe(false);                      // other course: out of scope for guide1
    expect((await guide1.post('/api/similarity/search', { query: 'hi' })).status).toBe(422);
    expect((await s1.post('/api/similarity/search', { query: 'anything at all' })).status).toBe(403);
  });

  it('student hint: yes/no and a fixed sentence only; never titles, text, scores or team names', async () => {
    const r = await s13.post('/api/similarity/check', { projectId: fox });
    expect(r.status).toBe(200);
    expect(Object.keys(r.body).sort()).toEqual(['message', 'possibleOverlap']);
    expect(r.body.possibleOverlap).toBe(false);
    expect((await s11.post('/api/similarity/check', { projectId: echo })).status).toBe(409);       // already submitted
    expect([403, 404]).toContain((await s1.post('/api/similarity/check', { projectId: fox })).status);   // not their project
    expect((await anon.post('/api/similarity/check', { projectId: fox })).status).toBe(401);
  });

  it('embeddings exist for every proposal that has been submitted', async () => {
    const rows = await sql(`SELECT p.title FROM projects p WHERE p.status <> 'draft' AND NOT EXISTS (SELECT 1 FROM project_embeddings e WHERE e.project_id = p.project_id AND e.is_current)`);
    expect(rows).toHaveLength(0);
  });
});

d('MongoDB aggregations (T-26)', () => {
  let admin: Client, guide1: Client, guide2: Client, s1: Client, s9: Client, s4: Client;
  let alpha: number, delta: number;
  beforeAll(async () => {
    [admin, guide1, guide2, s1, s9, s4] = await Promise.all([login(em.admin), login(em.guide(1)), login(em.guide(2)), login(em.student(1)), login(em.student(9)), login(em.student(4))]);
    alpha = await projectIdByTitle(admin, 'CampusConnect');
    delta = await projectIdByTitle(admin, 'AgriAdvisor');
  });

  it('A1 version counts match the seeded documents', async () => {
    const v = (await s1.get(`/api/projects/${alpha}/documents/stats`)).body.versions;
    expect(v.map((x: any) => [x.documentType, x.versionCount])).toEqual([['SRS', 3], ['Proposal', 2], ['Design', 1]]);
    expect(v[0].lastUpdated).toBeTruthy();
  });

  it('A3 completeness merges SQL (required types) with MongoDB (existing documents) and agrees with fn_documentation_completeness', async () => {
    for (const [client, project, expected] of [[s1, alpha, 100], [s9, delta, 83.3]] as const) {
      const c = (await client.get(`/api/projects/${project}/documents/stats`)).body.completeness;
      expect(c.pct).toBe(expected);
      expect(c.pct).toBe(c.sqlPct);
    }
    const dc = (await s9.get(`/api/projects/${delta}/documents/stats`)).body.completeness.required;
    expect(dc.filter((r: any) => !r.present).map((r: any) => r.type)).toEqual(['test_report']);
  });

  it('A4 open feedback themes: counts add up to the open threads; students do not get them', async () => {
    const themes = (await guide2.get(`/api/projects/${delta}/documents/stats`)).body.themes;
    const open = Number((await sql(`SELECT COUNT(*) AS n FROM feedback_items f JOIN reviews r USING (review_id) JOIN milestones m USING (milestone_id) WHERE m.project_id = $1 AND f.resolution_status IN ('open','in_progress','reopened')`, [delta]))[0].n);
    expect(themes.reduce((a: number, t: any) => a + t.openThreads, 0)).toBe(open);
    expect(themes[0].openThreads).toBeGreaterThanOrEqual(themes.at(-1).openThreads);               // sorted by count
    expect((await s9.get(`/api/projects/${delta}/documents/stats`)).body.themes).toBeNull();
    expect([403, 404]).toContain((await s4.get(`/api/projects/${delta}/documents/stats`)).status);
  });

  it('A2 / A5 across a faculty member\'s projects add up to the documents in MongoDB', async () => {
    const all = (await admin.get('/api/documents/stats')).body;
    const total = await mongo((db) => db.collection('documents').countDocuments({ state: 'confirmed' }));
    expect(all.types.reduce((a: number, t: any) => a + t.documents, 0)).toBe(total);
    expect(all.types.every((t: any) => t.avgVersions >= 1)).toBe(true);
    const g1 = (await guide1.get('/api/documents/stats')).body;
    const expected = Number((await sql(`SELECT COUNT(*) AS n FROM deliverables d JOIN milestones m USING (milestone_id) WHERE m.project_id IN (SELECT project_id FROM guide_allocations WHERE user_id = (SELECT user_id FROM users WHERE email = 'guide1@projectpulse.test'))`))[0].n);
    expect(g1.types.reduce((a: number, t: any) => a + t.documents, 0)).toBe(expected);
    expect(all.tags.length).toBeGreaterThan(0);
    expect((await s1.get('/api/documents/stats')).status).toBe(403);
  });
});

d('audit log viewer (AUD-01)', () => {
  let admin: Client, guide1: Client, s1: Client;
  beforeAll(async () => { [admin, guide1, s1] = await Promise.all([login(em.admin), login(em.guide(1)), login(em.student(1))]); });

  it('admin only; filters by entity, action, user and dates', async () => {
    expect((await guide1.get('/api/admin/audit')).status).toBe(403);
    expect((await s1.get('/api/admin/audit')).status).toBe(403);
    const all = (await admin.get('/api/admin/audit')).body;
    expect(all.total).toBeGreaterThan(100);
    expect(all.rows).toHaveLength(50);
    const tasks = (await admin.get('/api/admin/audit?entity=tasks&action=STATUS_CHANGE')).body;
    expect(tasks.rows.every((r: any) => r.entity_type === 'tasks' && r.action === 'STATUS_CHANGE')).toBe(true);
    expect(tasks.total).toBe(Number((await sql(`SELECT COUNT(*) AS n FROM audit_logs WHERE entity_type = 'tasks' AND action = 'STATUS_CHANGE'`))[0].n));
    const g1 = (await sql(`SELECT user_id FROM users WHERE email = 'guide1@projectpulse.test'`))[0].user_id;
    const byUser = (await admin.get(`/api/admin/audit?user=${g1}`)).body;
    expect(byUser.total).toBeGreaterThan(0);
    expect(byUser.rows.every((r: any) => r.user_name === byUser.rows[0].user_name)).toBe(true);
    expect((await admin.get('/api/admin/audit?from=2999-01-01')).body.total).toBe(0);
    expect((await admin.get('/api/admin/audit?from=2000-01-01&to=2999-01-01')).body.total).toBe(all.total);
  });

  it('paginates newest first and rejects bad input', async () => {
    const p1 = (await admin.get('/api/admin/audit?page=1')).body.rows;
    const p2 = (await admin.get('/api/admin/audit?page=2')).body.rows;
    expect(p2.length).toBeGreaterThan(0);
    expect(p1[0].log_id).not.toBe(p2[0].log_id);
    expect(new Date(p1[0].created_at).getTime()).toBeGreaterThanOrEqual(new Date(p2[0].created_at).getTime());
    expect((await admin.get('/api/admin/audit?from=yesterday')).status).toBe(422);
    expect((await admin.get(`/api/admin/audit?entity=${encodeURIComponent("tasks' OR '1'='1")}`)).body.total).toBe(0);   // a bound parameter, not SQL
  });

  it('the audit page renders for admins and is hidden from everyone else', async () => {
    const page = await admin.raw('/admin/audit?entity=projects');
    expect(page.status).toBe(200);
    expect(page.bytes.toString()).toContain('Audit log');
    expect((await s1.raw('/admin/audit')).status).toBe(404);
    expect((await guide1.raw('/admin/audit')).status).toBe(404);
  });
});
