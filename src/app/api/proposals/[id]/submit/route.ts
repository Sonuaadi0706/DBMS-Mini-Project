import { api, intParam } from '@/lib/api/route';
import { ApiError, forbidden, notFound } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { requireProjectParticipant } from '@/lib/auth/access';
import { withTransaction } from '@/lib/db/pg';
import { getProject } from '@/lib/data/queries';
import { ProposalComplete } from '@/lib/validation/schemas';
import { embedAndScreenSafely } from '@/lib/embeddings/service';

// draft | revision_requested -> submitted, with an immutable history row, in one transaction.
// After the commit the proposal is embedded and screened for overlap (faculty review signal only).
export const POST = api<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser();
  const projectId = intParam(id);
  const access = await requireProjectParticipant(user, projectId);
  if (!access.isMember) throw forbidden('Only the team can submit its proposal.');
  const p = await getProject(projectId);
  if (!p) throw notFound();
  if (!['draft', 'revision_requested'].includes(p.status)) throw new ApiError(409, 'bad_state', `A ${p.status} proposal cannot be submitted.`);
  // null (never filled in) is reported as "required", same as a missing field.
  ProposalComplete.parse({
    title: p.title, abstract: p.abstract ?? undefined, problemStatement: p.problem_statement ?? undefined,
    objectives: p.objectives ?? undefined, scope: p.scope ?? undefined, domain: p.domain ?? undefined,
  });
  await withTransaction(user.userId, async (c) => {
    await c.query(`UPDATE projects SET status = 'submitted', submitted_at = now() WHERE project_id = $1`, [projectId]);
    await c.query(
      `INSERT INTO proposal_actions(project_id, actor_id, action, from_status, to_status, comments) VALUES ($1,$2,$3,$4,'submitted',$5)`,
      [projectId, user.userId, p.status === 'draft' ? 'submit' : 'resubmit', p.status, p.status === 'draft' ? 'Proposal submitted for review' : 'Revised proposal resubmitted']);
  });
  // Embed the proposal and screen it against the others in the course. Failure here never undoes the submission.
  await embedAndScreenSafely(projectId);
  return { status: 'submitted' };
});
