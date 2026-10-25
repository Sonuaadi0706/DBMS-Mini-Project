import fs from 'node:fs';
import path from 'node:path';
import { MongoClient, ObjectId } from 'mongodb';
import type { Client } from 'pg';
import { initCollections, COLLECTIONS } from '../mongo/collections';

const TYPE_MAP: Record<string, string> = {
  proposal: 'Proposal', srs: 'SRS', design_doc: 'Design', source_code: 'Other', screenshot: 'Other',
  test_report: 'TestReport', presentation: 'Presentation', final_report: 'Report', other: 'Other',
};

const themeOf = (text: string): string => {
  const t = text.toLowerCase();
  if (/test|scenario/.test(t)) return 'testing';
  if (/index|schema|column|table|view|data model|refresh|dictionary/.test(t)) return 'design';
  if (/requirement|rules?|clarify|define|escalation/.test(t)) return 'requirements';
  if (/document|section|appendix/.test(t)) return 'documentation';
  return 'other';
};

/**
 * Populates MongoDB from the seeded PostgreSQL data: one document per deliverable (versions copied from
 * document_versions), one discussion thread per feedback item, and a few guide meeting notes.
 * Safe to re-run: it empties the four collections first.
 */
export async function seedMongo(pg: Client, uri: string, dbName: string, step: (l: string) => void = () => undefined) {
  const client = await new MongoClient(uri, { serverSelectionTimeoutMS: 4000 }).connect();
  try {
    const db = client.db(dbName);
    await initCollections(db);
    for (const name of Object.keys(COLLECTIONS)) await db.collection(name).deleteMany({});

    step('Mongo documents');
    const { rows: dels } = await pg.query(
      `SELECT d.deliverable_id, d.milestone_id, d.deliverable_type, d.title, d.mongo_doc_id, m.project_id,
              p.problem_statement, p.objectives, p.scope, p.domain, p.technologies
         FROM deliverables d JOIN milestones m USING (milestone_id) JOIN projects p ON p.project_id = m.project_id
        ORDER BY d.deliverable_id`);
    for (const d of dels) {
      const { rows: vs } = await pg.query(
        `SELECT version_number, uploaded_by, uploaded_at, change_summary, file_url, file_name, file_size_bytes
           FROM document_versions WHERE deliverable_id = $1 ORDER BY version_number`, [d.deliverable_id]);
      if (vs.length === 0) continue;
      const lastKey = vs[vs.length - 1].file_url as string;
      const file = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_PATH ?? './storage/uploads', lastKey);
      const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      await db.collection('documents').insertOne({
        _id: new ObjectId(d.mongo_doc_id), projectId: d.project_id, milestoneId: d.milestone_id, deliverableId: d.deliverable_id,
        documentType: TYPE_MAP[d.deliverable_type] ?? 'Other', deliverableType: d.deliverable_type, title: d.title,
        versions: vs.map((v) => ({
          versionNumber: v.version_number, uploadedBy: v.uploaded_by, uploadedAt: v.uploaded_at, changeSummary: v.change_summary,
          fileUrl: v.file_url, fileName: v.file_name, sizeBytes: v.file_size_bytes == null ? null : Number(v.file_size_bytes),
        })),
        // Free-form on purpose: an SRS carries requirement sections, other documents carry different keys.
        sections: d.deliverable_type === 'srs'
          ? { problemStatement: d.problem_statement, objectives: String(d.objectives ?? '').split(/\s*\d\.\s*/).filter(Boolean), scope: d.scope }
          : d.deliverable_type === 'test_report' ? { totalCases: 0, passed: 0 } : {},
        tags: [d.domain, ...(d.technologies ?? [])].filter(Boolean),
        extractedText: text, wordCount: text.split(/\s+/).filter(Boolean).length, state: 'confirmed', createdAt: vs[0].uploaded_at,
      });
    }

    step('Mongo threads');
    const { rows: fbs } = await pg.query(
      `SELECT f.feedback_id, f.description, f.resolution_status, f.response_text, f.created_by, f.assigned_user_id, f.created_at, f.resolved_at,
              m.milestone_id, m.project_id
         FROM feedback_items f JOIN reviews r USING (review_id) JOIN milestones m ON m.milestone_id = r.milestone_id ORDER BY f.feedback_id`);
    for (const f of fbs) {
      const messages = [{ authorId: f.created_by, role: 'faculty_guide', text: f.description, at: f.created_at }];
      if (f.response_text && f.resolved_at) messages.push({ authorId: f.assigned_user_id, role: 'student', text: f.response_text, at: f.resolved_at });
      if (f.resolution_status === 'reopened') messages.push({ authorId: f.created_by, role: 'faculty_guide', text: 'Still not clear enough. Please revisit.', at: new Date() });
      await db.collection('feedback_threads').insertOne({
        feedbackId: f.feedback_id, projectId: f.project_id, milestoneId: f.milestone_id, theme: themeOf(f.description),
        status: f.resolution_status, messages,
      });
    }

    step('Mongo notes');
    const { rows: projs } = await pg.query(
      `SELECT p.project_id, ga.user_id AS guide FROM projects p JOIN guide_allocations ga ON ga.project_id = p.project_id AND ga.allocation_role = 'guide'
        WHERE p.title ~ '^(CampusConnect|LibrarySeat|AgriAdvisor)' ORDER BY p.project_id`);
    const day = (n: number) => new Date(Date.now() - n * 86400000);
    const notes: Record<string, { ago: number; notes: string; items: string[] }> = {
      CampusConnect: { ago: 9, notes: 'Reviewed ER draft. Agreed to model event approval as a separate status table.', items: ['Add approval status table', 'Share updated ER diagram'] },
      LibrarySeat: { ago: 20, notes: 'Team behind schedule. Guide asked for the SRS draft within a week.', items: ['Submit SRS draft', 'Meet again after the draft'] },
      AgriAdvisor: { ago: 6, notes: 'Walkthrough of the advisory workflow. Test report to be started this week.', items: ['Start test report', 'Fix escalation path description'] },
    };
    for (const p of projs) {
      const { rows: [t] } = await pg.query(`SELECT title FROM projects WHERE project_id = $1`, [p.project_id]);
      const key = Object.keys(notes).find((k) => t.title.startsWith(k))!;
      const { rows: mem } = await pg.query(`SELECT tm.user_id FROM team_members tm JOIN projects pr ON pr.team_id = tm.team_id WHERE pr.project_id = $1`, [p.project_id]);
      await db.collection('meeting_notes').insertOne({
        projectId: p.project_id, date: day(notes[key].ago), attendees: [p.guide, ...mem.map((m) => m.user_id)], notes: notes[key].notes,
        actionItems: notes[key].items.map((text, i) => ({ text, ownerId: mem[i % mem.length].user_id, done: false })),
      });
    }
    return { documents: dels.length, threads: fbs.length };
  } finally {
    await client.close();
  }
}
