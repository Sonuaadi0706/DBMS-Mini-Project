import { query } from '@/lib/db/pg';

export interface AuditFilters { entity?: string; action?: string; userId?: number; from?: string; to?: string; page: number }
export const AUDIT_PAGE_SIZE = 50;

export interface AuditRow {
  log_id: string; user_name: string | null; action: string; entity_type: string; entity_id: string | null;
  old_values: Record<string, unknown> | null; new_values: Record<string, unknown> | null; created_at: string;
}

/** Filters are bound parameters; the audit table is append-only (a trigger blocks UPDATE and DELETE). */
export async function queryAudit(f: AuditFilters): Promise<{ rows: AuditRow[]; total: number }> {
  const params: unknown[] = [];
  const next = (v: unknown) => { params.push(v); return `$${params.length}`; };
  const where: string[] = [];
  if (f.entity) where.push(`a.entity_type = ${next(f.entity)}`);
  if (f.action) where.push(`a.action = ${next(f.action)}`);
  if (f.userId) where.push(`a.user_id = ${next(f.userId)}`);
  if (f.from) where.push(`a.created_at >= ${next(f.from)}::date`);
  if (f.to) where.push(`a.created_at < (${next(f.to)}::date + 1)`);
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [{ total }] = await query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM audit_logs a ${w}`, params);
  const rows = await query<AuditRow>(
    `SELECT a.log_id::text, u.name AS user_name, a.action, a.entity_type, a.entity_id, a.old_values, a.new_values, a.created_at
       FROM audit_logs a LEFT JOIN users u ON u.user_id = a.user_id ${w}
      ORDER BY a.created_at DESC, a.log_id DESC LIMIT ${AUDIT_PAGE_SIZE} OFFSET ${(Math.max(1, f.page) - 1) * AUDIT_PAGE_SIZE}`, params);
  return { rows, total };
}

export const auditEntities = () => query<{ v: string }>(`SELECT DISTINCT entity_type AS v FROM audit_logs ORDER BY 1`).then((r) => r.map((x) => x.v));
export const auditActions = () => query<{ v: string }>(`SELECT DISTINCT action AS v FROM audit_logs ORDER BY 1`).then((r) => r.map((x) => x.v));
