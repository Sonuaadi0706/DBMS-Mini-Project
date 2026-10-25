import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { chromium, type Browser, type Page } from 'playwright-core';
import { MongoClient } from 'mongodb';
import { requireEnv } from './lib/env';
import { pipelines } from '../db/mongo/aggregations';

/**
 * Captures the report's screenshots (S-01 ... S-22) from the running app with the installed Chrome.
 * Sessions come from the real login API (the password is read from .env and never typed or printed).
 *   npm run dev -- -p 3100        (another terminal)
 *   npm run docs:screenshots [-- pages|terminal|git]
 */
const BASE = process.env.CAPTURE_BASE ?? 'http://localhost:3100';
const OUT = path.resolve(__dirname, '../docs/screenshots');
const ROOT = path.resolve(__dirname, '..');
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const only = process.argv[2];

async function sessionCookie(email: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: requireEnv('SEED_DEFAULT_PASSWORD') }) });
  if (!res.ok) throw new Error(`login failed for ${email}`);
  return res.headers.getSetCookie().find((c) => c.startsWith('pp_session='))!.split(';')[0].split('=').slice(1).join('=');
}
const email = { admin: 'admin@projectpulse.test', guide1: 'guide1@projectpulse.test', guide2: 'guide2@projectpulse.test', s1: 'student01@projectpulse.test', s4: 'student04@projectpulse.test', s13: 'student13@projectpulse.test' };

async function openAs(browser: Browser, who: keyof typeof email | null, width = 1280): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 1.25 });
  if (who) await ctx.addCookies([{ name: 'pp_session', value: await sessionCookie(email[who]), url: BASE, httpOnly: true, sameSite: 'Lax' }]);
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());
  return page;
}

async function shot(page: Page, file: string, maxHeight = 1000, from?: string) {
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => undefined);
  await page.waitForTimeout(400);
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  // optionally start the picture at a given element (e.g. the part of a long page that matters)
  const top = from ? Math.max(0, await page.locator(from).first().evaluate((el) => el.getBoundingClientRect().top + window.scrollY) - 12) : 0;
  const width = page.viewportSize()!.width;
  await page.screenshot({ path: path.join(OUT, file), clip: { x: 0, y: top, width, height: Math.min(total - top, maxHeight) }, fullPage: true });
  console.log('  captured', file);
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const strip = (s: string) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\r\n/g, '\n');

/** Render command output as a terminal-style image. */
async function terminal(browser: Browser, file: string, command: string, text: string) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 600 }, deviceScaleFactor: 1.25 });
  await page.setContent(`<body style="margin:0;background:#0f172a"><div id="t" style="padding:16px 20px;width:1060px;font:12.5px/1.45 Menlo,Monaco,monospace;color:#e2e8f0">
    <div style="color:#7dd3fc;margin-bottom:8px">$ ${esc(command)}</div><pre style="margin:0;white-space:pre-wrap;word-break:break-word">${esc(text)}</pre></div></body>`);
  await (await page.$('#t'))!.screenshot({ path: path.join(OUT, file) });
  console.log('  captured', file);
  await page.close();
}

/** Progress bars redraw one line with \r; keep a handful of frames plus the last so the image shows it advancing. */
function frames(raw: string): string {
  const lines = strip(raw).split(/[\r\n]+/).map((l) => l.trimEnd()).filter(Boolean);
  const out: string[] = [];
  let bar = 0;
  for (const l of lines) {
    if (/\[[█░▓▒=\- ]+\]/.test(l)) { if (bar++ % 6 === 0) out.push(l); else if (out.at(-1) !== l) out[out.length - 1] = out.at(-1)!.startsWith(l.slice(0, 8)) ? l : out.at(-1)!; }
    else out.push(l);
  }
  return out.join('\n');
}

// no real terminal here: FORCE_PROGRESS makes the scripts print each progress-bar update on its own line
// (progress bars write to stderr, so merge it into the captured text)
const tty = (args: string[]) => frames(execSync(`${args.join(' ')} 2>&1`, { cwd: ROOT, encoding: 'utf8', env: { ...process.env, FORCE_PROGRESS: '1', FORCE_COLOR: '0' }, maxBuffer: 20_000_000 }));

