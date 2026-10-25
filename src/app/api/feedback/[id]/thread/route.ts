import { api, intParam, readJson } from '@/lib/api/route';
import { forbidden } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { query } from '@/lib/db/pg';
import { appendMessage, getThread } from '@/lib/docs/threads';
import { feedbackFor, roleOf } from '@/lib/docs/feedback-actions';
import { ThreadMessage } from '@/lib/validation/schemas';

export const GET = api<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser();
  const { fb } = await feedbackFor(user, intParam(id));
  const thread = await getThread(fb.feedbackId);
  const names = new Map((await query<{ user_id: number; name: string }>(`SELECT user_id, name FROM users WHERE user_id = ANY($1::int[])`,
    [[...new Set((thread?.messages ?? []).map((m: { authorId: number }) => m.authorId))]])).map((u) => [u.user_id, u.name]));
  return { messages: (thread?.messages ?? []).map((m: { authorId: number }) => ({ ...m, authorName: names.get(m.authorId) ?? 'Unknown' })), status: thread?.status ?? fb.status };
});

// Anyone who can see the item may take part, except admins (read-only).
export const POST = api<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const { fb, access } = await feedbackFor(user, intParam(id));
  if (roleOf(access) === 'admin') throw forbidden('Admins can read feedback threads but not post in them.');
  const { text } = ThreadMessage.parse(await readJson(req));
  await appendMessage({
    feedbackId: fb.feedbackId, projectId: fb.projectId, milestoneId: fb.milestoneId, theme: 'other', status: fb.status,
    message: { authorId: user.userId, authorName: user.name, role: roleOf(access), text, at: new Date() },
  });
  return { ok: true };
}, 201);
