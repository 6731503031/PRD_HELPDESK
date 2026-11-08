/**
 * Ticket business rules — PURE functions (no DB), so they are easy to unit test.
 * Owner: P1 (Core & Tickets)
 * PRD: FR-03, FR-07, FR-09, FR-10, FR-13, BR-01, BR-02, §14 lifecycle
 */
import type { AuthUser } from '../../core/env';
import type { Role } from '../../core/identity';

export const STATUSES = ['open', 'assigned', 'in_progress', 'resolved', 'closed'] as const;
export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export const WELLBEING_SLUGS = ['counselling', 'health-clinic', 'physiotherapy', 'wellbeing-advising'] as const;

export type TicketStatus = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];

export type Ticket = {
  id: number;
  ticket_number: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: Priority;
  category_id: number;
  customer_id: number;
  assigned_agent_id: number | null;
  resolution_note: string | null;
  wellbeing_service_slug: string | null;
  maintenance_work_order_id: string | null;
  maintenance_status: string | null;
  maintenance_status_at: string | null;
  escalated_at: string | null;
  ai_category_id: number | null; // PRD §8: suggestion kept for the agent (F31)
  ai_priority: Priority | null;
  ai_route: string | null;
  ai_source: 'ai' | 'fallback' | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

/** Human-readable ticket number derived from the row id — never collides (fixes the old COUNT(*) bug). */
export function ticketNumber(id: number): string {
  return `TKT-${String(id).padStart(5, '0')}`;
}

export type CreateInput = {
  title: string;
  description: string;
  category_id: number;
  priority: Priority;
  customer_id?: number;
};

/**
 * FR-03: subject, description, category, urgency are required.
 * Accepts PRD names (subject / urgency) and Assignment 2 names (title / priority).
 * Returns the cleaned input, or a list of field errors.
 */
export function validateCreate(
  body: Record<string, unknown>,
): { ok: true; value: CreateInput } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const title = String(body.subject ?? body.title ?? '').trim();
  const description = String(body.description ?? '').trim();
  const categoryId = Number(body.category_id);
  const priority = String(body.urgency ?? body.priority ?? '').trim();

  if (title.length < 5) errors.subject = 'กรุณากรอกหัวเรื่องอย่างน้อย 5 ตัวอักษร';
  if (title.length > 150) errors.subject = 'หัวเรื่องยาวเกิน 150 ตัวอักษร';
  if (description.length < 10) errors.description = 'กรุณาอธิบายปัญหาอย่างน้อย 10 ตัวอักษร';
  if (description.length > 5000) errors.description = 'รายละเอียดยาวเกิน 5,000 ตัวอักษร';
  if (!Number.isInteger(categoryId) || categoryId <= 0) errors.category_id = 'กรุณาเลือกหมวดหมู่';
  if (!PRIORITIES.includes(priority as Priority)) errors.urgency = 'กรุณาเลือกระดับความเร่งด่วน';

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      title,
      description,
      category_id: categoryId,
      priority: priority as Priority,
      customer_id: body.customer_id == null ? undefined : Number(body.customer_id),
    },
  };
}

export const isStaff = (role: Role) => role === 'agent' || role === 'admin';

/** FR-07 / BR-01: requester sees own tickets; agents/admins see all. */
export function canViewTicket(user: AuthUser, ticket: Pick<Ticket, 'customer_id'>): boolean {
  return isStaff(user.role) || ticket.customer_id === user.id;
}

/**
 * BR-02: only Agents/Admins change assignee, category, priority, status, maintenance link.
 * A requester may only fix the wording of their own ticket while it is still open.
 */
export function editableFields(role: Role): string[] {
  const requester = ['title', 'description'];
  if (!isStaff(role)) return requester;
  return [...requester, 'priority', 'status', 'category_id', 'assigned_agent_id', 'resolution_note', 'wellbeing_service_slug'];
}

/** FR-09: only staff can assign; the assignee must be an agent/admin (checked against Identity by the caller). */
export function canAssign(user: AuthUser, ticket: Pick<Ticket, 'status'>): { ok: boolean; reason?: string } {
  if (!isStaff(user.role)) return { ok: false, reason: 'เฉพาะเจ้าหน้าที่เท่านั้นที่มอบหมายงานได้' };
  if (ticket.status === 'resolved' || ticket.status === 'closed') {
    return { ok: false, reason: 'ticket ที่ปิดแล้วมอบหมายใหม่ไม่ได้' };
  }
  return { ok: true };
}

/** FR-13: only staff can resolve, and not twice. */
export function canResolve(user: AuthUser, ticket: Pick<Ticket, 'status'>): { ok: boolean; reason?: string } {
  if (!isStaff(user.role)) return { ok: false, reason: 'เฉพาะเจ้าหน้าที่เท่านั้นที่ปิดงานได้' };
  if (ticket.status === 'resolved' || ticket.status === 'closed') {
    return { ok: false, reason: 'ticket นี้ปิดไปแล้ว' };
  }
  return { ok: true };
}

/**
 * §14 lifecycle: Open → Assigned → InProgress → Resolved → Closed
 *
 * TODO(P1, F25): enforce the lifecycle. Suggested table:
 *   open        → assigned, in_progress, resolved
 *   assigned    → in_progress, open, resolved
 *   in_progress → resolved, assigned
 *   resolved    → closed, in_progress (re-open)
 *   closed      → (nothing)
 * Then un-skip the lifecycle tests in test/tickets.rules.test.ts.
 */
export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  void from;
  void to;
  return true; // TODO(P1, F25): replace with the table above
}

/** FR-08: queue order — priority first (urgent → low), then oldest first. Used in SQL. */
export const QUEUE_ORDER_SQL = `CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, t.created_at ASC`;
