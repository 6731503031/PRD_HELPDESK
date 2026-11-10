/**
 * Maintenance integration endpoints (PRD §6, §9.2).
 * Owner: P3 (Maintenance Integration)
 *
 *   POST /tickets/:id/send-maintenance   { title?, description?, location, category }  admin only   (F13, main way)
 *   POST /tickets/:id/link-maintenance   { work_order_id }   admin only         (F13, backup way)
 *   POST /webhooks/maintenance           Team 10 -> us, HMAC-signed             (F14, F29)
 *   POST /tickets/:id/sync-maintenance   admin only: ask Team 10 for the latest status (when a webhook was missed)
 *   (cron, every 15 min)                 same sync for open work orders — see sync.ts and src/index.ts
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
import { applyWorkOrderStatus } from './apply';
import { CREATE_NOT_SUPPORTED, createWorkOrder, fetchWorkOrder } from './client';
import { parseWebhookEvent, validateRepairRequest, validateWorkOrderId } from './envelope';
import { mapWorkOrderStatus } from './mapping';
import { verifyWebhook } from './signature';
import { logSync, syncWorkOrder } from './sync';
import { MESSAGES, postSystemMessage } from '../comments/templates';

export const maintenanceRoutes = new Hono<AppEnv>();

/** PRD §6.2: a ticket has at most one ACTIVE work order. A cancelled one no longer counts, so the admin can link a new one. */
const hasActiveWorkOrder = (t: { maintenance_work_order_id: string | null; maintenance_status: string | null }) =>
  !!t.maintenance_work_order_id && t.maintenance_status !== 'cancelled';

/**
 * Use Case UC-08 comes after UC-07: the admin triages and starts the work (status in_progress) first, then sends
 * the repair. Open tickets are refused (the UI keeps step ② locked until then); finished tickets too.
 */
function assertReadyForRepair(t: { status: string; maintenance_work_order_id: string | null; maintenance_status: string | null }) {
  if (t.status === 'resolved' || t.status === 'closed') throw conflict('This ticket is resolved and cannot be sent to Maintenance');
  if (t.status === 'open') throw conflict('Press "Start work" in step 1 before sending to Maintenance');
  if (hasActiveWorkOrder(t)) throw conflict(`This ticket is already linked to work order ${t.maintenance_work_order_id}`);
}

const nowSql = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const TEAM10_DOWN = 'Cannot reach Team 10. Please try again later (the rest of Helpdesk works as usual).';

