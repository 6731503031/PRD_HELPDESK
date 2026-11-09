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
 * The repair the admin sends to Team 10. Title, description and location fall back to the ticket's own values
 * (the requester typed the location); the category is chosen by the admin. The admin sees and can edit everything before
 * sending, so personal details can be taken out.
 */
export function validateRepairRequest(
  body: { title?: unknown; description?: unknown; location?: unknown; category?: unknown },
  fallback: { title: string; description: string; location?: string },
): ({ ok: true } & RepairRequest) | { ok: false; message: string } {
  const pick = (v: unknown, d: string) => (typeof v === 'string' ? v : d).trim();
  const title = pick(body.title, fallback.title);
  const description = pick(body.description, fallback.description);
  const location = pick(body.location, fallback.location ?? '');
  const category = pick(body.category, '');
  if (title.length < 3) return { ok: false, message: 'Please enter a repair title of at least 3 characters' };
  if (title.length > REPAIR_TITLE_MAX) return { ok: false, message: `Title must be ${REPAIR_TITLE_MAX} characters or fewer` };
  if (location.length < 2) return { ok: false, message: 'Please enter the location (e.g. building, room) so the technician can find it' };
  if (location.length > REPAIR_LOCATION_MAX) return { ok: false, message: `Location must be ${REPAIR_LOCATION_MAX} characters or fewer` };
  if (!REPAIR_CATEGORIES.includes(category as RepairCategory)) {
    return { ok: false, message: `Repair category must be one of: ${REPAIR_CATEGORIES.join(', ')}` };
  }
  if (description.length < 5) return { ok: false, message: 'Please describe the repair in at least 5 characters' };
  if (description.length > REPAIR_DESCRIPTION_MAX) return { ok: false, message: `Description must be ${REPAIR_DESCRIPTION_MAX.toLocaleString('en-US')} characters or fewer` };
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
  if (!id) return { ok: false, message: 'Please enter the work order number issued by Team 10' };
  if (/^tkt-/i.test(id)) return { ok: false, message: 'This is our own ticket number. Enter the work order number issued by Team 10.' };
  if (!WORK_ORDER_ID.test(id)) return { ok: false, message: 'A work order number may only contain letters, digits, . _ - (up to 64 characters)' };
  return { ok: true, id };
}

/** The shared webhook envelope (Integration Proposal §5). Personal data is never part of it. */
export function parseWebhookEvent(body: unknown): { ok: true; event: WebhookEvent } | { ok: false; message: string } {
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const data = (typeof b.data === 'object' && b.data !== null ? b.data : {}) as Record<string, unknown>;
  const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null);

  const eventId = text(b.eventId, 128);
  if (!eventId) return { ok: false, message: 'eventId is required' };
  if (b.type !== 'maintenance.status_changed') return { ok: false, message: "type must be 'maintenance.status_changed'" };
  const workOrderId = text(data.workOrderId, 64);
  if (!workOrderId) return { ok: false, message: 'data.workOrderId is required' };
  const status = text(data.status, 64);
  if (!status) return { ok: false, message: 'data.status is required' };
  return { ok: true, event: { eventId, type: 'maintenance.status_changed', workOrderId, status } };
}
