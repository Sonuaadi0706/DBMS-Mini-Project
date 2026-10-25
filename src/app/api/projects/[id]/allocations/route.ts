import { api, intParam, readJson } from '@/lib/api/route';
import { ApiError, forbidden } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { requireProjectParticipant } from '@/lib/auth/access';
import { withTransaction } from '@/lib/db/pg';
import { getAllocations } from '@/lib/data/queries';
import { AllocationBody } from '@/lib/validation/schemas';

export const GET = api<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser();
  const projectId = intParam(id);
  await requireProjectParticipant(user, projectId);
  return { allocations: await getAllocations(projectId) };
});

// Admin only. "Guide must hold the faculty_guide role and must not be on the team" is enforced by a DB trigger.
export const POST = api<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  if (!user.roles.includes('admin')) throw forbidden('Only an admin can allocate guides and reviewers.');
  const projectId = intParam(id);
  const body = AllocationBody.parse(await readJson(req));
  await withTransaction(user.userId, (c) => c.query(
    `INSERT INTO guide_allocations(project_id, user_id, allocation_role, allocated_by) VALUES ($1,$2,$3,$4)`,
    [projectId, body.userId, body.allocationRole, user.userId]));
  return { ok: true };
}, 201);

export const DELETE = api<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  if (!user.roles.includes('admin')) throw forbidden('Only an admin can change allocations.');
  const projectId = intParam(id);
  const allocationId = Number(new URL(req.url).searchParams.get('allocationId'));
  if (!Number.isInteger(allocationId)) throw new ApiError(400, 'bad_request', 'allocationId is required.');
  const res = await withTransaction(user.userId, (c) => c.query(
    `DELETE FROM guide_allocations WHERE allocation_id = $1 AND project_id = $2`, [allocationId, projectId]));
  if (!res.rowCount) throw new ApiError(404, 'not_found', 'Allocation not found.');
  return { ok: true };
});
