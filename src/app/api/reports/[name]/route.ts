import { api } from '@/lib/api/route';
import { ApiError, forbidden } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { REPORTS, runReport, toCsv } from '@/lib/data/reports';
import { isReportName, parseReportFilters } from '@/lib/validation/report';

// Guides and reviewers see their allocated projects; admins see everything. Students have no reports.
export const GET = api<{ name: string }>(async (req, { name }) => {
  const user = await requireUser();
  if (!user.roles.some((r) => ['faculty_guide', 'reviewer', 'admin'].includes(r))) throw forbidden('Reports are for faculty and admins.');
  if (!isReportName(name)) throw new ApiError(404, 'not_found', `Unknown report. Choose one of: ${Object.keys(REPORTS).join(', ')}.`);
  const url = new URL(req.url);
  const result = await runReport(user, name, parseReportFilters(url.searchParams));
  if (url.searchParams.get('format') === 'csv') {
    return new Response(toCsv(result.columns, result.rows), {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}.csv"`, 'X-Content-Type-Options': 'nosniff' },
    });
  }
  return { report: name, title: REPORTS[name], note: result.note, columns: result.columns, rows: result.rows };
});
