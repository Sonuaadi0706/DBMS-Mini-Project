import { api, readJson } from '@/lib/api/route';
import { forbidden } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { query } from '@/lib/db/pg';
import { searchByText } from '@/lib/embeddings/service';
import { SimilaritySearch } from '@/lib/validation/schemas';

export const maxDuration = 300;

// Faculty free-text semantic search ("proposals about hospital queues"), limited to the courses they supervise.
export const POST = api(async (req) => {
  const user = await requireUser();
  if (!user.roles.some((r) => ['faculty_guide', 'reviewer', 'admin'].includes(r))) throw forbidden('Similarity search is for faculty and admins.');
  const { query: text, k } = SimilaritySearch.parse(await readJson(req));
  const courseIds = user.roles.includes('admin') ? null
    : (await query<{ course_id: number }>(`SELECT DISTINCT p.course_id FROM guide_allocations ga JOIN projects p ON p.project_id = ga.project_id WHERE ga.user_id = $1`, [user.userId])).map((r) => r.course_id);
  if (courseIds && courseIds.length === 0) return { results: [] };
  return { results: await searchByText(text, courseIds, k) };
});
