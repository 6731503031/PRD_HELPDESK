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

/** Ids starting with this are answered locally while no Team 10 URL is configured (demo / development only). */
export const MOCK_PREFIX = 'WO-MOCK-';

/**
 * F13: GET {MAINTENANCE_API_URL}/work-orders/{id}  (Integration Proposal §5)
 *  - sends X-Correlation-Id, and `Authorization: Bearer <MAINTENANCE_API_KEY>` when a key is set
 *    (the scheme is still to be agreed with Team 10)
 *  - 200 -> found, 404 -> not_found, anything else / timeout / network error -> unavailable (never throws)
 *  - no MAINTENANCE_API_URL: only `WO-MOCK-*` ids work, and only when ENVIRONMENT is 'development'
 */
export async function fetchWorkOrder(env: Bindings, id: string, correlationId: string): Promise<FetchResult> {
  const base = (env.MAINTENANCE_API_URL ?? '').trim().replace(/\/+$/, '');
  if (!base) {
    if (env.ENVIRONMENT === 'development' && id.startsWith(MOCK_PREFIX)) {
      return { kind: 'found', workOrder: { id, title: '(ใบงานจำลอง)', location: '-', status: 'reported' } };
    }
    return { kind: 'unavailable', reason: 'not configured' };
  }
  try {
    const headers: Record<string, string> = { Accept: 'application/json', 'X-Correlation-Id': correlationId };
    if (env.MAINTENANCE_API_KEY) headers.Authorization = `Bearer ${env.MAINTENANCE_API_KEY}`;
    const res = await fetch(`${base}/work-orders/${encodeURIComponent(id)}`, {
      headers,
      signal: AbortSignal.timeout(MAINTENANCE_TIMEOUT_MS),
    });
    if (res.status === 404) return { kind: 'not_found' };
    if (!res.ok) return { kind: 'unavailable', reason: `HTTP ${res.status}` };
    const body = (await res.json()) as Record<string, unknown>;
    const wo = ((body.data as Record<string, unknown> | undefined) ?? body) as Partial<WorkOrder>; // accept {data:{…}} or the bare object
    if (typeof wo.status !== 'string' || !wo.status) return { kind: 'unavailable', reason: 'unexpected response' };
    return { kind: 'found', workOrder: { id: String(wo.id ?? id), title: wo.title, location: wo.location, status: wo.status } };
  } catch (err) {
    return { kind: 'unavailable', reason: err instanceof Error ? err.name : 'error' };
  }
}
