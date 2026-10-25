import { z } from 'zod';
import { REPORTS, type ReportFilters, type ReportName } from '@/lib/data/reports';

const optInt = z.preprocess((v) => (v === '' || v === null || v === undefined ? undefined : Number(v)), z.number().int().positive().optional());

const Query = z.object({
  courseId: optInt, guideId: optInt, teamId: optInt,
  status: z.enum(['draft', 'submitted', 'revision_requested', 'approved', 'rejected', 'in_progress', 'completed', 'archived']).optional().or(z.literal('').transform(() => undefined)),
  min: z.preprocess((v) => (v === '' || v == null ? 0 : Number(v)), z.number().int().min(0).max(1000)),
  threshold: z.preprocess((v) => (v === '' || v == null ? 60 : Number(v)), z.number().min(0).max(100)),
  level: z.enum(['low', 'moderate', 'high', 'critical']).default('high'),
  overdue: z.preprocess((v) => v === '1' || v === 'true' || v === 'on', z.boolean()),
  sort: z.string().max(40).optional(), dir: z.enum(['asc', 'desc']).default('desc'),
});

export function isReportName(v: string): v is ReportName {
  return Object.prototype.hasOwnProperty.call(REPORTS, v);
}

/** Query-string -> typed filters. Anything invalid becomes a 422 with field messages (ZodError). */
export function parseReportFilters(sp: URLSearchParams | Record<string, string | undefined>): ReportFilters {
  const get = (k: string) => (sp instanceof URLSearchParams ? sp.get(k) ?? undefined : sp[k]);
  const q = Query.parse({ courseId: get('courseId'), guideId: get('guideId'), teamId: get('teamId'), status: get('status'), min: get('min'),
    threshold: get('threshold'), level: get('level') || undefined, overdue: get('overdue'), sort: get('sort') || undefined, dir: get('dir') || undefined });
  return { courseId: q.courseId, guideId: q.guideId, teamId: q.teamId, status: q.status || undefined, min: q.min, threshold: q.threshold, level: q.level, overdueOnly: q.overdue, sort: q.sort, dir: q.dir };
}
