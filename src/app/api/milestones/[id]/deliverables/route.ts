import { api, intParam } from '@/lib/api/route';
import { requireUser } from '@/lib/auth/session';
import { projectIdOfMilestone, requireProjectParticipant, requireTeamMember } from '@/lib/auth/access';
import { listDeliverables } from '@/lib/data/queries';
import { createDeliverableFlow } from '@/lib/docs/flows';
import { readUpload } from '@/lib/docs/upload';

export const GET = api<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser();
  const milestoneId = intParam(id);
  const projectId = await projectIdOfMilestone(milestoneId);
  await requireProjectParticipant(user, projectId);
  return { deliverables: (await listDeliverables(projectId)).filter((d) => d.milestone_id === milestoneId) };
});

// Upload a file or register a link (multipart or JSON). Creates the deliverable as a draft with version 1.
export const POST = api<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const milestoneId = intParam(id);
  const projectId = await projectIdOfMilestone(milestoneId);
  await requireTeamMember(user, projectId);
  return createDeliverableFlow(user, projectId, milestoneId, await readUpload(req));
}, 201);
