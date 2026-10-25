import { api, intParam, readJson } from '@/lib/api/route';
import { ApiError, forbidden, notFound } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { requireProjectParticipant } from '@/lib/auth/access';
import { query } from '@/lib/db/pg';
import { getAllocations, getProject } from '@/lib/data/queries';
import { ProposalPatch } from '@/lib/validation/schemas';

export const GET = api<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser();
  const projectId = intParam(id);
  const access = await requireProjectParticipant(user, projectId);
  const project = await getProject(projectId);
  if (!project) throw notFound();
  return { proposal: project, allocations: await getAllocations(projectId), access };
});

// Column names come from this fixed map, never from the request, so the dynamic SET list is injection-safe.
const COLUMNS = {
  title: 'title', abstract: 'abstract', problemStatement: 'problem_statement', objectives: 'objectives',
  scope: 'scope', domain: 'domain', technologies: 'technologies', repoLink: 'repo_link',
} as const;

export const PATCH = api<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const projectId = intParam(id);
  const access = await requireProjectParticipant(user, projectId);
  if (!access.isMember) throw forbidden('Only the team can edit its proposal.');
  if (!['draft', 'revision_requested'].includes(access.status)) {
    throw new ApiError(409, 'locked', 'This proposal can no longer be edited.');
  }
  const body = ProposalPatch.parse(await readJson(req));
  const sets: string[] = []; const values: unknown[] = [projectId];
  for (const [key, col] of Object.entries(COLUMNS)) {
    const v = (body as Record<string, unknown>)[key];
    if (v !== undefined) { values.push(v); sets.push(`${col} = $${values.length}`); }
  }
  if (!sets.length) return { ok: true };
  await query(`UPDATE projects SET ${sets.join(', ')} WHERE project_id = $1`, values);
  return { ok: true };
});