// ---------- F13 Send (main way): Helpdesk creates the work order at Team 10 and links it ----------
maintenanceRoutes.post('/tickets/:id/send-maintenance', requireRole('admin'), async (c) => {
  const user = c.get('user');
  const body = await readJson<{ title?: unknown; description?: unknown; location?: unknown; category?: unknown }>(c);

  const ticket = await getTicket(c.env.DB, parseId(c.req.param('id')));
  if (!ticket) throw notFound('Ticket not found');
  assertReadyForRepair(ticket);

  const repair = validateRepairRequest(body, { title: ticket.title, description: ticket.description, location: ticket.location ?? '' });
  if (!repair.ok) throw badRequest(repair.message);

  // Team 10 answers 3 s at most; if it is down, nothing is saved and the rest of Helpdesk keeps working.
  const sent = await createWorkOrder(
    c.env,
    {
      ticketRef: ticket.ticket_number,
      title: repair.title,
      description: repair.description,
      location: repair.location,
      category: repair.category,
    },
    c.get('correlationId'),
  );
  if (sent.kind === 'rejected') throw badRequest(`Team 10 rejected the request: ${sent.message}`);
  if (sent.kind === 'unavailable') {
    console.warn(JSON.stringify({ level: 'warn', msg: 'maintenance create failed', reason: sent.reason, ticket: ticket.ticket_number }));
    const message =
      sent.reason === CREATE_NOT_SUPPORTED
        ? 'Team 10 does not accept requests from Helpdesk yet. Report the repair in Team 10\'s system, then use "Link a work order manually" in step 2.'
        : TEAM10_DOWN;
    throw new ApiError(503, 'ServiceUnavailable', message, { reason: sent.reason });
  }

  const id = validateWorkOrderId(sent.workOrder.id);
  if (!id.ok) {
    console.warn(JSON.stringify({ level: 'warn', msg: 'maintenance create: odd work order id', ticket: ticket.ticket_number }));
    throw new ApiError(503, 'ServiceUnavailable', 'Team 10 returned an invalid work order number. Please contact the team.', { reason: 'bad id' });
  }
  const other = await c.env.DB.prepare('SELECT ticket_number FROM tickets WHERE maintenance_work_order_id = ? AND id != ?')
    .bind(id.id, ticket.id)
    .first<{ ticket_number: string }>();
  if (other) throw conflict(`Team 10 returned work order ${id.id}, which is already linked to ${other.ticket_number}`);

  await updateTicket(c.env.DB, ticket.id, {
    maintenance_work_order_id: id.id,
    maintenance_status: sent.workOrder.status,
    maintenance_status_at: nowSql(),
    maintenance_category: repair.category,
    // An older ticket without a location keeps the one the admin typed, so it shows on the ticket too.
    ...(ticket.location ? {} : { location: repair.location }),
  });
  await recordStatus(c.env.DB, ticket.id, ticket.status, ticket.status, user.id, 'helpdesk', `Sent to Team 10, work order ${id.id}`);
  await publishEvent(c.env, 'ticket.work_order_linked', ticket, { workOrderId: id.id });
  await postSystemMessage(c.env.DB, ticket.id, MESSAGES.sentToMaintenance);

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
  if (!ticket) throw notFound('Ticket not found');
  assertReadyForRepair(ticket);

  const other = await c.env.DB.prepare('SELECT ticket_number FROM tickets WHERE maintenance_work_order_id = ? AND id != ?')
    .bind(checked.id, ticket.id)
    .first<{ ticket_number: string }>();
  if (other) throw conflict(`Work order ${checked.id} is already linked to ${other.ticket_number}`);

  // Ask Team 10 whether it exists (3 s timeout). They being down must not break anything else in Helpdesk.
  const found = await fetchWorkOrder(c.env, checked.id, c.get('correlationId'));
  if (found.kind === 'not_found') throw badRequest(`Work order ${checked.id} was not found in Team 10's system`);
  if (found.kind === 'unavailable') {
    console.warn(JSON.stringify({ level: 'warn', msg: 'maintenance lookup failed', reason: found.reason, workOrderId: checked.id }));
    throw new ApiError(503, 'ServiceUnavailable', TEAM10_DOWN, { reason: found.reason });
  }

  await updateTicket(c.env.DB, ticket.id, {
    maintenance_work_order_id: checked.id,
    maintenance_status: found.workOrder.status,
    maintenance_status_at: nowSql(),
    maintenance_category: null, // linked by hand: the category was chosen in Team 10's own screen
  });
  await recordStatus(c.env.DB, ticket.id, ticket.status, ticket.status, user.id, 'helpdesk', `Linked work order ${checked.id}`);
  await publishEvent(c.env, 'ticket.work_order_linked', ticket, { workOrderId: checked.id });
  await postSystemMessage(c.env.DB, ticket.id, MESSAGES.sentToMaintenance);

  return c.json({
    ticket_number: ticket.ticket_number,
    maintenance_work_order_id: checked.id,
    work_order_status: found.workOrder.status,
  });
});

