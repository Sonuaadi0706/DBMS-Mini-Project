import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { closeTx, openTx } from './helpers';

/** Executes every block of db/queries/important_queries.sql with sample parameters and checks what it returns on the seeded demo. */
const file = fs.readFileSync(path.resolve(__dirname, '../queries/important_queries.sql'), 'utf8');
const blocks = new Map<string, string>();
for (const part of file.split(/\n(?=-- Q\d+[ab]? )/).slice(1)) {
  const key = part.match(/^-- (Q\d+[ab]?) /)![1];
  blocks.set(key, part.split('\n').filter((l) => !l.startsWith('--')).join('\n').trim().replace(/;$/, ''));
}

let c: Client;
let seeded = false;
let ids: { guide2: number; bravo: number; vec: string; course: number; echo: number };
beforeAll(async () => {
  c = await openTx();
  seeded = (await c.query(`SELECT COUNT(*)::int AS n FROM projects WHERE title LIKE 'CampusConnect%'`)).rows[0].n === 1;
  if (!seeded) return;
  const q = async (sql: string) => (await c.query(sql)).rows[0];
  const echo = (await q(`SELECT project_id, course_id FROM projects WHERE title LIKE 'CollegeEvents%'`));
  ids = {
    guide2: (await q(`SELECT user_id FROM users WHERE email = 'guide2@projectpulse.test'`)).user_id,
    bravo: (await q(`SELECT project_id FROM projects WHERE title LIKE 'LibrarySeat%'`)).project_id,
    vec: (await q(`SELECT embedding::text AS v FROM project_embeddings WHERE project_id = ${echo.project_id} AND section_type = 'abstract' LIMIT 1`).catch(() => ({ v: null }))).v,
    course: echo.course_id, echo: echo.project_id,
  };
});
afterAll(async () => closeTx(c));

const run = async (key: string, params: unknown[] = []) => (await c.query(blocks.get(key)!, params)).rows;

describe('important_queries.sql', () => {
  it('contains all of Q1 to Q14', () => {
    expect([...blocks.keys()]).toEqual(['Q1', 'Q2', 'Q3', 'Q4a', 'Q4b', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'Q10', 'Q11', 'Q12', 'Q13', 'Q14']);
  });

  it('Q1 high-risk projects of a guide; Q9 guide workload', async (ctx) => {
    if (!seeded) return ctx.skip();
    const q1 = await run('Q1', [ids.guide2]);
    expect(q1.map((r) => r.team_name)).toEqual(['Bravo']);
    const q9 = await run('Q9');
    expect(q9.find((r) => r.name === 'Prof. Meera Rao')).toMatchObject({ projects: '2', high_risk: '1' });
  });

  it('Q2 teams with more than N overdue tasks (HAVING)', async (ctx) => {
    if (!seeded) return ctx.skip();
    expect((await run('Q2', [0])).map((r) => [r.team_name, r.overdue_tasks])).toEqual([['Bravo', '4'], ['Charlie', '2']]);
    expect(await run('Q2', [3])).toHaveLength(1);
  });

  it('Q3 contribution comparison; Q4 feedback by milestone and the NOT EXISTS form', async (ctx) => {
    if (!seeded) return ctx.skip();
    const q3 = await run('Q3', [ids.bravo]);
    expect(q3).toHaveLength(2);
    expect(Number(q3[0].weighted_points)).toBeGreaterThan(Number(q3[1].weighted_points));
    expect((await run('Q4a', [ids.bravo])).length).toBeGreaterThan(0);
    const q4b = await run('Q4b');
    expect(q4b.every((r) => r.title)).toBe(true);
  });

  it('Q5 missing mandatory deliverables; Q10 overdue unapproved milestones', async (ctx) => {
    if (!seeded) return ctx.skip();
    expect((await run('Q5')).map((r) => r.title.split(':')[0]).sort()).toEqual(['AgriAdvisor', 'LibrarySeat']);
    expect((await run('Q10')).map((r) => [r.team_name, r.days_overdue]).sort()).toEqual([['Bravo', 12], ['Charlie', 5]]);
  });

  it('Q6 similar proposals by cosine similarity, filtered by course (Alpha is the closest to Echo)', async (ctx) => {
    if (!seeded || !ids.vec) return ctx.skip();
    const rows = await run('Q6', [ids.vec, ids.course, ids.echo, 3]);
    expect(rows[0].title).toContain('CampusConnect');
    expect(Number(rows[0].cosine_similarity)).toBeGreaterThan(0.6);
    expect(rows.every((r) => !r.title.startsWith('FestFlow'))).toBe(true);
  });

  it('Q7, Q8, Q14 risk history', async (ctx) => {
    if (!seeded) return ctx.skip();
    expect(await run('Q7')).toHaveLength(4);
    expect((await run('Q8', [ids.bravo])).length).toBeGreaterThanOrEqual(4);
    const q14 = await run('Q14');                                       // Bravo, Charlie and Delta rose since last week
    expect(q14.map((r) => Number(r.now) > Number(r.last_week))).not.toContain(false);
    expect(q14.length).toBeGreaterThanOrEqual(2);
  });

  it('Q11 above-average open feedback; Q12 full-text search; Q13 feedback turnaround', async (ctx) => {
    if (!seeded) return ctx.skip();
    expect((await run('Q11')).length).toBeGreaterThanOrEqual(1);
    expect((await run('Q12', ['event'])).map((r) => r.title.split(':')[0]).sort()).toEqual(['CampusConnect', 'CollegeEvents Hub', 'FestFlow']);
    const q13 = await run('Q13');
    expect(q13.length).toBeGreaterThan(0);
    expect(Number(q13[0].avg_days_to_resolve)).toBeGreaterThanOrEqual(0);
  });
});
