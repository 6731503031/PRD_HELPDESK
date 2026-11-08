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
  if (!text) return 'กรุณาพิมพ์ข้อความ';
  if (text.length > 2000) return 'ข้อความยาวเกิน 2,000 ตัวอักษร';
  return null;
}
