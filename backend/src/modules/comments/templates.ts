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
export const SYSTEM_AUTHOR_NAME = 'แจ้งเตือนอัตโนมัติ';

export const MESSAGES = {
  started: 'ผู้ดูแลรับเรื่องแล้ว กำลังดำเนินการ มีอะไรเพิ่มเติมพิมพ์ในแชทนี้ได้เลย',
  sentToMaintenance: 'ส่งเรื่องให้ฝ่ายซ่อมบำรุงแล้ว ช่างจะเข้าไปดูตามสถานที่ที่แจ้งไว้ ความคืบหน้าจะแจ้งในแชทนี้',
  repairStarted: 'ช่างกำลังดำเนินการซ่อม',
  repairDone: 'ช่างแจ้งว่าซ่อมเสร็จแล้ว รบกวนตรวจสอบ ถ้ายังมีปัญหาตอบในแชทนี้ได้',
  repairCancelled: 'ฝ่ายซ่อมบำรุงยกเลิกใบงาน ผู้ดูแลจะตรวจสอบและแจ้งอีกครั้ง',
  resolved: (note: string | null) => (note ? `ปิดคำร้องแล้ว สรุปการแก้ไข: ${note}` : 'ปิดคำร้องแล้ว'),
} as const;

/**
 * Which message (if any) a Team 10 status change deserves. Only real progress is announced, once:
 * reported/assigned say nothing (the "sent" message already covered it), and a repeat of the same stage is silent.
 */
export function repairMessage(previous: string | null, next: string): string | null {
  const stage = (s: string | null) =>
    s === 'in_progress' ? 'working' : s === 'completed' || s === 'closed' ? 'done' : s === 'cancelled' ? 'cancelled' : 'waiting';
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