// ---------- F14 + F29 Webhook (Team 10 is a service, not a user: no requireAuth) ----------
maintenanceRoutes.post('/webhooks/maintenance', async (c) => {
  // Diagnostics: one JSON line per webhook with its outcome, so a rejected event can be explained from the logs.
  // Never the body, the signature or the secret — only ids, the status word and field NAMES (no personal data).
  const trace = (http: number, outcome: string, extra: Record<string, unknown> = {}) =>
    console.log(JSON.stringify({ level: http >= 400 ? 'warn' : 'info', msg: 'maintenance webhook', http, outcome, correlationId: c.get('correlationId'), ...extra }));
  const short = (v: unknown) => (typeof v === 'string' ? v.slice(0, 64) : v === undefined ? undefined : typeof v);

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
    const ts = Number(c.req.header('x-timestamp'));
    trace(verdict.reason === 'not configured' ? 503 : 401, `signature: ${verdict.reason}`, {
      hasTimestamp: !!c.req.header('x-timestamp'),
      hasSignature: !!c.req.header('x-signature'),
      skewSeconds: Number.isFinite(ts) ? Math.round(Date.now() / 1000 - ts) : undefined,
      bodyBytes: rawBody.length,
    });
    if (verdict.reason === 'not configured') throw new ApiError(503, 'ServiceUnavailable', 'The Helpdesk webhook secret is not configured');
    throw new ApiError(401, 'Unauthorized', `Invalid signature (${verdict.reason})`);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    trace(400, 'body is not JSON', { bodyBytes: rawBody.length });
    throw badRequest('Body is not valid JSON');
  }
  const parsed = parseWebhookEvent(body);
  if (!parsed.ok) {
    const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
    const d = (typeof b.data === 'object' && b.data !== null ? b.data : {}) as Record<string, unknown>;
    trace(400, `envelope: ${parsed.message}`, { type: short(b.type), keys: Object.keys(b), dataKeys: Object.keys(d) });
    throw badRequest(parsed.message);
  }
  const { eventId, type, workOrderId, status } = parsed.event;

  const effect = mapWorkOrderStatus(status);
  if (!effect) {
    trace(400, 'unknown status', { eventId, workOrderId, status: short(status) });
    throw badRequest(`Unknown status ${status}`);
  }

  // Idempotency: an event we already applied changes nothing and is answered 200.
  const seen = await c.env.DB.prepare('SELECT 1 AS x FROM processed_events WHERE event_id = ?').bind(eventId).first();
  if (seen) {
    trace(200, 'duplicate event id, ignored', { eventId, workOrderId, status });
    return c.json({ received: true, duplicate: true });
  }

  const ticket = await c.env.DB.prepare(
    `SELECT id, ticket_number, status, maintenance_status FROM tickets WHERE maintenance_work_order_id = ?`,
  )
    .bind(workOrderId)
    .first<{ id: number; ticket_number: string; status: 'open' | 'in_progress' | 'resolved' | 'closed'; maintenance_status: string | null }>();
  if (!ticket) {
    trace(202, 'no ticket linked to this work order', { eventId, workOrderId, status });
    return c.json({ received: true, linked: false }, 202); // valid event, no ticket linked to this work order
  }

  const result = await applyWorkOrderStatus(c.env, ticket, status, effect, { id: eventId, type });
  if (result.outcome === 'duplicate') {
    trace(200, 'duplicate event id (race), ignored', { eventId, workOrderId, status });
    return c.json({ received: true, duplicate: true }); // the same event raced us
  }
  trace(200, 'applied', { eventId, workOrderId, status, ticket: ticket.ticket_number, ticketStatus: result.ticketStatus });
  return c.json({ received: true });
});

// ---------- Sync: ask Team 10 for the latest status (the admin's "Check repair status" button) ----------
// Works even when Team 10's webhook never arrives. Only forward progress is applied; nothing changes otherwise.
maintenanceRoutes.post('/tickets/:id/sync-maintenance', requireRole('admin'), async (c) => {
  const ticket = await getTicket(c.env.DB, parseId(c.req.param('id')));
  if (!ticket) throw notFound('Ticket not found');
  const workOrderId = ticket.maintenance_work_order_id;
  if (!workOrderId) throw conflict('This ticket is not linked to a work order');

  const outcome = await syncWorkOrder(c.env, { ...ticket, maintenance_work_order_id: workOrderId }, c.get('correlationId'));
  logSync('admin', ticket.ticket_number, workOrderId, outcome);
  if (outcome.kind === 'unavailable') throw new ApiError(503, 'ServiceUnavailable', TEAM10_DOWN, { reason: outcome.reason });
  if (outcome.kind === 'not_found') throw notFound(`Team 10 does not know work order ${workOrderId}`);

  const team10 = outcome.kind === 'changed' ? outcome.to : outcome.team10;
  return c.json({
    data: {
      changed: outcome.kind === 'changed',
      team10_status: team10,
      known_status: outcome.kind !== 'unknown_status',
      maintenance_status: outcome.kind === 'changed' ? outcome.to : ticket.maintenance_status,
    },
  });
});
