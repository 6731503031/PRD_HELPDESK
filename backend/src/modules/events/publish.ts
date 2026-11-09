/**
 * Outbound domain events (PRD §7, FR-04, FR-13, BR-08).
 * Owner: P2 (Comments & Events)
 *
 * Other modules ONLY call `publishEvent(...)`. It must never throw —
 * a failed event must not break ticket creation (PRD §20: observable failures).
 *
 * Envelope = platform PRD §4 shared contract:
 *   { eventId, type, occurredAt, source, subject, data }
 */
import type { Bindings } from '../../core/env';
import type { Ticket } from '../tickets/rules';

export type DomainEventType =
  // required (PRD §7.1)
  | 'ticket.created'
  | 'ticket.escalated'
  | 'ticket.resolved'
  // supporting (PRD §7.2, optional)
  | 'ticket.status_changed'
  | 'ticket.work_order_linked';

export type EventEnvelope = {
  eventId: string;
  type: DomainEventType;
  occurredAt: string;
  source: 'helpdesk';
  subject: string;
  data: Record<string, unknown>;
};

/**
 * Build the envelope. Data minimisation: IDs, category, priority, status only —
 * never the description or the requester's name/email.
 */
export function buildEnvelope(
  type: DomainEventType,
  ticket: Pick<Ticket, 'id' | 'ticket_number' | 'status' | 'priority' | 'category_id' | 'customer_id'>,
  extra: Record<string, unknown> = {},
): EventEnvelope {
  return {
    eventId: crypto.randomUUID(),
    type,
    occurredAt: new Date().toISOString(),
    source: 'helpdesk',
    subject: `ticket:${ticket.ticket_number}`,
    data: {
      ticketId: ticket.id,
      ticketNumber: ticket.ticket_number,
      status: ticket.status,
      priority: ticket.priority,
      categoryId: ticket.category_id,
      requesterId: ticket.customer_id,
      ...extra,
    },
  };
}

/**
 * TODO(P2, F15–F18): make this real.
 *  1. INSERT the envelope into `domain_events` (outbox) with delivery_status 'pending'.
 *  2. If env.EVENT_HUB_URL is set: POST it with headers
 *       X-Event-Id, X-Timestamp, X-Signature = HMAC-SHA256(EVENT_SIGNING_SECRET, `${ts}.${body}`)
 *     → mark 'delivered' on 2xx, else 'failed' and attempts + 1.
 *     If EVENT_HUB_URL is empty → mark 'skipped'.
 *  3. Wrap everything in try/catch — log, never throw.
 *  Tip: reuse hmacHex() from modules/maintenance/signature.ts.
 */
export async function publishEvent(
  env: Bindings,
  type: DomainEventType,
  ticket: Parameters<typeof buildEnvelope>[1],
  extra: Record<string, unknown> = {},
): Promise<void> {
  try {
    const envelope = buildEnvelope(type, ticket, extra);
    void env;
    console.log(JSON.stringify({ level: 'info', msg: 'event (not yet delivered — TODO P2)', type, subject: envelope.subject }));
  } catch (err) {
    console.error(JSON.stringify({ level: 'error', msg: 'publishEvent failed', type, err: String(err) }));
  }
}
