import { ApiError } from '@/lib/api/errors';
import type { PoolClient } from 'pg';
import type { ProjectAccess } from './access';

/** Milestones and tasks only exist for an approved (or running) project. */
export function assertPlannable(access: ProjectAccess): void {
  if (!['approved', 'in_progress'].includes(access.status)) {
    throw new ApiError(409, 'not_approved', 'The project plan can only be edited after the proposal is approved.');
  }
}

/** First planning activity moves an approved project into progress (a legal transition in status_transitions). */
export async function startProjectIfApproved(c: PoolClient, projectId: number): Promise<void> {
  await c.query(`UPDATE projects SET status = 'in_progress' WHERE project_id = $1 AND status = 'approved'`, [projectId]);
}
