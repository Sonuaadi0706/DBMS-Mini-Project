import { api, intParam, readJson } from '@/lib/api/route';
import { ApiError } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { requireProjectGuide } from '@/lib/auth/access';
import { withTransaction } from '@/lib/db/pg';
import { ProposalDecision } from '@/lib/validation/schemas';
import { setEmbeddingsCurrent } from '@/lib/embeddings/service';

const TARGET = { approve: 'approved', reject: 'rejected', request_revision: 'revision_requested' } as const;

// Only the project's allocated guide decides. Status + immutable history row + audit happen together.
export const POST = api<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const projectId = intParam(id);
  const access = await requireProjectGuide(user, projectId);
  if (access.status !== 'submitted') throw new ApiError(409, 'bad_state', 'Only a submitted proposal can be decided.');
  const { action, comments } = ProposalDecision.parse(await readJson(req));
  const to = TARGET[action];
  await withTransaction(user.userId, async (c) => {
    await c.query(
      `UPDATE projects SET status = $2::text,
              approved_by = CASE WHEN $2::text = 'approved' THEN $3::int END,
              approved_at = CASE WHEN $2::text = 'approved' THEN now() END
        WHERE project_id = $1`, [projectId, to, user.userId]);
    await c.query(
      `INSERT INTO proposal_actions(project_id, actor_id, action, from_status, to_status, comments) VALUES ($1,$2,$3,'submitted',$4,$5)`,
      [projectId, user.userId, action, to, comments || null]);
  });
  // A rejected proposal must not be matched against future ones.
  if (to === 'rejected') await setEmbeddingsCurrent(projectId, false).catch((e) => console.error('Could not retire embeddings', e));
  return { status: to };
});
