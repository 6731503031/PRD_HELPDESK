/**
 * Ticket business rules — PURE functions (no DB), so they are easy to unit test.
 * Owner: P1 (Core & Tickets)
 * PRD: FR-03, FR-07, FR-10, FR-13, BR-01, BR-02, §14 lifecycle
 * Roles: customer (requester) and admin (runs the Helpdesk). No agents, no assignment.
 */
import type { AuthUser } from '../../core/env';
import type { Role } from '../../core/identity';

// 'assigned' is gone with the agent role; the DB CHECK still accepts it for old rows only.
export const STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export type TicketStatus = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];

export type Ticket = {
  id: number;
  ticket_number: string;
  title: string;
  description: string;
  /** Where the problem is (requester). NULL on tickets created before migration 0005. */
  location: string | null;
  status: TicketStatus;
  priority: Priority;
  category_id: number;
  customer_id: number;
  assigned_agent_id: number | null; // legacy column (Assignment 2), no longer written
  resolution_note: string | null;
  /** Team 16 service id we suggested (contract 2.0, e.g. srv_general_counselling). Never means "Wellbeing client". */
  wellbeing_service_id: string | null;
  maintenance_work_order_id: string | null;
  maintenance_status: string | null;
  maintenance_status_at: string | null;
  /** Team 10 category chosen by the admin when sending (envelope.ts REPAIR_CATEGORIES). */
  maintenance_category: string | null;
  escalated_at: string | null;
  ai_category_id: number | null; // PRD §8: suggestion kept for the admin (F31)
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
  location: string;
  category_id: number;
  priority: Priority;
  customer_id?: number;
};

/**
 * FR-03: subject, description, location, category, urgency are required.
 * Accepts PRD names (subject / urgency) and Assignment 2 names (title / priority).
 * Returns the cleaned input, or a list of field errors.
 */
export function validateCreate(
  body: Record<string, unknown>,
): { ok: true; value: CreateInput } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const title = String(body.subject ?? body.title ?? '').trim();
  const description = String(body.description ?? '').trim();
  const location = String(body.location ?? '').trim();
  const categoryId = Number(body.category_id);
  const priority = String(body.urgency ?? body.priority ?? '').trim();

  if (title.length < 5) errors.subject = 'Please enter a subject of at least 5 characters';
  if (title.length > 150) errors.subject = 'Subject must be 150 characters or fewer';
  if (description.length < 10) errors.description = 'Please describe the problem in at least 10 characters';
  if (description.length > 5000) errors.description = 'Description must be 5,000 characters or fewer';
  const locationProblem = checkLocation(location);
  if (locationProblem) errors.location = locationProblem;
  if (!Number.isInteger(categoryId) || categoryId <= 0) errors.category_id = 'Please select a category';
  if (!PRIORITIES.includes(priority as Priority)) errors.urgency = 'Please select an urgency';

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      title,
      description,
      location,
      category_id: categoryId,
      priority: priority as Priority,
      customer_id: body.customer_id == null ? undefined : Number(body.customer_id),
    },
  };
}

export const LOCATION_MAX = 200;
/** Where the problem is: 2–200 characters. Returns the problem, or null when fine. */
export function checkLocation(location: string): string | null {
  if (location.length < 2) return 'Please enter the location (e.g. building and room)';
  if (location.length > LOCATION_MAX) return `Location must be ${LOCATION_MAX} characters or fewer`;
  return null;
}

export const isStaff = (role: Role) => role === 'admin';

/** FR-07 / BR-01: requester sees own tickets; admin sees all. */
export function canViewTicket(user: AuthUser, ticket: Pick<Ticket, 'customer_id'>): boolean {
  return isStaff(user.role) || ticket.customer_id === user.id;
}

/**
 * BR-02: only the admin changes category, priority, status, maintenance link.
 * A requester may only fix the wording of their own ticket while it is still open.
 */
export function editableFields(role: Role): string[] {
  const requester = ['title', 'description', 'location'];
  if (!isStaff(role)) return requester;
  return [...requester, 'priority', 'status', 'category_id', 'resolution_note', 'wellbeing_service_id'];
}

/** FR-13: only staff can resolve, and not twice. */
export function canResolve(user: AuthUser, ticket: Pick<Ticket, 'status'>): { ok: boolean; reason?: string } {
  if (!isStaff(user.role)) return { ok: false, reason: 'Only administrators can resolve tickets' };
  if (ticket.status === 'resolved' || ticket.status === 'closed') {
    return { ok: false, reason: 'This ticket is already resolved' };
  }
  return { ok: true };
}

/**
 * §14 lifecycle: Open → InProgress → Resolved → Closed
 *
 * TODO(P1, F25): enforce the lifecycle. Suggested table:
 *   open        → in_progress, resolved
 *   in_progress → resolved, open
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
