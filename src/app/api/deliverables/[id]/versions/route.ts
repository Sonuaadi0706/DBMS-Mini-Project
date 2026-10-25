import { api, intParam } from '@/lib/api/route';
import { requireUser } from '@/lib/auth/session';
import { loadDeliverable, requireTeamMember } from '@/lib/auth/access';
import { addVersionFlow } from '@/lib/docs/flows';
import { readUpload } from '@/lib/docs/upload';

// Version numbers are assigned by the database (trigger), so two uploads can never collide.
export const POST = api<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const ctx = await loadDeliverable(intParam(id));
  await requireTeamMember(user, ctx.projectId);
  return addVersionFlow(user, ctx, await readUpload(req));
}, 201);
