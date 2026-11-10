/**
 * Apply a Team 10 work-order status to OUR ticket — one place for both ways it can arrive:
 *   - the webhook (Team 10 calls us), with its event id for idempotency
 *   - the sync (we ask Team 10), when a webhook did not arrive
 * Same database rows, same history label, same chat message, same domain event either way.
 * Owner: P3 (Maintenance Integration)
 */
import type { Bindings } from '../../core/env';
import { postSystemMessage, repairMessage } from '../comments/templates';
import { publishEvent } from '../events/publish';
import { getTicket } from '../tickets/repo';
import type { TicketStatus } from '../tickets/rules';
import { nextTicketStatus, type MaintenanceEffect } from './mapping';

export type LinkedTicket = { id: number; ticket_number: string; status: TicketStatus; maintenance_status: string | null };

export async function applyWorkOrderStatus(
  env: Bindings,
  ticket: LinkedTicket,
  status: string,
  effect: MaintenanceEffect,
  event?: { id: string; type: string },
): Promise<{ outcome: 'applied' | 'duplicate'; ticketStatus: TicketStatus }> {
  const next = nextTicketStatus(ticket.status, effect);
  const sets = ['maintenance_status = ?', "maintenance_status_at = datetime('now')", "updated_at = datetime('now')"];
  const values: unknown[] = [status];
  if (next) {
    sets.push('status = ?');
    values.push(next);
  }

  // One atomic batch: a webhook's event id is stored only if the ticket update and its history row also succeed.
  const statements = [
    env.DB.prepare(`UPDATE tickets SET ${sets.join(', ')} WHERE id = ?`).bind(...values, ticket.id),
    env.DB.prepare(
      `INSERT INTO ticket_status_history (ticket_id, from_status, to_status, changed_by, source, note) VALUES (?, ?, ?, NULL, 'maintenance', ?)`,
    ).bind(ticket.id, ticket.status, next ?? ticket.status, effect.label),
  ];
  if (event) {
    statements.unshift(env.DB.prepare(`INSERT INTO processed_events (event_id, source, type) VALUES (?, 'maintenance', ?)`).bind(event.id, event.type));
  }
  try {
    await env.DB.batch(statements);
  } catch (err) {
    if (event && String(err).includes('UNIQUE')) return { outcome: 'duplicate', ticketStatus: ticket.status }; // the same event raced us
    throw err;
  }

  // Tell the requester in the chat — real progress only, once per stage, never on a ticket already finished.
  const chat = repairMessage(ticket.maintenance_status, status);
  if (chat && ticket.status !== 'resolved' && ticket.status !== 'closed') await postSystemMessage(env.DB, ticket.id, chat);

  if (next) {
    const updated = await getTicket(env.DB, ticket.id);
    if (updated) await publishEvent(env, 'ticket.status_changed', updated, { from: ticket.status, source: 'maintenance' });
  }
  return { outcome: 'applied', ticketStatus: next ?? ticket.status };
}
