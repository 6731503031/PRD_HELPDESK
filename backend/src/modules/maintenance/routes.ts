/**
 * Maintenance integration endpoints (PRD §6, §9.2).
 * Owner: P3 (Maintenance Integration)
 *
 *   POST /tickets/:id/link-maintenance   { work_order_id }   agent/admin only   (F13)
 *   POST /webhooks/maintenance           Team 10 → us, HMAC-signed           (F14, F29)
 *
 * The UI already calls link-maintenance and shows `maintenance_status`
 * on the ticket (public/js/pages/ticket-detail.js).
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../core/env';
import { notImplemented } from '../../core/http';

export const maintenanceRoutes = new Hono<AppEnv>();

/**
 * TODO(P3, F13) — mounted behind requireAuth, so c.get('user') exists.
 *  1. requireRole('agent','admin') (core/auth.ts)
 *  2. body.work_order_id: non-empty string, ≤ 64 chars → else 400
 *  3. ticket must exist (404); if it already has an active work order → 409 (PRD §6.2: at most one)
 *  4. fetchWorkOrder(...) → not_found → 400 ; unavailable → 503 (Helpdesk keeps working)
 *  5. UPDATE tickets SET maintenance_work_order_id, maintenance_status = workOrder.status
 *  6. publishEvent(env, 'ticket.work_order_linked', ticket, { workOrderId })
 *  7. 200 { ticket_number, maintenance_work_order_id, work_order_status }
 */
maintenanceRoutes.post('/tickets/:id/link-maintenance', async () => {
  throw notImplemented('F13 Link Maintenance Work Order', 'P3');
});

/**
 * TODO(P3, F14 + F29) — NOT behind requireAuth (Team 10 is a service, not a user).
 *  1. rawBody = await c.req.text()   (read raw text BEFORE parsing — the signature covers the raw bytes)
 *  2. verifyWebhook({ secret: c.env.MAINTENANCE_WEBHOOK_SECRET, timestamp: X-Timestamp, signature: X-Signature, rawBody, now })
 *     → not ok → 401
 *  3. JSON.parse → check envelope: eventId, type === 'maintenance.status_changed', data.workOrderId, data.status → else 400
 *  4. INSERT OR IGNORE INTO processed_events → if 0 rows changed → duplicate → 200 { duplicate: true }
 *  5. find ticket by maintenance_work_order_id → none → 202 { linked: false }
 *  6. effect = mapWorkOrderStatus(data.status) → null → 400
 *  7. UPDATE maintenance_status / maintenance_status_at ; if effect.ticketStatus → update status
 *     + recordStatus(db, id, from, to, null, 'maintenance', effect.label)   (tickets/repo.ts)
 *  8. 200 { received: true }
 */
maintenanceRoutes.post('/webhooks/maintenance', async () => {
  throw notImplemented('F14 Maintenance webhook', 'P3');
});
