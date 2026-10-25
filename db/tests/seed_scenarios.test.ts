import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import { closeTx, openTx } from './helpers';

/**
 * Guards the demo data (spec 17.1). Requires `npm run db:reset && npm run db:seed`; when the database
 * has not been seeded these tests are skipped rather than failed.
 */
let c: Client;
let seeded = false;

beforeAll(async () => {
  c = await openTx();
  const { rows } = await c.query(`SELECT COUNT(*)::int AS n FROM projects WHERE title LIKE 'CampusConnect%'`);
  seeded = rows[0].n === 1;
});
afterAll(async () => closeTx(c));

async function dash(titlePrefix: string) {
  const { rows } = await c.query(`SELECT * FROM v_faculty_risk_dashboard WHERE title LIKE $1`, [`${titlePrefix}%`]);
  return rows[0];
}

describe('seeded demo scenarios', () => {
  it('Alpha is healthy (low risk, balanced evidence)', async (ctx) => {
    if (!seeded) return ctx.skip();
    const d = await dash('CampusConnect');
    expect(d.risk_level).toBe('low');
    expect(Number(d.overdue_tasks)).toBe(0);
    const { rows } = await c.query(`SELECT MAX(share_pct) AS top FROM v_contribution_summary cs JOIN projects p USING (project_id) WHERE p.title LIKE 'CampusConnect%'`);
    expect(Number(rows[0].top)).toBeLessThan(50);
  });

  it('Bravo is delayed: overdue milestone and tasks, SRS missing, inactive, high risk', async (ctx) => {
    if (!seeded) return ctx.skip();
    const d = await dash('LibrarySeat');
    expect(['high', 'critical']).toContain(d.risk_level);
    expect(Number(d.overdue_tasks)).toBe(4);
    const missing = await c.query(`SELECT missing_type FROM v_missing_mandatory_deliverables WHERE project_title LIKE 'LibrarySeat%'`);
    expect(missing.rows.map((r) => r.missing_type)).toContain('srs');
    const { rows } = await c.query(`SELECT breakdown FROM v_latest_risk r JOIN projects p USING (project_id) WHERE p.title LIKE 'LibrarySeat%'`);
    expect(rows[0].breakdown.inactivity).toBe(10);          // no activity for 11+ days
    expect(rows[0].breakdown.overdue_milestones).toBe(12.5);
  });

  it('Charlie shows contribution imbalance (one member ~80% of verified evidence)', async (ctx) => {
    if (!seeded) return ctx.skip();
    const { rows } = await c.query(`SELECT MAX(share_pct) AS top FROM v_contribution_summary cs JOIN projects p USING (project_id) WHERE p.title LIKE 'ClinicQueue%'`);
    expect(Number(rows[0].top)).toBeGreaterThanOrEqual(70);
    expect((await dash('ClinicQueue')).risk_level).toBe('moderate');
  });

  it('Delta has 5 unresolved feedback items (2 overdue) and a missing test report', async (ctx) => {
    if (!seeded) return ctx.skip();
    const d = await dash('AgriAdvisor');
    expect(Number(d.unresolved_feedback)).toBe(5);
    const overdue = await c.query(`SELECT COUNT(*)::int AS n FROM v_unresolved_feedback WHERE project_title LIKE 'AgriAdvisor%' AND is_overdue`);
    expect(overdue.rows[0].n).toBe(2);
    const missing = await c.query(`SELECT missing_type FROM v_missing_mandatory_deliverables WHERE project_title LIKE 'AgriAdvisor%'`);
    expect(missing.rows.map((r) => r.missing_type)).toEqual(['test_report']);
    expect(['moderate', 'high']).toContain(d.risk_level);
  });

  it('Echo is submitted and Foxtrot (other course) is awaiting revision', async (ctx) => {
    if (!seeded) return ctx.skip();
    const { rows } = await c.query(
      `SELECT p.title, p.status, co.course_code FROM projects p JOIN courses co USING (course_id)
        WHERE p.title LIKE 'CollegeEvents%' OR p.title LIKE 'FestFlow%' ORDER BY p.title`);
    expect(rows).toEqual([
      { title: expect.stringContaining('CollegeEvents'), status: 'submitted', course_code: 'CS-DBMS-P' },
      { title: expect.stringContaining('FestFlow'), status: 'revision_requested', course_code: 'CS-SE-P' },
    ]);
  });

  it('covers every feedback state and has a rich audit trail from the real workflows', async (ctx) => {
    if (!seeded) return ctx.skip();
    const fb = await c.query(`SELECT DISTINCT resolution_status FROM feedback_items`);
    expect(fb.rows.map((r) => r.resolution_status).sort()).toEqual(['in_progress', 'open', 'reopened', 'resolved', 'verified']);
    const audit = await c.query(`SELECT COUNT(*)::int AS n FROM audit_logs WHERE action = 'STATUS_CHANGE' AND user_id IS NOT NULL`);
    expect(audit.rows[0].n).toBeGreaterThanOrEqual(15);
  });

  it('has risk history (trend) for every active project and each template milestone set totals 100', async (ctx) => {
    if (!seeded) return ctx.skip();
    const { rows } = await c.query(`SELECT project_id, COUNT(*)::int AS n FROM risk_assessments GROUP BY 1`);
    expect(rows).toHaveLength(4);
    for (const r of rows) expect(r.n).toBeGreaterThanOrEqual(4);   // 3 older snapshots + the current sweep
    const w = await c.query(`SELECT SUM(weightage) AS total FROM milestones GROUP BY project_id`);
    for (const r of w.rows) expect(Number(r.total)).toBe(100);
  });
});
