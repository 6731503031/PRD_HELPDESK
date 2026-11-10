/**
 * Wellbeing (Team 16) API client — contract 2.0 (AI-MIGRATION-BRIEF §4, §9).
 * Owner: P3 (Integrations)
 *
 * One direction only: Helpdesk READS Team 16's public catalogue. We never send ticket text or any personal
 * data, and Team 16 sends us nothing back (no webhooks). Server-side only: Team 16 sends no CORS headers.
 *
 *   GET {WELLBEING_API_URL}/services  →  200 [ { id, name, description, duration_minutes, is_active } ]
 *
 * Never throws: a Wellbeing outage must never block a ticket. 3 s timeout, 10-minute cache; during an outage the
 * last good list is served (stale), otherwise the list is empty and `available` is false (UI hides the list).
 */

export type WellbeingService = {
  /** Stable text id, e.g. "srv_academic_stress". The only thing we may store on a ticket. */
  id: string;
  /** Display name — Team 16 may rename it, so always show the live value, never copy it onto a ticket. */
  name: string;
  description: string;
  durationMinutes: number;
};

export type WellbeingServiceList = {
  /** false → hide the Wellbeing suggestion. */
  available: boolean;
  /** true → served from cache during a Wellbeing outage. */
  stale: boolean;
  services: WellbeingService[];
  error?: string;
};

export const WELLBEING_TIMEOUT_MS = 3000;
export const WELLBEING_CACHE_TTL_MS = 10 * 60 * 1000;
export const WELLBEING_ID_PATTERN = /^srv_[a-z0-9_]+$/;

/** Kept per Worker isolate. Good enough for a 10-minute catalogue cache. */
let cache: { at: number; services: WellbeingService[] } | null = null;

/** 8–128 chars of A–Z a–z 0–9 _ . : - (Team 16 replaces anything else). */
export function wellbeingCorrelationId(prefix = 'team14'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Contract 2.0 is a plain array. Unknown fields are ignored; a missing description becomes "". */
export function parseServices(body: unknown): WellbeingService[] {
  if (!Array.isArray(body)) throw new Error('wellbeing_bad_shape');
  return body.map((item) => {
    const s = (item ?? {}) as Record<string, unknown>;
    if (typeof s.id !== 'string' || typeof s.name !== 'string') throw new Error('wellbeing_bad_shape');
    return {
      id: s.id,
      name: s.name,
      description: typeof s.description === 'string' ? s.description : '',
      durationMinutes: typeof s.duration_minutes === 'number' ? s.duration_minutes : 0,
    };
  });
}

export async function listWellbeingServices(baseUrl: string, cid = wellbeingCorrelationId()): Promise<WellbeingServiceList> {
  if (cache && Date.now() - cache.at < WELLBEING_CACHE_TTL_MS) {
    return { available: true, stale: false, services: cache.services };
  }
  try {
    const base = (baseUrl ?? '').trim().replace(/\/+$/, '');
    if (!base) throw new Error('wellbeing_not_configured');
    const res = await fetch(`${base}/services`, {
      headers: { Accept: 'application/json', 'X-Correlation-Id': cid },
      signal: AbortSignal.timeout(WELLBEING_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`wellbeing_http_${res.status}`);
    const services = parseServices(await res.json());
    cache = { at: Date.now(), services };
    return { available: true, stale: false, services };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'wellbeing_error';
    console.warn(JSON.stringify({ level: 'warn', msg: 'wellbeing catalogue unavailable', error, correlationId: cid }));
    if (cache) return { available: true, stale: true, services: cache.services, error };
    return { available: false, stale: false, services: [], error };
  }
}

/** Resolve a stored id. null = not offered right now (switched off or wrong id) — treat as "not found". */
export function findService(list: WellbeingServiceList, id: string | null | undefined): WellbeingService | null {
  if (!id) return null;
  return list.services.find((s) => s.id === id) ?? null;
}

/** For tests only. */
export function clearWellbeingCache(): void {
  cache = null;
}