async function pages(browser: Browser) {
  console.log('Pages');
  const admin = await openAs(browser, 'admin');
  const ids: Record<string, number> = {};
  for (const p of (await (await fetch(`${BASE}/api/proposals`, { headers: { Cookie: `pp_session=${await sessionCookie(email.admin)}` } })).json()).proposals) ids[p.title.split(':')[0]] = p.project_id;
  const { CampusConnect: alpha, LibrarySeat: bravo, ClinicQueue: charlie, AgriAdvisor: delta, 'CollegeEvents Hub': echo, FestFlow: fox } = ids;

  const anon = await openAs(browser, null); await anon.goto(`${BASE}/login`); await shot(anon, 'S-01-login.png', 700);
  let p = await openAs(browser, 's4'); await p.goto(`${BASE}/dashboard`); await shot(p, 'S-02-student-dashboard.png', 1000);
  p = await openAs(browser, 'guide2'); await p.goto(`${BASE}/dashboard`); await shot(p, 'S-03-guide-dashboard.png', 1500);
  await admin.goto(`${BASE}/dashboard`); await shot(admin, 'S-04-admin-dashboard.png', 900);
  p = await openAs(browser, 's13'); await p.goto(`${BASE}/proposals/${fox}`); await shot(p, 'S-05-proposal-form.png', 1500);
  p = await openAs(browser, 'guide1'); await p.goto(`${BASE}/proposals/${echo}`); await shot(p, 'S-06-proposal-approval-history.png', 900);
  await admin.goto(`${BASE}/admin/allocations`); await shot(admin, 'S-07-guide-allocation.png', 900);
  p = await openAs(browser, 's1'); await p.goto(`${BASE}/teams/1`); await shot(p, 'S-07b-team.png', 700);
  await p.goto(`${BASE}/projects/${alpha}/milestones`); await shot(p, 'S-08-milestone-timeline.png', 1100);
  const wide = await openAs(browser, 's1', 1500); await wide.goto(`${BASE}/projects/${alpha}/tasks`); await shot(wide, 'S-09-task-kanban.png', 1000);
  await p.goto(`${BASE}/projects/${alpha}/deliverables`); await shot(p, 'S-10-deliverables-versions.png', 1250, 'h2:has-text("3. Design")');

  // S-11: a failing submission shows the rollback message and saves nothing
  await p.goto(`${BASE}/projects/${alpha}/deliverables`);
  await p.getByLabel('Attach one more deliverable in this submission').check();
  await p.locator('input[name=title]').last().fill('Rollback demonstration');
  await p.locator('input[name=changeSummary]').last().fill('Submitted without a file on purpose');
  await p.getByRole('button', { name: 'Submit for review' }).click();
  await p.getByText('nothing was changed').waitFor({ timeout: 30000 });
  await shot(p, 'S-11-submission-rollback.png', 900, 'h3:has-text("Submit this milestone")');

  p = await openAs(browser, 'guide2'); await p.goto(`${BASE}/projects/${delta}/feedback`);
  await p.getByRole('button', { name: 'Discussion' }).nth(1).click(); await p.waitForTimeout(800);
  await shot(p, 'S-12-feedback-thread.png', 1100, 'h2:has-text("Feedback items")');
  p = await openAs(browser, 'guide1'); await p.goto(`${BASE}/projects/${charlie}/contribution`); await shot(p, 'S-13-contribution.png', 1300);
  p = await openAs(browser, 'guide2'); await p.goto(`${BASE}/projects/${bravo}/risk`); await shot(p, 'S-14-risk-detail.png', 1500);
  p = await openAs(browser, 'guide1'); await p.goto(`${BASE}/similarity`); await shot(p, 'S-15-similarity-review.png', 1500);
  await admin.goto(`${BASE}/reports?report=delayed-teams`); await shot(admin, 'S-16-reports.png', 800);
  await admin.goto(`${BASE}/reports?report=high-risk&level=moderate`); await shot(admin, 'S-16b-reports-high-risk.png', 900);
  await admin.goto(`${BASE}/admin/audit?entity=projects`); await shot(admin, 'S-17-audit-log.png', 1000);
  await admin.goto(`${BASE}/admin/users`); await shot(admin, 'S-23-admin-users.png', 1000);
  await admin.goto(`${BASE}/admin/templates`); await shot(admin, 'S-24-admin-templates.png', 1100);
  await p.goto(`${BASE}/insights`); await shot(p, 'S-25-insights.png', 700);
}

