import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { Client } from 'pg';
import { MongoClient } from 'mongodb';
import { marked } from 'marked';
import { chromium } from 'playwright-core';
import { adminDatabaseUrl, requireEnv } from './lib/env';
import { pipelines } from '../db/mongo/aggregations';

/**
 * docs/REPORT.md  ->  docs/report.html  ->  report.pdf (repository root).
 * Besides Markdown, REPORT.md may contain directives that are replaced with REAL data when the report is built, so the
 * sample outputs in the report are never typed by hand:
 *   <!--include:file|from-regex|to-regex-->   a code excerpt      <!--query:Q2-->   an important query and its output
 *   <!--mongo:A1-->  a pipeline and its output   <!--vector-->  the similarity result   <!--file:docs/x.md-->  another file
 *   {{tables}} {{views}} ...  numbers read from the live catalogue
 */
const ROOT = path.resolve(__dirname, '..');
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const fence = (lang: string, body: string) => `\n\`\`\`${lang}\n${body.replace(/\s+$/, '')}\n\`\`\`\n`;
const LANG: Record<string, string> = { '.sql': 'sql', '.ts': 'ts', '.tsx': 'tsx', '.json': 'json', '.md': 'md' };

function excerpt(file: string, from: string, to?: string): string {
  const lines = read(file).split('\n');
  const start = lines.findIndex((l) => new RegExp(from).test(l));
  if (start < 0) throw new Error(`excerpt: "${from}" not found in ${file}`);
  let end = start;
  if (to) { end = lines.findIndex((l, i) => i >= start && new RegExp(to).test(l)); if (end < 0) throw new Error(`excerpt: "${to}" not found after "${from}" in ${file}`); }
  return fence(LANG[path.extname(file)] ?? '', lines.slice(start, end + 1).join('\n'));
}

function table(rows: Record<string, unknown>[], max = 6): string {
  if (rows.length === 0) return '\n_(no rows)_\n';
  const cols = Object.keys(rows[0]);
  const cell = (v: unknown) => (v === null || v === undefined ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === 'object' ? JSON.stringify(v) : String(v)).replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 90);
  const shown = rows.slice(0, max);
  return `\n| ${cols.join(' | ')} |\n|${cols.map(() => '---').join('|')}|\n${shown.map((r) => `| ${cols.map((c) => cell(r[c])).join(' | ')} |`).join('\n')}\n${rows.length > max ? `\n_${rows.length - max} more row(s) not shown._\n` : ''}`;
}

