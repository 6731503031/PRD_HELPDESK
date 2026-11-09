/**
 * Maintenance integration endpoints (PRD §6, §9.2).
 * Owner: P3 (Maintenance Integration)
 *
 *   POST /tickets/:id/send-maintenance   { title?, description? }  admin only   (F13, main way)
 *   POST /tickets/:id/link-maintenance   { work_order_id }   admin only         (F13, backup way)
 *   POST /webhooks/maintenance           Team 10 -> us, HMAC-signed             (F14, F29)
 *
 * Two numbers, one pair: our ticket number (TKT-…) goes to Team 10, their work order id comes back and is
 * stored on the ticket. Main way: Helpdesk creates the work order for the admin (send-maintenance), so the
 * admin never leaves Helpdesk. Backup way: the admin reports the repair in Team 10's own screen and pastes the
 * id here (link-maintenance). We store only that id and the last status (BR-04). No personal data is sent.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../core/env';
import { requireRole } from '../../core/auth';
import { ApiError, badRequest, conflict, notFound, parseId, readJson } from '../../core/http';
import { publishEvent } from '../events/publish';
import { getTicket, recordStatus, updateTicket } from '../tickets/repo';
import { createWorkOrder, fetchWorkOrder } from './client';
import { parseWebhookEvent, validateRepairRequest, validateWorkOrderId } from './envelope';
import { mapWorkOrderStatus, nextTicketStatus } from './mapping';
import { verifyWebhook } from './signature';

export const maintenanceRoutes = new Hono<AppEnv>();

/** PRD §6.2: a ticket has at most one ACTIVE work order. A cancelled one no longer counts, so the admin can link a new one. */
const hasActiveWorkOrder = (t: { maintenance_work_order_id: string | null; maintenance_status: string | null }) =>
  !!t.maintenance_work_order_id && t.maintenance_status !== 'cancelled';

/**
 * Use Case UC-08 comes after UC-07: the admin triages and starts the work (status in_progress) first, then sends
 * the repair. Open tickets are refused (the UI keeps step ② locked until then); finished tickets too.
 */
function assertReadyForRepair(t: { status: string; maintenance_work_order_id: string | null; maintenance_status: string | null }) {
  if (t.status === 'resolved' || t.status === 'closed') throw conflict('คำร้องนี้ปิดแล้ว ส่งต่อฝ่ายซ่อมบำรุงไม่ได้');
  if (t.status === 'open') throw conflict('กด "เริ่มดำเนินการ" ในขั้นที่ 1 ก่อน แล้วจึงส่งต่อฝ่ายซ่อมบำรุง');
  if (hasActiveWorkOrder(t)) throw conflict(`คำร้องนี้ผูกกับใบงาน ${t.maintenance_work_order_id} อยู่แล้ว`);
}

const nowSql = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const TEAM10_DOWN = 'เชื่อมต่อระบบ Team 10 ไม่ได้ ลองใหม่ภายหลัง (ส่วนอื่นของ Helpdesk ใช้งานได้ตามปกติ)';

// ---------- F13 Send (main way): Helpdesk creates the work order at Team 10 and links it ----------
maintenanceRoutes.post('/tickets/:id/send-maintenance', requireRole('admin'), async (c) => {
  const user = c.get('user');
  const body = await readJson<{ title?: unknown; description?: unknown }>(c);

  const ticket = await getTicket(c.env.DB, parseId(c.req.param('id')));
  if (!ticket) throw notFound('ไม่พบคำร้อง');
  assertReadyForRepair(ticket);

  const repair = validateRepairRequest(body, { title: ticket.title, description: ticket.description });
  if (!repair.ok) throw badRequest(repair.message);

  // Team 10 answers 3 s at most; if it is down, nothing is saved and the rest of Helpdesk keeps working.
  const sent = await createWorkOrder(
    c.env,
    { ticketRef: ticket.ticket_number, title: repair.title, description: repair.description },
    c.get('correlationId'),
  );
  if (sent.kind === 'rejected') throw badRequest(`Team 10 ไม่รับคำขอ: ${sent.message}`);
  if (sent.kind === 'unavailable') {
    console.warn(JSON.stringify({ level: 'warn', msg: 'maintenance create failed', reason: sent.reason, ticket: ticket.ticket_number }));
    throw new ApiError(503, 'ServiceUnavailable', TEAM10_DOWN, { reason: sent.reason });
  }

  const id = validateWorkOrderId(sent.workOrder.id);
  if (!id.ok) {
    console.warn(JSON.stringify({ level: 'warn', msg: 'maintenance create: odd work order id', ticket: ticket.ticket_number }));
    throw new ApiError(503, 'ServiceUnavailable', 'Team 10 ตอบเลขใบงานที่ใช้ไม่ได้ กรุณาแจ้งทีม', { reason: 'bad id' });
  }
  const other = await c.env.DB.prepare('SELECT ticket_number FROM tickets WHERE maintenance_work_order_id = ? AND id != ?')
    .bind(id.id, ticket.id)
    .first<{ ticket_number: string }>();
  if (other) throw conflict(`Team 10 ตอบใบงาน ${id.id} ซึ่งผูกกับคำร้อง ${other.ticket_number} อยู่แล้ว`);

  await updateTicket(c.env.DB, ticket.id, {
    maintenance_work_order_id: id.id,
    maintenance_status: sent.workOrder.status,
    maintenance_status_at: nowSql(),
  });
  await recordStatus(c.env.DB, ticket.id, ticket.status, ticket.status, user.id, 'helpdesk', `ส่งแจ้งซ่อมให้ Team 10 ได้ใบงาน ${id.id}`);
  await publishEvent(c.env, 'ticket.work_order_linked', ticket, { workOrderId: id.id });

  return c.json({
    ticket_number: ticket.ticket_number,
    maintenance_work_order_id: id.id,
    work_order_status: sent.workOrder.status,
  });
});

