import { z } from 'zod';
import { api } from '@/lib/api/route';
import { forbidden } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { AUDIT_PAGE_SIZE, queryAudit } from '@/lib/data/audit';

const AuditQuery = z.object({
  entity: z.string().max(40).optional(), action: z.string().max(30).optional(),
  user: z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number().int().positive().optional()),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('').transform(() => undefined)),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('').transform(() => undefined)),
  page: z.preprocess((v) => (v === '' || v == null ? 1 : Number(v)), z.number().int().min(1).max(100000)),
});

// Admin only (AUD-01). GET /api/admin/audit?entity=&user=&action=&from=&to=&page=
export const GET = api(async (req) => {
  const user = await requireUser();
  if (!user.roles.includes('admin')) throw forbidden('Only an admin can read the audit log.');
  const sp = new URL(req.url).searchParams;
  const q = AuditQuery.parse({ entity: sp.get('entity') || undefined, action: sp.get('action') || undefined, user: sp.get('user'), from: sp.get('from') || undefined, to: sp.get('to') || undefined, page: sp.get('page') });
  const { rows, total } = await queryAudit({ entity: q.entity, action: q.action, userId: q.user, from: q.from, to: q.to, page: q.page });
  return { rows, total, page: q.page, pageSize: AUDIT_PAGE_SIZE };
});
