import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { adminDatabaseUrl } from './lib/env';

/**
 * Generates docs/data_dictionary.md, docs/er_diagram.mmd (every attribute) and docs/er_overview.mmd (keys only)
 * directly from the live PostgreSQL catalogue, so the documentation can never drift from the real schema.
 */
const TABLE_INFO: Record<string, string> = {
  departments: 'Academic departments.', courses: 'Project courses per semester and academic year.',
  users: 'Login identity, account status and lockout state. Passwords exist only as bcrypt hashes.',
  roles: 'The four roles: student, faculty_guide, reviewer, admin.', user_roles: 'Many-to-many link between users and roles.',
  teams: 'Student teams, one set per course.', team_members: 'Student membership with a leader flag and responsibility; one team per student per course.',
  project_templates: 'Reusable project plans managed by admins.', template_milestones: 'Milestones of a template (offset from project start, weightage, mandatory deliverable types).',
  projects: 'A team\'s proposal and project: text, status workflow, dates. One active project per team.',
  proposal_actions: 'Append-only history of proposal decisions (submit, approve, reject, request revision).',
  guide_allocations: 'Which faculty guide (one) and reviewers are allocated to a project.',
  milestones: 'Dated, weighted milestones of a project with a status workflow.', milestone_required_deliverables: 'Deliverable types that must exist before a milestone can be approved.',
  tasks: 'Work items under a milestone with planned and actual dates and a todo-to-verified workflow.', task_assignments: 'Task owner (exactly one) and collaborators.',
  deliverables: 'Submission metadata (type, links, status) linked to a MongoDB document.', document_versions: 'Every uploaded or linked version of a deliverable, with checksum and size.',
  reviews: 'A guide\'s or reviewer\'s evaluation of a milestone.', review_scores: 'Rubric criteria and scores of a review.',
  feedback_items: 'Trackable feedback assigned to one student: open, in progress, resolved, verified, reopened.',
  git_activities: 'Manually recorded commit references.', contribution_evidence: 'Verifiable per-student evidence (tasks, uploads, feedback fixes, commits). Only verified rows count.',
  risk_assessments: 'Historical delivery-risk snapshots with score, level, reasons and per-factor breakdown.', risk_events: 'Flags raised for overdue milestones and similar events.',
  similarity_reviews: 'Pairs of proposals flagged as possibly overlapping, with the faculty decision.', project_embeddings: 'pgvector table: 384-dimensional sentence embeddings of proposal sections.',
  peer_evaluations: 'Controlled teammate ratings, one per pair per milestone.', audit_logs: 'Append-only log of important actions written by triggers and the API.',
  status_transitions: 'Data-driven workflow: which status changes are legal for each entity type.', notifications: 'In-app notifications (reserved; not used in version 1).',
  schema_migrations: 'Which migration files have been applied.',
};

const short = (t: string) => t.replace('character varying', 'varchar').replace('timestamp with time zone', 'timestamptz').replace('timestamp without time zone', 'timestamp');
const mermaidType = (t: string) => short(t).replace(/\(.*?\)/g, '').replace(/\[\]/g, '_array').replace(/\s+/g, '_');