// ---------- F13 Link (backup way) ----------
maintenanceRoutes.post('/tickets/:id/link-maintenance', requireRole('admin'), async (c) => {
  const user = c.get('user');
  const checked = validateWorkOrderId((await readJson<{ work_order_id?: unknown }>(c)).work_order_id);
  if (!checked.ok) throw badRequest(checked.message);

  const ticket = await getTicket(c.env.DB, parseId(c.req.param('id')));
  if (!ticket) throw notFound('ไม่พบคำร้อง');
  assertReadyForRepair(ticket);

  const other = await c.env.DB.prepare('SELECT ticket_number FROM tickets WHERE maintenance_work_order_id = ? AND id != ?')
    .bind(checked.id, ticket.id)
    .first<{ ticket_number: string }>();
  if (other) throw conflict(`ใบงาน ${checked.id} ผูกกับคำร้อง ${other.ticket_number} อยู่แล้ว`);

  // Ask Team 10 whether it exists (3 s timeout). They being down must not break anything else in Helpdesk.
  const found = await fetchWorkOrder(c.env, checked.id, c.get('correlationId'));
  if (found.kind === 'not_found') throw badRequest(`ไม่พบใบงาน ${checked.id} ในระบบ Team 10`);
  if (found.kind === 'unavailable') {
    console.warn(JSON.stringify({ level: 'warn', msg: 'maintenance lookup failed', reason: found.reason, workOrderId: checked.id }));
    throw new ApiError(503, 'ServiceUnavailable', TEAM10_DOWN, { reason: found.reason });
  }

  await updateTicket(c.env.DB, ticket.id, {
    maintenance_work_order_id: checked.id,
    maintenance_status: found.workOrder.status,
    maintenance_status_at: nowSql(),
  });
  await recordStatus(c.env.DB, ticket.id, ticket.status, ticket.status, user.id, 'helpdesk', `ผูกใบงานซ่อม ${checked.id}`);
  await publishEvent(c.env, 'ticket.work_order_linked', ticket, { workOrderId: checked.id });

  return c.json({
    ticket_number: ticket.ticket_number,
    maintenance_work_order_id: checked.id,
    work_order_status: found.workOrder.status,
  });
});

// ---------- F14 + F29 Webhook (Team 10 is a service, not a user: no requireAuth) ----------
maintenanceRoutes.post('/webhooks/maintenance', async (c) => {
  // The signature covers the RAW bytes, so read the text before anything parses it.
  const rawBody = await c.req.text();
  const verdict = await verifyWebhook({
    secret: c.env.MAINTENANCE_WEBHOOK_SECRET,
    timestamp: c.req.header('x-timestamp'),
    signature: c.req.header('x-signature'),
    rawBody,
    now: new Date(),
  });
  if (!verdict.ok) {
    if (verdict.reason === 'not configured') throw new ApiError(503, 'ServiceUnavailable', 'ฝั่ง Helpdesk ยังไม่ได้ตั้งค่า secret สำหรับ webhook');
    throw new ApiError(401, 'Unauthorized', `ลายเซ็นไม่ถูกต้อง (${verdict.reason})`);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw badRequest('ซองข้อมูลไม่ใช่ JSON');
  }
  const parsed = parseWebhookEvent(body);
  if (!parsed.ok) throw badRequest(parsed.message);
  const { eventId, type, workOrderId, status } = parsed.event;

  const effect = mapWorkOrderStatus(status);
  if (!effect) throw badRequest(`ไม่รู้จักสถานะ ${status}`);

  // Idempotency: an event we already applied changes nothing and is answered 200.
  const seen = await c.env.DB.prepare('SELECT 1 AS x FROM processed_events WHERE event_id = ?').bind(eventId).first();
  if (seen) return c.json({ received: true, duplicate: true });

  const ticket = await c.env.DB.prepare(
    `SELECT id, ticket_number, status FROM tickets WHERE maintenance_work_order_id = ?`,
  )
    .bind(workOrderId)
    .first<{ id: number; ticket_number: string; status: 'open' | 'in_progress' | 'resolved' | 'closed' }>();
  if (!ticket) return c.json({ received: true, linked: false }, 202); // valid event, no ticket linked to this work order

  const next = nextTicketStatus(ticket.status, effect);
  const sets = ['maintenance_status = ?', "maintenance_status_at = datetime('now')", "updated_at = datetime('now')"];
  const values: unknown[] = [status];
  if (next) {
    sets.push('status = ?');
    values.push(next);
  }

  // One atomic batch: the event id is stored only if the ticket update and its history row also succeed.
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`INSERT INTO processed_events (event_id, source, type) VALUES (?, 'maintenance', ?)`).bind(eventId, type),
      c.env.DB.prepare(`UPDATE tickets SET ${sets.join(', ')} WHERE id = ?`).bind(...values, ticket.id),
      c.env.DB.prepare(
        `INSERT INTO ticket_status_history (ticket_id, from_status, to_status, changed_by, source, note) VALUES (?, ?, ?, NULL, 'maintenance', ?)`,
      ).bind(ticket.id, ticket.status, next ?? ticket.status, effect.label),
    ]);
  } catch (err) {
    if (String(err).includes('UNIQUE')) return c.json({ received: true, duplicate: true }); // the same event raced us
    throw err;
  }

  if (next) {
    const updated = await getTicket(c.env.DB, ticket.id);
    if (updated) await publishEvent(c.env, 'ticket.status_changed', updated, { from: ticket.status, source: 'maintenance' });
  }
  return c.json({ received: true });
});
