import path from 'node:path';
import { api, intParam } from '@/lib/api/route';
import { ApiError, notFound } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { requireProjectParticipant } from '@/lib/auth/access';
import { query } from '@/lib/db/pg';
import { ALLOWED_TYPES, readStored } from '@/lib/storage';

// Files are never public: the caller must belong to the project (team, allocated guide/reviewer, admin).
export const GET = api<{ versionId: string }>(async (_req, { versionId }) => {
  const user = await requireUser();
  const [v] = await query<{ file_name: string | null; file_url: string | null; project_id: number }>(
    `SELECT dv.file_name, dv.file_url, m.project_id FROM document_versions dv
       JOIN deliverables d ON d.deliverable_id = dv.deliverable_id JOIN milestones m ON m.milestone_id = d.milestone_id
      WHERE dv.version_id = $1`, [intParam(versionId, 'versionId')]);
  if (!v) throw notFound('File not found.');
  await requireProjectParticipant(user, v.project_id);
  if (!v.file_url || /^https?:/i.test(v.file_url)) throw new ApiError(404, 'external', 'This version is an external link, not an uploaded file.');
  let bytes: Buffer;
  try { bytes = await readStored(v.file_url); } catch { throw notFound('The stored file is missing.'); }
  const ext = path.extname(v.file_url).slice(1).toLowerCase();
  const name = (v.file_name ?? 'download').replace(/[^\w.\- ()]/g, '_');
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': ALLOWED_TYPES[ext] ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${name}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
});
