import { api, intParam } from '@/lib/api/route';
import { requireUser } from '@/lib/auth/session';
import { requireProjectParticipant } from '@/lib/auth/access';
import { listProjectDocuments } from '@/lib/docs/documents';

// Flexible document records (sections, tags, versions) live in MongoDB.
export const GET = api<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser();
  const projectId = intParam(id);
  await requireProjectParticipant(user, projectId);
  return { documents: await listProjectDocuments(projectId) };
});
