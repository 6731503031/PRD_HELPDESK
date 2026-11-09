/**
 * Ticket chat rules — PURE (PRD FR-11).
 * Owner: P2 (Comments & Events)
 *
 * One conversation per ticket between the requester and the admin. Everyone who can open the ticket
 * sees every message. (Internal notes were cut in PRD v1.1.)
 */

export type Comment = {
  id: number;
  ticket_id: number;
  author_id: number;
  content: string;
  created_at: string;
};

/** Content checks: 1–2000 characters after trim. */
export function validateContent(content: unknown): string | null {
  const text = typeof content === 'string' ? content.trim() : '';
  if (!text) return 'Please type a message';
  if (text.length > 2000) return 'Message must be 2,000 characters or fewer';
  return null;
}
