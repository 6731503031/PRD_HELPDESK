/**
 * Escalation rule (PRD §14, BR-07).
 * Owner: P2 (Comments & Events)
 *
 *   Priority = urgent AND Status = open (admin has not started it) AND waiting > 1 hour
 *   → publish ticket.escalated (once — set tickets.escalated_at)
 *
 * Runs from the Cron Trigger in wrangler.toml (every 15 minutes) via
 * `scheduled()` in src/index.ts.
 */
import type { Bindings } from '../../core/env';
import type { Ticket } from '../tickets/rules';

export const ESCALATION_WAIT_MS = 60 * 60 * 1000;

/**
 * TODO(P2, F17): return true only when ALL three conditions hold and the ticket
 * was not escalated before (escalated_at is null).
 * Note: D1 stores created_at as 'YYYY-MM-DD HH:MM:SS' in UTC → parse with
 *   Date.parse(created_at.replace(' ', 'T') + 'Z')
 * Then un-skip the tests in test/escalation.test.ts.
 */
export function isEscalationDue(
  ticket: Pick<Ticket, 'priority' | 'status' | 'created_at' | 'escalated_at'>,
  now: Date,
): boolean {
  void ticket;
  void now;
  return false; // TODO(P2, F17)
}

/**
 * TODO(P2, F17):
 *  1. SELECT urgent + open + escalated_at IS NULL tickets.
 *  2. For each where isEscalationDue(...) → UPDATE escalated_at = datetime('now'),
 *     publishEvent(env, 'ticket.escalated', ticket), recordStatus? (optional note).
 */
export async function runEscalation(env: Bindings): Promise<{ escalated: number }> {
  void env;
  return { escalated: 0 };
}
