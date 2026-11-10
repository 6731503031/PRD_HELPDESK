/**
 * Automatic chat messages ("system messages") — posted into the ticket chat when something happens, so the
 * requester follows the work without opening the ticket page. Change the wording here only.
 * Owner: P2 (Comments & Events)
 *
 * Shown as a grey line in the middle of the chat, not as anyone's bubble. Stored as a normal comment whose
 * author_id is SYSTEM_AUTHOR_ID (0), so no schema change is needed.
 */

/** author_id of automatic messages. Real users start at 1, guests at 1000. */
export const SYSTEM_AUTHOR_ID = 0;
export const SYSTEM_AUTHOR_NAME = 'Automatic update';

export const MESSAGES = {
  started: 'The Helpdesk team has started working on your ticket. Feel free to add anything else in this chat.',
  sentToMaintenance: 'Your request has been sent to Maintenance. A technician will visit the reported location, and progress will be posted in this chat.',
  repairStarted: 'A technician is working on the repair.',
  repairDone: 'Maintenance reports the repair is complete. Please check, and reply in this chat if the problem remains.',
  repairCancelled: 'Maintenance has cancelled the work order. The Helpdesk team will review it and update you.',
  resolved: (note: string | null) => (note ? `Ticket resolved. Summary: ${note}` : 'Ticket resolved.'),
} as const;

/**
 * Which message (if any) a Team 10 status change deserves. Only real progress is announced, once:
 * reported/assigned say nothing (the "sent" message already covered it), and a repeat of the same stage is silent.
 */
export function repairMessage(previous: string | null, next: string): string | null {
  const stage = (s: string | null) =>
    s === 'in_progress' ? 'working' : s === 'resolved' || s === 'completed' || s === 'closed' ? 'done' : s === 'cancelled' ? 'cancelled' : 'waiting';
  if (stage(previous) === stage(next)) return null;
  switch (stage(next)) {
    case 'working':
      return MESSAGES.repairStarted;
    case 'done':
      return MESSAGES.repairDone;
    case 'cancelled':
      return MESSAGES.repairCancelled;
    default:
      return null;
  }
}

/**
 * Post an automatic message. Never breaks the action that caused it: a failure is only logged.
 * Also bumps the ticket's updated_at, like a normal chat message (FR-05).
 */
export async function postSystemMessage(db: D1Database, ticketId: number, content: string): Promise<void> {
  try {
    await db.batch([
      db.prepare('INSERT INTO ticket_comments (ticket_id, author_id, content) VALUES (?, ?, ?)').bind(ticketId, SYSTEM_AUTHOR_ID, content),
      db.prepare(`UPDATE tickets SET updated_at = datetime('now') WHERE id = ?`).bind(ticketId),
    ]);
  } catch (err) {
    console.warn(JSON.stringify({ level: 'warn', msg: 'system message failed', ticketId, error: String(err) }));
  }
}
