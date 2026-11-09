/**
 * Input checks for the two Team 10 integration points — PURE (easy to unit test).
 * Owner: P3 (Maintenance Integration)
 */

export type WebhookEvent = { eventId: string; type: 'maintenance.status_changed'; workOrderId: string; status: string };

const WORK_ORDER_ID = /^[A-Za-z0-9._-]{1,64}$/;

/**
 * A work order id typed by the admin: 1–64 characters of letters, digits, . _ - (it goes into a URL path).
 * Our own ticket numbers (TKT-…) are rejected with a hint: they are the other number of the pair.
 */
export function validateWorkOrderId(value: unknown): { ok: true; id: string } | { ok: false; message: string } {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!id) return { ok: false, message: 'กรุณาใส่เลขใบงานที่ Team 10 ออกให้' };
  if (/^tkt-/i.test(id)) return { ok: false, message: 'นี่คือเลขคำร้องของเรา ให้ใส่เลขใบงานที่ Team 10 ออกให้ (เช่น WO-0045)' };
  if (!WORK_ORDER_ID.test(id)) return { ok: false, message: 'เลขใบงานใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข . _ - ไม่เกิน 64 ตัว' };
  return { ok: true, id };
}

/** The shared webhook envelope (Integration Proposal §5). Personal data is never part of it. */
export function parseWebhookEvent(body: unknown): { ok: true; event: WebhookEvent } | { ok: false; message: string } {
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const data = (typeof b.data === 'object' && b.data !== null ? b.data : {}) as Record<string, unknown>;
  const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null);

  const eventId = text(b.eventId, 128);
  if (!eventId) return { ok: false, message: 'ต้องมี eventId' };
  if (b.type !== 'maintenance.status_changed') return { ok: false, message: "type ต้องเป็น 'maintenance.status_changed'" };
  const workOrderId = text(data.workOrderId, 64);
  if (!workOrderId) return { ok: false, message: 'ต้องมี data.workOrderId' };
  const status = text(data.status, 64);
  if (!status) return { ok: false, message: 'ต้องมี data.status' };
  return { ok: true, event: { eventId, type: 'maintenance.status_changed', workOrderId, status } };
}
