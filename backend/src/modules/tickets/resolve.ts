/**
 * Resolve a ticket — one place for every way a ticket gets resolved:
 *   - the admin's Resolve button (FR-13)
 *   - Wellbeing (Team 16) accepting a referral (wellbeing/referral.ts)
 * Same row update, history row, chat message and `ticket.resolved` event either way.
 * Owner: P1 (Core & Tickets)
 */
import type { Bindings } from '../../core/env';
import { postSystemMessage } from '../comments/templates';
import { publishEvent } from '../events/publish';
import { getTicket, recordStatus, type TicketRow } from './repo';
import type { TicketStatus } from './rules';

export type ResolveInput = {
  /** Who resolved it: the admin's id, or null for a partner system. */
  by: number | null;
  source: 'helpdesk' | 'wellbeing';
  /** Shown to the requester as the resolution summary. */
  resolutionNote: string | null;
  /** The note on the history row. */
  historyNote: string | null;
  /** The automatic chat message. */
  chat: string;
};

export async function resolveTicket(env: Bindings, ticket: { id: number; status: TicketStatus }, input: ResolveInput): Promise<TicketRow> {
  await env.DB
    .prepare(
      `UPDATE tickets SET status = 'resolved', resolved_at = datetime('now'), resolution_note = ?, updated_at = datetime('now') WHERE id = ?`,
    )
    .bind(input.resolutionNote, ticket.id)
    .run();
  await recordStatus(env.DB, ticket.id, ticket.status, 'resolved', input.by, input.source, input.historyNote);
  await postSystemMessage(env.DB, ticket.id, input.chat);

  const updated = (await getTicket(env.DB, ticket.id))!;
  await publishEvent(env, 'ticket.resolved', updated);
  return updated;
}