async function main() {
  const db = new Client({ connectionString: adminDatabaseUrl() });
  await db.connect();
  try {
    const cols = (await db.query(`
      SELECT c.relname AS tbl, a.attname AS col, a.attnum, format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull AS notnull,
             pg_get_expr(d.adbin, d.adrelid) AS def, a.attidentity AS ident
        FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
       WHERE n.nspname = 'projectpulse' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped ORDER BY c.relname, a.attnum`)).rows;
    const cons = (await db.query(`
      SELECT c.relname AS tbl, con.contype, con.conname, pg_get_constraintdef(con.oid) AS def,
             ARRAY(SELECT a.attname::text FROM unnest(con.conkey) k JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k) AS cols,
             fc.relname AS ref_tbl, ARRAY(SELECT a.attname::text FROM unnest(con.confkey) k JOIN pg_attribute a ON a.attrelid = con.confrelid AND a.attnum = k) AS ref_cols,
             con.confdeltype AS del
        FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace LEFT JOIN pg_class fc ON fc.oid = con.confrelid
       WHERE n.nspname = 'projectpulse' AND con.contype IN ('p','f','u','c') ORDER BY c.relname, con.contype, con.conname`)).rows;
    const idx = (await db.query(`SELECT tablename AS tbl, indexname, indexdef FROM pg_indexes WHERE schemaname = 'projectpulse' ORDER BY tablename, indexname`)).rows;
    const trg = (await db.query(`
      SELECT c.relname AS tbl, t.tgname, pg_get_triggerdef(t.oid) AS def FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'projectpulse' AND NOT t.tgisinternal ORDER BY c.relname, t.tgname`)).rows;
    const views = (await db.query(`SELECT viewname FROM pg_views WHERE schemaname = 'projectpulse' ORDER BY viewname`)).rows.map((r) => r.viewname);
    const fns = (await db.query(`SELECT p.proname, CASE p.prokind WHEN 'p' THEN 'procedure' ELSE 'function' END AS kind, pg_get_function_identity_arguments(p.oid) AS args
                                   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'projectpulse' ORDER BY p.proname`)).rows;

    const tables = [...new Set(cols.map((c) => c.tbl))];
    const DEL: Record<string, string> = { a: 'NO ACTION', r: 'RESTRICT', c: 'CASCADE', n: 'SET NULL', d: 'SET DEFAULT' };

    // ---- data dictionary ------------------------------------------------------------------------------
    let md = `# Data dictionary\n\n_Generated by \`npm run docs:data-dictionary\` from the live PostgreSQL catalogue (schema \`projectpulse\`): ${tables.length} tables, ${views.length} views, ${fns.length} functions and procedures, ${trg.length} triggers._\n\n`;
    md += `Legend: **PK** primary key · **FK** foreign key (with its ON DELETE rule) · **UQ** unique · **CHECK** validation rule enforced by the database.\n\n`;
    for (const t of tables) {
      md += `## ${t}\n\n${TABLE_INFO[t] ?? ''}\n\n| Column | Type | Null | Default | Constraints and notes |\n|---|---|---|---|---|\n`;
      for (const c of cols.filter((x) => x.tbl === t)) {
        const notes: string[] = [];
        for (const k of cons.filter((x) => x.tbl === t && x.cols.includes(c.col))) {
          if (k.contype === 'p') notes.push('**PK**');
          else if (k.contype === 'f') notes.push(`**FK** → ${k.ref_tbl}(${k.ref_cols.join(', ')}) ON DELETE ${DEL[k.del]}`);
          else if (k.contype === 'u') notes.push(k.cols.length > 1 ? `**UQ** with (${k.cols.join(', ')})` : '**UQ**');
          else if (k.contype === 'c' && k.cols.length === 1) notes.push(`CHECK ${k.def.replace(/^CHECK /, '')}`);
        }
        if (c.ident === 'a') notes.push('identity (auto-generated)');
        md += `| ${c.col} | ${short(c.type)} | ${c.notnull ? 'NO' : 'yes'} | ${c.def && c.ident === '' ? `\`${c.def.replace(/\|/g, '\\|')}\`` : ''} | ${notes.join('<br>').replace(/\|/g, '\\|')} |\n`;
      }
      const table_checks = cons.filter((x) => x.tbl === t && x.contype === 'c' && x.cols.length !== 1);
      if (table_checks.length) md += `\n**Table-level rules:**\n${table_checks.map((k) => `- \`${k.def.replace(/\s+/g, ' ')}\``).join('\n')}\n`;
      const ix = idx.filter((x) => x.tbl === t && !cons.some((k) => k.conname === x.indexname));
      if (ix.length) md += `\n**Indexes:**\n${ix.map((x) => `- \`${x.indexdef.replace('CREATE ', '').replace(/ ON projectpulse\./, ' ON ')}\``).join('\n')}\n`;
      const tr = trg.filter((x) => x.tbl === t);
      if (tr.length) md += `\n**Triggers:** ${tr.map((x) => `\`${x.tgname}\``).join(', ')}\n`;
      md += '\n';
    }
    md += `## Views\n\n${views.map((v) => `- \`${v}\``).join('\n')}\n\n## Functions and procedures\n\n${fns.map((f) => `- ${f.kind} \`${f.proname}(${f.args})\``).join('\n')}\n`;
    fs.writeFileSync(path.resolve(__dirname, '../docs/data_dictionary.md'), md);

    // ---- relational schema (compact notation) ------------------------------------------------------
    const isPk = (t: string, c: string) => cons.some((k) => k.tbl === t && k.contype === 'p' && k.cols.includes(c));
    let rs = `# Relational schema\n\n_Generated from the live catalogue. Notation: <u>underlined</u> = primary key, *italic* = foreign key (arrow gives the referenced table). Unique keys and CHECK rules are in the data dictionary._\n\n`;
    for (const t of tables.filter((x) => x !== 'schema_migrations')) {
      const parts = cols.filter((c) => c.tbl === t).map((c) => {
        const fk = cons.find((k) => k.tbl === t && k.contype === 'f' && k.cols.includes(c.col));
        let txt = c.col;
        if (isPk(t, c.col)) txt = `<u>${txt}</u>`;
        if (fk) txt = `*${txt}*`;
        return fk ? `${txt}→${fk.ref_tbl}` : txt;
      });
      rs += `**${t}** (${parts.join(', ')})\n\n`;
    }
    fs.writeFileSync(path.resolve(__dirname, '../docs/relational_schema.md'), rs);

    // ---- ER diagrams ----------------------------------------------------------------------------------
    const pkOf = (t: string, c: string) => cons.some((k) => k.tbl === t && k.contype === 'p' && k.cols.includes(c));
    const fkOf = (t: string, c: string) => cons.some((k) => k.tbl === t && k.contype === 'f' && k.cols.includes(c));
    const uqOf = (t: string, c: string) => cons.some((k) => k.tbl === t && k.contype === 'u' && k.cols.length === 1 && k.cols[0] === c);
    const rels = cons.filter((k) => k.contype === 'f').map((k) => {
      const nullable = k.cols.some((c: string) => !cols.find((x) => x.tbl === k.tbl && x.col === c)!.notnull);
      return `    ${k.ref_tbl} ${nullable ? '|o' : '||'}--o{ ${k.tbl} : "${k.cols.join('+')}"`;
    });
    const entity = (t: string, keysOnly: boolean) => {
      const rows = cols.filter((c) => c.tbl === t && (!keysOnly || pkOf(t, c.col) || fkOf(t, c.col)));
      return `    ${t} {\n${rows.map((c) => `        ${mermaidType(c.type)} ${c.col}${[pkOf(t, c.col) ? 'PK' : '', fkOf(t, c.col) ? 'FK' : '', uqOf(t, c.col) ? 'UK' : ''].filter(Boolean).length ? ' ' + [pkOf(t, c.col) ? 'PK' : '', fkOf(t, c.col) ? 'FK' : '', uqOf(t, c.col) ? 'UK' : ''].filter(Boolean).join(',') : ''}`).join('\n')}\n    }`;
    };
    const shown = tables.filter((t) => t !== 'schema_migrations');
    fs.writeFileSync(path.resolve(__dirname, '../docs/er_diagram.mmd'), `erDiagram\n${rels.join('\n')}\n${shown.map((t) => entity(t, false)).join('\n')}\n`);
    fs.writeFileSync(path.resolve(__dirname, '../docs/er_overview.mmd'), `erDiagram\n${rels.join('\n')}\n${shown.map((t) => entity(t, true)).join('\n')}\n`);
    console.log(`Wrote docs/data_dictionary.md (${tables.length} tables), docs/er_diagram.mmd and docs/er_overview.mmd (${rels.length} relationships).`);
  } finally {
    await db.end();
  }
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
