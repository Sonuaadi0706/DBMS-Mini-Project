import { api, readJson } from '@/lib/api/route';
import { ApiError } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { requireTeamMember } from '@/lib/auth/access';
import { draftOverlaps } from '@/lib/embeddings/service';
import { SimilarityCheck } from '@/lib/validation/schemas';

export const maxDuration = 300;

/**
 * Student "Check originality" hint (spec 12.1 step 7). It answers ONLY yes / no plus a fixed sentence: no titles,
 * no text, no scores and no team names from other proposals ever reach the student.
 */
export const POST = api(async (req) => {
  const user = await requireUser();
  const { projectId } = SimilarityCheck.parse(await readJson(req));
  const access = await requireTeamMember(user, projectId);
  if (!['draft', 'revision_requested'].includes(access.status)) {
    throw new ApiError(409, 'already_submitted', 'This proposal has already been submitted; faculty review it for overlap.');
  }
  let overlaps: boolean;
  try { overlaps = await draftOverlaps(projectId); } catch (e) {
    console.error('Originality check failed', e);
    throw new ApiError(503, 'similarity_unavailable', 'The originality check is not available right now. You can still submit; faculty will review it.');
  }
  return {
    possibleOverlap: overlaps,
    message: overlaps ? 'Your idea may overlap with an existing proposal. Faculty will review it.' : 'No close overlap with existing proposals was found.',
  };
});
