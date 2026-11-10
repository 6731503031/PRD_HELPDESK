/**
 * Sync: we ASK Team 10 for the status of a work order (GET /work-orders/{id}) instead of waiting for its webhook.
 * Used by the admin's "Check repair status" button and by the 15-minute cron, so the ticket history stays up to
 * date even when a webhook never arrives. Only forward progress is applied (mapping.ts shouldApplyPolledStatus).
 * Owner: P3 (Maintenance Integration)
 */
import type { Bindings } from '../../core/env';
import { applyWorkOrderStatus, type LinkedTicket } from './apply';
import { fetchWorkOrder } from './client';
import { mapWorkOrderStatus, shouldApplyPolledStatus } from './mapping';

export type SyncOutcome =
  | { kind: 'changed'; from: string | null; to: string }
  | { kind: 'unchanged'; team10: string }
  | { kind: 'unknown_status'; team10: string }
  | { kind: 'not_found' }
  | { kind: 'unavailable'; reason: string };

export async function syncWorkOrder(env: Bindings, ticket: LinkedTicket & { maintenance_work_order_id: string }, correlationId: string): Promise<SyncOutcome> {
  const found = await fetchWorkOrder(env, ticket.maintenance_work_order_id, correlationId);
  if (found.kind === 'not_found') return { kind: 'not_found' };
  if (found.kind === 'unavailable') return { kind: 'unavailable', reason: found.reason };

  const team10 = found.workOrder.status;
  const effect = mapWorkOrderStatus(team10);
  if (!effect) return { kind: 'unknown_status', team10 };
  if (!shouldApplyPolledStatus(ticket.maintenance_status, team10)) return { kind: 'unchanged', team10 };

  await applyWorkOrderStatus(env, ticket, team10, effect);
  return { kind: 'changed', from: ticket.maintenance_status, to: team10 };
}

/** Work orders checked per cron run: each call waits at most 3 s, so a run stays short and Team 10 sees little load. */
export const SYNC_BATCH = 20;

/** One log line per work order checked — ids and status words only, no personal data. */
export const logSync = (via: 'cron' | 'admin', ticket: string, workOrderId: string, outcome: SyncOutcome) =>
  console.log(JSON.stringify({ level: outcome.kind === 'unavailable' ? 'warn' : 'info', msg: 'maintenance sync', via, ticket, workOrderId, ...outcome }));

/** Cron: check the open work orders that were updated least recently. Skipped while no Team 10 URL is set (local dev). */
export async function syncOpenWorkOrders(env: Bindings): Promise<{ checked: number; changed: number; failed: number; skipped?: string }> {
  if (!(env.MAINTENANCE_API_URL ?? '').trim()) return { checked: 0, changed: 0, failed: 0, skipped: 'no Team 10 URL' };

  const { results } = await env.DB.prepare(
    `SELECT id, ticket_number, status, maintenance_status, maintenance_work_order_id FROM tickets
     WHERE maintenance_work_order_id IS NOT NULL
       AND status NOT IN ('resolved', 'closed')
       AND (maintenance_status IS NULL OR maintenance_status NOT IN ('closed', 'cancelled'))
     ORDER BY COALESCE(maintenance_status_at, updated_at) ASC
     LIMIT ?`,
  )
    .bind(SYNC_BATCH)
    .all<LinkedTicket & { maintenance_work_order_id: string }>();

  let changed = 0;
  let failed = 0;
  for (const ticket of results ?? []) {
    try {
      const outcome = await syncWorkOrder(env, ticket, `team14-sync-${crypto.randomUUID()}`);
      logSync('cron', ticket.ticket_number, ticket.maintenance_work_order_id, outcome);
      if (outcome.kind === 'changed') changed++;
      if (outcome.kind === 'unavailable' || outcome.kind === 'not_found') failed++;
    } catch (err) {
      failed++;
      console.error(JSON.stringify({ level: 'error', msg: 'maintenance sync failed', ticket: ticket.ticket_number, err: String(err) }));
    }
  }
  return { checked: results?.length ?? 0, changed, failed };
}