async function terminals(browser: Browser) {
  console.log('Terminal images');
  await terminal(browser, 'S-18-migrations-progress.png', 'npm run db:reset', tty(['npm', 'run', 'db:reset']));
  await terminal(browser, 'S-18b-seed-progress.png', 'npm run db:seed', tty(['npm', 'run', 'db:seed']).split('\n').filter((l) => !/projectpulse\.test|^  /.test(l)).join('\n'));

  const psql = execSync(`psql -d projectpulse -X -P pager=off -f - 2>&1`, { cwd: ROOT, encoding: 'utf8', input: `
\\set ON_ERROR_STOP off
SET search_path = projectpulse, public;
\\echo '== Function: delivery risk for Bravo, calculated inside the database'
SELECT risk_score, risk_level, breakdown FROM fn_calculate_project_risk(2);
\\echo
\\echo '== View: faculty risk dashboard (what the guide sees)'
SELECT team_name, progress_pct, overdue_tasks, missing_evidence AS missing_docs, unresolved_feedback AS open_fb, risk_score, risk_level FROM v_faculty_risk_dashboard ORDER BY risk_score DESC;
\\echo
\\echo '== Trigger 1: a milestone cannot be approved while mandatory deliverables are missing'
BEGIN;
UPDATE milestones SET status = 'approved', approved_by = 2, approved_at = now() WHERE project_id = 1 AND sequence_no = 4;
ROLLBACK;
\\echo
\\echo '== Trigger 2: an illegal workflow jump (task todo -> verified) is refused by the transition table'
BEGIN;
UPDATE tasks SET status = 'verified', verified_by = 2, verified_at = now() WHERE task_id = (SELECT MIN(task_id) FROM tasks WHERE status = 'todo');
ROLLBACK;
\\echo
\\echo '== Trigger: audit rows are append-only'
UPDATE audit_logs SET action = 'tampered' WHERE log_id = (SELECT MIN(log_id) FROM audit_logs);
\\echo
\\echo '== Audit rows written by triggers (action by entity)'
SELECT action, entity_type, COUNT(*) FROM audit_logs GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 5;
` });
  await terminal(browser, 'S-19-sql-features.png', 'psql -d projectpulse   (function, view, trigger)', strip(psql).replace(/^SET\n/m, ''));

  const mongo = await new MongoClient(requireEnv('MONGODB_URI')).connect();
  try {
    const db = mongo.db(process.env.MONGODB_DB ?? 'projectpulse'); const docs = db.collection('documents');
    const alpha = 1, delta = 4;
    const j = (v: unknown) => JSON.stringify(v, null, 2);
    const a1 = await docs.aggregate(pipelines.versionCounts(alpha) as any).project({ _id: 0 }).toArray();
    const a2 = await docs.aggregate(pipelines.typeDistribution([1, 2, 3, 4]) as any).toArray();
    const a4 = await db.collection('feedback_threads').aggregate(pipelines.feedbackThemes([delta]) as any).toArray();
    let rejected = 'accepted?!';
    try { await docs.insertOne({ projectId: 1, milestoneId: 1, documentType: 'Poster', title: 'x', versions: [], tags: [] }); } catch (e) { rejected = `rejected by the $jsonSchema validator (code ${(e as { code?: number }).code}): ${(e as Error).message}`; }
    await terminal(browser, 'S-20-mongo-aggregation.png', 'MongoDB aggregations (db/mongo/aggregations.ts)',
      `// A1  version counts per document, project 1\n${j(a1)}\n\n// A2  document-type distribution (projects 1-4)\n${j(a2)}\n\n// A4  open feedback themes, project 4\n${j(a4)}\n\n// validator: insert { documentType: 'Poster', versions: [] }\n${rejected}`);
  } finally { await mongo.close(); }

  const t = strip(execSync('npx vitest run db/tests tests/unit 2>&1 | tail -22', { cwd: ROOT, encoding: 'utf8' }));
  await terminal(browser, 'S-21-test-results.png', 'npm test   (database + unit tests)', t);
}

async function gitShot(browser: Browser) {
  console.log('Git');
  const log = execSync('git --no-pager shortlog -sne --all && echo && git --no-pager log --oneline --stat --max-count=4 | head -40', { cwd: ROOT, encoding: 'utf8' });
  await terminal(browser, 'S-22-git-history.png', 'git shortlog -sn --all; git log --stat', log);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  try {
    if (!only || only === 'terminal') await terminals(browser);
    if (!only || only === 'pages') await pages(browser);
    if (only === 'git') await gitShot(browser);
  } finally { await browser.close(); }
}

main().catch((e) => { console.error(e); process.exit(1); });
