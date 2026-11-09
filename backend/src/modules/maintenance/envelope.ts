/**
 * Input checks for the Team 10 integration points — PURE (easy to unit test).
 * Owner: P3 (Maintenance Integration)
 */

/** Same limits as a ticket's subject and description (tickets/rules.ts). */
export const REPAIR_TITLE_MAX = 150;
export const REPAIR_DESCRIPTION_MAX = 5000;
export const REPAIR_LOCATION_MAX = 200;

/** Team 10's work order categories — exactly these strings (their report form). */
export const REPAIR_CATEGORIES = ['Plumbing', 'Electrical', 'HVAC', 'Safety', 'Not sure'] as const;
export type RepairCategory = (typeof REPAIR_CATEGORIES)[number];

export type RepairRequest = { title: string; description: string; location: string; category: RepairCategory };

/**
 * The repair the admin sends to Team 10. Title and description fall back to the ticket's own text; location and
 * category are chosen by the admin (our tickets have no location). The admin sees and can edit everything before
 * sending, so personal details can be taken out.
 */
export function validateRepairRequest(
  body: { title?: unknown; description?: unknown; location?: unknown; category?: unknown },
  fallback: { title: string; description: string },
): ({ ok: true } & RepairRequest) | { ok: false; message: string } {
  const pick = (v: unknown, d: string) => (typeof v === 'string' ? v : d).trim();
  const title = pick(body.title, fallback.title);
  const description = pick(body.description, fallback.description);
  const location = pick(body.location, '');
  const category = pick(body.category, '');
  if (title.length < 3) return { ok: false, message: 'กรุณาใส่หัวเรื่องงานซ่อมอย่างน้อย 3 ตัวอักษร' };
  if (title.length > REPAIR_TITLE_MAX) return { ok: false, message: `หัวเรื่องยาวเกิน ${REPAIR_TITLE_MAX} ตัวอักษร` };
  if (location.length < 2) return { ok: false, message: 'กรุณาใส่สถานที่ (เช่น อาคาร ห้อง) ให้ช่างหาเจอ' };
  if (location.length > REPAIR_LOCATION_MAX) return { ok: false, message: `สถานที่ยาวเกิน ${REPAIR_LOCATION_MAX} ตัวอักษร` };
  if (!REPAIR_CATEGORIES.includes(category as RepairCategory)) {
    return { ok: false, message: `ประเภทงานซ่อมต้องเป็น ${REPAIR_CATEGORIES.join(', ')}` };
  }
  if (description.length < 5) return { ok: false, message: 'กรุณาอธิบายงานซ่อมอย่างน้อย 5 ตัวอักษร' };
  if (description.length > REPAIR_DESCRIPTION_MAX) return { ok: false, message: `รายละเอียดยาวเกิน ${REPAIR_DESCRIPTION_MAX.toLocaleString('en-US')} ตัวอักษร` };
  return { ok: true, title, description, location, category: category as RepairCategory };
}

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
