import { query } from '@/lib/db/pg';
import type { Document } from 'mongodb';
import { mongoDb } from '@/lib/db/mongo';
import type { CurrentUser } from '@/lib/auth/session';
import { pipelines } from '../../../db/mongo/aggregations';

const agg = async <T extends Document>(collection: string, pipeline: object[]) => (await mongoDb()).collection(collection).aggregate<T>(pipeline as Document[]).toArray();

export interface DocStats {
  versions: { _id: string; title: string; documentType: string; versionCount: number; lastUpdated: string | null }[];
  completeness: { pct: number; sqlPct: number; required: { milestone: string; type: string; present: boolean }[] };
  themes: { theme: string; openThreads: number; avgMessages: number }[] | null;
}

/**
 * Per-project document statistics. A1 is pure MongoDB. A3 is a SQL + MongoDB merge: SQL knows which deliverable
 * types are REQUIRED (and which deliverables are submitted), MongoDB knows which documents EXIST; the result is
 * checked against the SQL function fn_documentation_completeness, which must agree.
 */
export async function projectDocStats(projectId: number, includeThemes: boolean): Promise<DocStats> {
  const [required, deliverables, sqlPct] = await Promise.all([
    query<{ milestone_id: number; title: string; deliverable_type: string }>(
      `SELECT m.milestone_id, m.title, r.deliverable_type FROM milestone_required_deliverables r JOIN milestones m ON m.milestone_id = r.milestone_id
        WHERE m.project_id = $1 AND m.due_date <= CURRENT_DATE + 7 ORDER BY m.sequence_no, r.deliverable_type`, [projectId]),
    query<{ deliverable_id: number }>(
      `SELECT d.deliverable_id FROM deliverables d JOIN milestones m ON m.milestone_id = d.milestone_id
        WHERE m.project_id = $1 AND d.status IN ('submitted','accepted') AND m.due_date <= CURRENT_DATE + 7`, [projectId]),
    query<{ pct: string }>(`SELECT fn_documentation_completeness($1) AS pct`, [projectId]),
  ]);
  const [versions, present, themes] = await Promise.all([
    agg<DocStats['versions'][number]>('documents', pipelines.versionCounts(projectId)),
    agg<{ _id: { milestoneId: number; type: string } }>('documents', pipelines.typesPresent(deliverables.map((d) => d.deliverable_id))),
    includeThemes ? agg<{ _id: string; openThreads: number; avgMessages: number }>('feedback_threads', pipelines.feedbackThemes([projectId])) : Promise.resolve(null),
  ]);
  const have = new Set(present.map((p) => `${p._id.milestoneId}:${p._id.type}`));
  const rows = required.map((r) => ({ milestone: r.title, type: r.deliverable_type, present: have.has(`${r.milestone_id}:${r.deliverable_type}`) }));
  const pct = rows.length === 0 ? 0 : Math.round((1000 * rows.filter((r) => r.present).length) / rows.length) / 10;
  return {
    versions: versions.map((v) => ({ ...v, _id: String(v._id) })),
    completeness: { pct, sqlPct: Number(sqlPct[0].pct), required: rows },
    themes: themes ? themes.map((t) => ({ theme: t._id, openThreads: t.openThreads, avgMessages: Math.round(t.avgMessages * 10) / 10 })) : null,
  };
}

export interface ScopeStats {
  projects: number;
  types: { documentType: string; documents: number; avgVersions: number }[];
  themes: { theme: string; openThreads: number; avgMessages: number }[];
  tags: { tag: string; n: number }[];
}

/** A2, A4 and A5 across the projects a person oversees (admin: every proposal that has started). */
export async function scopeDocStats(user: CurrentUser): Promise<ScopeStats> {
  const ids = (await query<{ project_id: number }>(
    `SELECT p.project_id FROM projects p
      WHERE p.status NOT IN ('draft','rejected','archived')
        AND ($1::boolean OR EXISTS (SELECT 1 FROM guide_allocations ga WHERE ga.project_id = p.project_id AND ga.user_id = $2))`,
    [user.roles.includes('admin'), user.userId])).map((r) => r.project_id);
  if (ids.length === 0) return { projects: 0, types: [], themes: [], tags: [] };
  const [types, themes, tags] = await Promise.all([
    agg<{ _id: string; documents: number; avgVersions: number }>('documents', pipelines.typeDistribution(ids)),
    agg<{ _id: string; openThreads: number; avgMessages: number }>('feedback_threads', pipelines.feedbackThemes(ids)),
    agg<{ _id: string; n: number }>('documents', pipelines.tagCounts(ids)),
  ]);
  return {
    projects: ids.length,
    types: types.map((t) => ({ documentType: t._id, documents: t.documents, avgVersions: Math.round(t.avgVersions * 10) / 10 })),
    themes: themes.map((t) => ({ theme: t._id, openThreads: t.openThreads, avgMessages: Math.round(t.avgMessages * 10) / 10 })),
    tags: tags.map((t) => ({ tag: t._id, n: t.n })),
  };
}
