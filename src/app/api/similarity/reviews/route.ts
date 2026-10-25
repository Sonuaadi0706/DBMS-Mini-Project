import { api } from '@/lib/api/route';
import { forbidden } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { listSimilarity } from '@/lib/data/similarity';
import { similarityBreakdown } from '@/lib/embeddings/service';

// Faculty only. Students never see this: it contains other teams' text.
export const GET = api(async (req) => {
  const user = await requireUser();
  if (!user.roles.some((r) => ['faculty_guide', 'reviewer', 'admin'].includes(r))) throw forbidden('Similarity reviews are for faculty and admins.');
  const url = new URL(req.url);
  const decision = url.searchParams.get('decision');
  const rows = await listSimilarity(user, decision);
  const withSections = url.searchParams.get('sections') === '1'
    ? await Promise.all(rows.map(async (r) => ({ ...r, sections: await similarityBreakdown(r.source_project_id, r.matched_project_id) })))
    : rows;
  return { reviews: withSections };
});