async function main() {
  const db = new Client({ connectionString: adminDatabaseUrl() });
  await db.connect();
  await db.query('SET search_path = projectpulse, public');
  const one = async (sql: string) => (await db.query(sql)).rows[0];
  const stat = {
    tables: (await one(`SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema='projectpulse' AND table_type='BASE TABLE'`)).n,
    views: (await one(`SELECT COUNT(*) AS n FROM information_schema.views WHERE table_schema='projectpulse'`)).n,
    functions: (await one(`SELECT COUNT(*) AS n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='projectpulse'`)).n,
    triggers: (await one(`SELECT COUNT(DISTINCT trigger_name) AS n FROM information_schema.triggers WHERE trigger_schema='projectpulse'`)).n,
    indexes: (await one(`SELECT COUNT(*) AS n FROM pg_indexes WHERE schemaname='projectpulse'`)).n,
    relationships: (await one(`SELECT COUNT(*) AS n FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='projectpulse' AND c.contype='f'`)).n,
    migrations: (await one(`SELECT COUNT(*) AS n FROM schema_migrations`)).n,
    date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  } as Record<string, unknown>;
  const tr = read('docs/TEST_RESULTS.md').match(/\*\*(\d+) of (\d+) tests passed\*\*/);
  stat.tests = tr ? tr[2] : '0'; stat.testsPassed = tr ? tr[1] : '0';

  // ---- parameters for the important queries -------------------------------------------------------------
  const guide2 = (await one(`SELECT user_id AS v FROM users WHERE email='guide2@projectpulse.test'`)).v;
  const bravo = (await one(`SELECT project_id AS v FROM projects WHERE title LIKE 'LibrarySeat%'`)).v;
  const echo = await one(`SELECT project_id, course_id FROM projects WHERE title LIKE 'CollegeEvents%'`);
  const vec = (await one(`SELECT embedding::text AS v FROM project_embeddings WHERE project_id=${echo.project_id} AND section_type='abstract' LIMIT 1`)).v;
  const params: Record<string, unknown[]> = { Q1: [guide2], Q2: [0], Q3: [bravo], Q4a: [bravo], Q6: [vec, echo.course_id, echo.project_id, 3], Q8: [bravo], Q12: ['event'] };
  const blocks = new Map<string, { sql: string; head: string }>();
  for (const part of read('db/queries/important_queries.sql').split(/\n(?=-- Q\d+[ab]? )/).slice(1)) {
    const m = part.match(/^-- (Q\d+[ab]?) (.*)$/m)!;
    blocks.set(m[1], { head: m[2], sql: part.split('\n').filter((l) => !l.startsWith('-- Q') ).join('\n').trim() });
  }

  const mongo = await new MongoClient(requireEnv('MONGODB_URI')).connect();
  const mdb = mongo.db(process.env.MONGODB_DB ?? 'projectpulse');
  const pipes: Record<string, [string, string, object[]]> = {
    A1: ['documents', 'Version counts per document (project 1)', pipelines.versionCounts(1)],
    A2: ['documents', 'Document-type distribution (projects 1-4)', pipelines.typeDistribution([1, 2, 3, 4])],
    A3: ['documents', 'Which required (milestone, type) pairs exist: Mongo half of the completeness merge (project 4)', pipelines.typesPresent((await db.query(`SELECT d.deliverable_id FROM deliverables d JOIN milestones m USING (milestone_id) WHERE m.project_id=4 AND d.status IN ('submitted','accepted') AND m.due_date <= CURRENT_DATE + 7`)).rows.map((r) => r.deliverable_id))],
    A4: ['feedback_threads', 'Open feedback themes (project 4)', pipelines.feedbackThemes([4])],
    A5: ['documents', 'Most used tags (projects 1-4)', pipelines.tagCounts([1, 2, 3, 4])],
  };

  const section = async (kind: string, arg: string): Promise<string> => {
    const [a, b, c] = arg.split('|');
    if (kind === 'include') return excerpt(a, b, c);
    if (kind === 'file') return read(a).replace(/^# .*\n/, '').replace(/^(#{2,5}) /gm, (_m, h) => `${h}# `);
    if (kind === 'query') {
      const q = blocks.get(a)!;
      const rows = (await db.query(q.sql.replace(/;\s*$/, ''), params[a] ?? [])).rows;
      return `${fence('sql', q.sql)}\n**Output on the demo data**${table(rows)}`;
    }
    if (kind === 'mongo') {
      const [coll, title, pipeline] = pipes[a];
      const out = await mdb.collection(coll).aggregate([...pipeline] as any).project({ extractedText: 0 }).toArray();
      return `\n**${a}: ${title}**${fence('js', `db.${coll}.aggregate(${JSON.stringify(pipeline, null, 2)})`)}**Output**${fence('json', JSON.stringify(out.slice(0, 6), null, 2))}`;
    }
    if (kind === 'mongodoc') {
      const doc = await mdb.collection('documents').findOne({ projectId: 1, documentType: 'SRS' }, { projection: { extractedText: 0, _id: 0 } });
      return fence('json', JSON.stringify(doc, null, 2));
    }
    if (kind === 'vector') {
      const pair = (await db.query(`SELECT sr.similarity_id, sr.source_project_id, sr.matched_project_id, sr.similarity_score, sr.matched_section, sp.title AS source, mp.title AS matched, sr.faculty_decision
                                      FROM similarity_reviews sr JOIN projects sp ON sp.project_id=sr.source_project_id JOIN projects mp ON mp.project_id=sr.matched_project_id ORDER BY sr.similarity_score DESC LIMIT 1`)).rows[0];
      const secs = (await db.query(`SELECT DISTINCT ON (a.section_type) a.section_type AS section, ROUND((1 - (a.embedding <=> b.embedding))::numeric, 3) AS cosine_similarity
                                      FROM project_embeddings a JOIN project_embeddings b ON b.project_id=$2 AND b.section_type=a.section_type AND b.model_name=a.model_name
                                     WHERE a.project_id=$1 AND a.section_type <> 'document_chunk' ORDER BY a.section_type, a.embedding <=> b.embedding`, [pair.source_project_id, pair.matched_project_id])).rows;
      const other = (await db.query(`SELECT p.title, ROUND(AVG(1 - (a.embedding <=> b.embedding))::numeric, 3) AS mean_section_similarity
                                       FROM project_embeddings a JOIN project_embeddings b ON b.section_type=a.section_type AND b.project_id <> a.project_id AND b.course_id = a.course_id
                                       JOIN projects p ON p.project_id=b.project_id WHERE a.project_id=$1 AND a.section_type <> 'document_chunk' AND b.is_current GROUP BY p.title ORDER BY 2 DESC`, [pair.source_project_id])).rows;
      return `\n**Flagged pair stored for faculty review** (table \`similarity_reviews\`):${table([pair], 1)}\n**Section-by-section cosine similarity** (Echo against Alpha):${table(secs)}\n**Echo against every other proposal in its course** (mean of the section similarities; only the first pair crosses the review threshold):${table(other)}`;
    }
    if (kind === 'erdomains') return read('docs/er_domains.md').replace(/^# .*\n/, '').replace(/^_Generated.*\n/m, '').replace(/^## /gm, '#### ');
    if (kind === 'git') return fence('', execSync('git --no-pager shortlog -sne --all 2>/dev/null || true', { cwd: ROOT, encoding: 'utf8' }) || '(no commits yet)');
    if (kind === 'tablesummary') {
      const md = read('docs/data_dictionary.md');
      const rows = [...md.matchAll(/^## (\w+)\n\n(.*)\n\n\| Column[\s\S]*?\n\n/gm)].map((m) => ({ table: m[1], purpose: m[2] }));
      const cnt = (await db.query(`SELECT table_name AS t, COUNT(*)::int AS c FROM information_schema.columns WHERE table_schema='projectpulse' GROUP BY 1`)).rows;
      return `\n| Table | Columns | Purpose |\n|---|---|---|\n${rows.map((r) => `| ${r.table} | ${cnt.find((c) => c.t === r.table)?.c ?? ''} | ${r.purpose} |`).join('\n')}\n`;
    }
    if (kind === 'testresults') {
      return read('docs/TEST_RESULTS.md').replace(/^# .*\n/, '').replace(/^_Generated.*\n/m, '').replace(/^(#{2,5}) /gm, (_m, h) => `${h}# `);
    }
    if (kind === 'explain') return read('docs/EXPLAIN_ANALYZE.md').split('## 1.')[0].replace(/^# .*\n/, '').replace(/^_Generated.*\n/m, '');
    throw new Error(`unknown directive ${kind}`);
  };

  let md = read('docs/REPORT.md');
  for (const [k, v] of Object.entries(stat)) md = md.replaceAll(`{{${k}}}`, String(v));
  const parts = md.split(/(<!--\w+:?[^>]*-->)/);
  let built = '';
  for (const p of parts) {
    const m = p.match(/^<!--(\w+):?([^>]*)-->$/);
    built += m ? await section(m[1], m[2]) : p;
  }
  await db.end(); await mongo.close();

  // ---- HTML -----------------------------------------------------------------------------------------------
  const renderer = new marked.Renderer();
  const origCode = renderer.code.bind(renderer);
  renderer.code = (token) => (token.lang === 'mermaid' ? `<pre class="mermaid">${token.text}</pre>` : origCode(token));
  const BREAK = /^(5\.|9\.|10\.|11\.|12\.|14\.|15\.|Appendix)/;   // only the big sections start a new page
  const body = (await marked.parse(built, { gfm: true, renderer })).replace(/<h1>([^<]+)<\/h1>/g, (m, t) => (BREAK.test(t) ? `<h1 class="brk">${t}</h1>` : m));
  const css = fs.readFileSync(path.join(ROOT, 'docs/report.css'), 'utf8');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>ProjectPulse report</title><style>${css}</style></head><body>${body}
<script src="file://${ROOT}/node_modules/mermaid/dist/mermaid.min.js"></script>
<script>window.__mermaidDone = (async () => { mermaid.initialize({ startOnLoad: false, theme: 'neutral', maxTextSize: 400000, er: { useMaxWidth: true, layoutDirection: 'TB', minEntityWidth: 110, entityPadding: 6, fontSize: 12 }, flowchart: { useMaxWidth: false, htmlLabels: true } }); await mermaid.run({ querySelector: '.mermaid' }); return true; })().catch((e) => { document.title = 'mermaid error: ' + e.message; return false; });</script>
</body></html>`;
  const htmlPath = path.join(ROOT, 'docs/report.html');
  fs.writeFileSync(htmlPath, html);

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`file://${htmlPath}`, { waitUntil: 'load' });
    const ok = await page.evaluate(() => (window as any).__mermaidDone);
    if (!ok) throw new Error(`mermaid failed: ${await page.title()}`);
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({
      path: path.join(ROOT, 'report.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true,
      displayHeaderFooter: true, margin: { top: '18mm', bottom: '16mm', left: '16mm', right: '16mm' },
      headerTemplate: '<div></div>', footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#64748b">ProjectPulse &middot; page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
    });
  } finally { await browser.close(); }
  const size = (fs.statSync(path.join(ROOT, 'report.pdf')).size / 1024 / 1024).toFixed(1);
  console.log(`Wrote report.pdf (${size} MB) from docs/REPORT.md`);
}

main().catch((e) => { console.error(e); process.exit(1); });
