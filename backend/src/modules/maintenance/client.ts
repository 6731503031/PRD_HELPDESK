/**
 * REST client for Team 10 Maintenance (Integration Proposal §5).
 * Owner: P3 (Maintenance Integration)
 */
import type { Bindings } from '../../core/env';

export type WorkOrder = { id: string; title?: string; location?: string; status: string };

export type FetchResult =
  | { kind: 'found'; workOrder: WorkOrder }
  | { kind: 'not_found' }
  | { kind: 'unavailable'; reason: string };

export const MAINTENANCE_TIMEOUT_MS = 3000;

/**
 * TODO(P3, F13): GET {MAINTENANCE_API_URL}/work-orders/{id}
 *  - headers: X-Correlation-Id (pass in), auth header agreed with Team 10
 *  - signal: AbortSignal.timeout(MAINTENANCE_TIMEOUT_MS)
 *  - 200 → found, 404 → not_found, anything else / network error → unavailable
 *  - MAINTENANCE_API_URL empty → unavailable('not configured')
 *  While Team 10 is not live: you may return a mock when env.ENVIRONMENT === 'development'
 *  and id starts with 'WO-MOCK-' — say so in the presentation.
 */
export async function fetchWorkOrder(env: Bindings, id: string, correlationId: string): Promise<FetchResult> {
  void env;
  void id;
  void correlationId;
  return { kind: 'unavailable', reason: 'not implemented' }; // TODO(P3, F13)
}
