/**
 * Ticket data access (D1). All SQL is parameterised.
 * Owner: P1 (Core & Tickets)
 */
import { displayNames } from '../../core/profiles';
import { QUEUE_ORDER_SQL, ticketNumber, type CreateInput, type Ticket, type TicketStatus } from './rules';

export type TicketRow = Ticket & { category_name: string | null; ai_category_name: string | null };

const SELECT = `SELECT t.*, c.name AS category_name, ac.name AS ai_category_name
  FROM tickets t
  LEFT JOIN ticket_categories c ON c.id = t.category_id
  LEFT JOIN ticket_categories ac ON ac.id = t.ai_category_id`;

/** Adds display names from Identity / guest profiles (reference only — not stored on the ticket, PRD §10.2). */
export async function attachNames<T extends Pick<Ticket, 'customer_id'>>(db: D1Database, rows: T[]) {
  const names = await displayNames(db, rows.map((r) => r.customer_id));
  return rows.map((r) => ({ ...r, customer_name: names.get(r.customer_id) ?? null }));
}

export async function getTicket(db: D1Database, id: number): Promise<TicketRow | null> {
  return db.prepare(`${SELECT} WHERE t.id = ?`).bind(id).first<TicketRow>();
}

export type ListFilter = {
  customerId?: number;
  status?: string;
  priority?: string;
  /** 'queue' = FR-08 order (priority, then age); default = newest first */
  sort?: 'queue' | 'recent';
};

export async function listTickets(db: D1Database, f: ListFilter): Promise<TicketRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.customerId != null) { where.push('t.customer_id = ?'); params.push(f.customerId); }
  if (f.status) { where.push('t.status = ?'); params.push(f.status); }
  if (f.priority) { where.push('t.priority = ?'); params.push(f.priority); }

  const order = f.sort === 'queue' ? QUEUE_ORDER_SQL : 't.updated_at DESC';
  const sql = `${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${order} LIMIT 200`;
  const { results } = await db.prepare(sql).bind(...params).all<TicketRow>();
  return results ?? [];
}

export async function insertTicket(db: D1Database, input: CreateInput & { customer_id: number }): Promise<number> {
  // Insert with a temporary unique number, then derive the real one from the id.
  const tmp = `TMP-${crypto.randomUUID()}`;
  const res = await db
    .prepare(
      `INSERT INTO tickets (ticket_number, title, description, location, priority, category_id, customer_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(tmp, input.title, input.description, input.location, input.priority, input.category_id, input.customer_id)
    .run();
  const id = Number(res.meta.last_row_id);
  await db.prepare('UPDATE tickets SET ticket_number = ? WHERE id = ?').bind(ticketNumber(id), id).run();
  return id;
}

/** Update whitelisted columns. Column names come from rules.editableFields — never from the client. */
export async function updateTicket(db: D1Database, id: number, fields: Record<string, unknown>) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const sets = keys.map((k) => `${k} = ?`).join(', ');
  await db
    .prepare(`UPDATE tickets SET ${sets}, updated_at = datetime('now') WHERE id = ?`)
    .bind(...keys.map((k) => fields[k]), id)
    .run();
}

/** FR-06: every status change is written to history. */
export async function recordStatus(
  db: D1Database,
  ticketId: number,
  from: TicketStatus | null,
  to: TicketStatus | string,
  changedBy: number | null,
  source: 'helpdesk' | 'maintenance' | 'system' = 'helpdesk',
  note: string | null = null,
) {
  await db
    .prepare(
      `INSERT INTO ticket_status_history (ticket_id, from_status, to_status, changed_by, source, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(ticketId, from, to, changedBy, source, note)
    .run();
}

export async function getHistory(db: D1Database, ticketId: number) {
  const { results } = await db
    .prepare(
      `SELECT from_status, to_status, changed_by, source, note, created_at
       FROM ticket_status_history WHERE ticket_id = ? ORDER BY created_at ASC, id ASC`,
    )
    .bind(ticketId)
    .all<{ from_status: string | null; to_status: string; changed_by: number | null; source: string; note: string | null; created_at: string }>();
  const names = await displayNames(db, (results ?? []).map((h) => h.changed_by));
  return (results ?? []).map((h) => ({
    ...h,
    changed_by_name: h.changed_by != null ? names.get(h.changed_by) ?? null : null,
  }));
}

export async function categoryIsActive(db: D1Database, id: number): Promise<boolean> {
  const row = await db.prepare('SELECT is_active FROM ticket_categories WHERE id = ?').bind(id).first<{ is_active: number }>();
  return row?.is_active === 1;
}
