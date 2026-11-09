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

/** Reason given when Team 10 has no POST /work-orders (404/405). */
export const CREATE_NOT_SUPPORTED = 'create not supported';

/**
 * What Helpdesk sends to create a work order (shape agreed with Team 10). No personal data: the admin checks the
 * text before sending. `category` is one of Team 10's five values (envelope.ts REPAIR_CATEGORIES).
 */
export type NewWorkOrder = { ticketRef: string; title: string; description: string; location: string; category: string };

export type CreateResult =
  | { kind: 'created'; workOrder: WorkOrder }
  | { kind: 'rejected'; message: string }
  | { kind: 'unavailable'; reason: string };

/**
 * Send a repair to Team 10 so the admin never has to leave Helpdesk:
 *   POST {MAINTENANCE_API_URL}/work-orders  { ticketRef, title, description, location, category }
 *  - same headers as the lookup (X-Correlation-Id, Bearer key when set), same 3 s timeout
 *  - 201 (new) or 200 (Team 10 already has one for this ticketRef) -> created; reads {data:{id,status}} or the bare object
 *  - other 4xx (not 401/403) -> rejected, with Team 10's message to show the admin
 *  - 401/403, 5xx, timeout, network error, odd body -> unavailable (never throws)
 *  - no MAINTENANCE_API_URL: in development, answers a mock work order `WO-MOCK-<uuid>` (the lookup knows it too)
 */
export async function createWorkOrder(env: Bindings, input: NewWorkOrder, correlationId: string): Promise<CreateResult> {
  const base = (env.MAINTENANCE_API_URL ?? '').trim().replace(/\/+$/, '');
  if (!base) {
    if (env.ENVIRONMENT === 'development') {
      return { kind: 'created', workOrder: { id: `${MOCK_PREFIX}${crypto.randomUUID()}`, status: 'reported' } };
    }
    return { kind: 'unavailable', reason: 'not configured' };
  }
  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Correlation-Id': correlationId,
    };
    if (env.MAINTENANCE_API_KEY) headers.Authorization = `Bearer ${env.MAINTENANCE_API_KEY}`;
    const res = await fetch(`${base}/work-orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(MAINTENANCE_TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.status === 401 || res.status === 403) return { kind: 'unavailable', reason: `HTTP ${res.status}` };
    // No such endpoint (yet): Team 10 has not opened "create from Helpdesk". The admin uses the manual link instead.
    if (res.status === 404 || res.status === 405) return { kind: 'unavailable', reason: CREATE_NOT_SUPPORTED };
    if (res.status >= 400 && res.status < 500) return { kind: 'rejected', message: errorMessage(body) ?? `HTTP ${res.status}` };
    if (!res.ok) return { kind: 'unavailable', reason: `HTTP ${res.status}` };
    const wo = ((body.data as Record<string, unknown> | undefined) ?? body) as Partial<WorkOrder>;
    if (typeof wo.id !== 'string' || !wo.id || typeof wo.status !== 'string' || !wo.status) {
      return { kind: 'unavailable', reason: 'unexpected response' };
    }
    return { kind: 'created', workOrder: { id: wo.id, status: wo.status } };
  } catch (err) {
    return { kind: 'unavailable', reason: err instanceof Error ? err.name : 'error' };
  }
}

/** Team 10 errors look like { error: { code, message } }; a plain { message } is accepted too. */
function errorMessage(body: Record<string, unknown>): string | null {
  const e = body.error;
  const m = typeof e === 'object' && e !== null ? (e as Record<string, unknown>).message : body.message;
  return typeof m === 'string' && m.trim() ? m.trim().slice(0, 300) : null;
}
