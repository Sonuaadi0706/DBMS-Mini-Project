import { api, intParam } from '@/lib/api/route';
import { requireUser } from '@/lib/auth/session';
import { requireProjectParticipant } from '@/lib/auth/access';
import { listProjectTasks } from '@/lib/data/queries';

export const GET = api<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser();
  const projectId = intParam(id);
  await requireProjectParticipant(user, projectId);
  return { tasks: await listProjectTasks(projectId) };
});
