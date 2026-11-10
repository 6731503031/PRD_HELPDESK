/**
 * GET /api/v1/contacts — TEAM14-API-FOR-WELLBEING-BRIEF Part A (§3, §4, §7).
 * Owner: P3. Runs the real app (no D1 needed: the directory is a file).
 */
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import worker from '../src/index';
import { CONTACTS, listContacts } from '../src/modules/contacts/directory';

const ctx = { waitUntil() {}, passThroughOnException() {} } as never;
const call = (path: string, init?: RequestInit) => worker.fetch(new Request(`https://helpdesk.test${path}`, init), {} as never, ctx);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

let log: MockInstance;
beforeEach(() => {
  log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('GET /api/v1/contacts — shape (§4)', () => {
  it('200, a plain JSON array with campus_security and counselling_front_desk', async () => {
    const res = await call('/api/v1/contacts');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.map((c) => c.id)).toEqual(expect.arrayContaining(['campus_security', 'counselling_front_desk']));
  });

  it('every entry has exactly the fields of §4, within their rules', async () => {
    const body = (await (await call('/api/v1/contacts')).json()) as Record<string, unknown>[];
    for (const c of body) {
      expect(Object.keys(c).sort()).toEqual(['available_24h', 'hours', 'id', 'name', 'phone', 'tel', 'type', 'updated_at', 'verified']);
      expect(c.id).toMatch(/^[a-z0-9_]{2,40}$/);
      expect(String(c.name).length).toBeGreaterThanOrEqual(1);
      expect(String(c.name).length).toBeLessThanOrEqual(80);
      expect(String(c.phone).length).toBeGreaterThanOrEqual(3);
      expect(String(c.phone).length).toBeLessThanOrEqual(30);
      expect(c.tel).toMatch(/^\+?[0-9]{3,15}$/);
      expect(String(c.hours).length).toBeGreaterThanOrEqual(1);
      expect(String(c.hours).length).toBeLessThanOrEqual(60);
      expect(['emergency', 'service', 'support']).toContain(c.type);
      expect(typeof c.available_24h).toBe('boolean');
      expect(typeof c.verified).toBe('boolean');
      expect(new Date(String(c.updated_at)).toISOString()).toBe(String(c.updated_at).replace('Z', '.000Z'));
    }
  });

  it('placeholder numbers are marked unverified, and no national hotline is listed', () => {
    for (const c of CONTACTS) expect(c.verified).toBe(false);
    expect(CONTACTS.some((c) => ['1669', '1323'].includes(c.tel))).toBe(false);
  });

  it('orders emergency first, then service, then support, then by name', () => {
    const mixed = [
      { ...CONTACTS[1], id: 'b', name: 'B', type: 'support' as const },
      { ...CONTACTS[1], id: 'z', name: 'Z', type: 'service' as const },
      { ...CONTACTS[1], id: 'a', name: 'A', type: 'service' as const },
      { ...CONTACTS[0], id: 'e', name: 'E', type: 'emergency' as const },
    ];
    expect(listContacts(undefined, mixed).map((c) => c.id)).toEqual(['e', 'a', 'z', 'b']);
  });

  it('sends JSON with charset and a 5-minute public cache', async () => {
    const res = await call('/api/v1/contacts');
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('public, max-age=300');
  });
});

describe('GET /api/v1/contacts — filter and errors (§4)', () => {
  it('?type=emergency returns only emergency contacts', async () => {
    const body = (await (await call('/api/v1/contacts?type=emergency')).json()) as { type: string }[];
    expect(body.length).toBeGreaterThan(0);
    expect(body.every((c) => c.type === 'emergency')).toBe(true);
  });

  it('an invalid type gives 400 with the code and field name only, never the submitted value', async () => {
    for (const bad of ['nope', '', 'EMERGENCY', '<script>']) {
      const res = await call(`/api/v1/contacts?type=${encodeURIComponent(bad)}`);
      expect(res.status).toBe(400);
      expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
      const text = await res.text();
      expect(JSON.parse(text)).toEqual({ error: 'validation_failed', fields: ['type'] });
      if (bad) expect(text).not.toContain(bad);
    }
  });

  it('any other method gives 405 with an empty body', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const res = await call('/api/v1/contacts', { method });
      expect(res.status).toBe(405);
      expect(await res.text()).toBe('');
    }
  });

  it('is public: no x-user-id needed', async () => {
    expect((await call('/api/v1/contacts')).status).toBe(200);
  });
});

describe('GET /api/v1/contacts — correlation id and logs (§3)', () => {
  it('echoes a valid X-Correlation-Id', async () => {
    const res = await call('/api/v1/contacts', { headers: { 'X-Correlation-Id': 'team16-v1-0001' } });
    expect(res.headers.get('x-correlation-id')).toBe('team16-v1-0001');
  });

  it('replaces a missing, too short or badly formed id with a random UUID', async () => {
    const cases: Record<string, string>[] = [{}, { 'X-Correlation-Id': 'abc' }, { 'X-Correlation-Id': 'has space 123' }, { 'X-Correlation-Id': 'x'.repeat(129) }];
    for (const headers of cases) {
      const res = await call('/api/v1/contacts', { headers });
      expect(res.headers.get('x-correlation-id')).toMatch(UUID);
    }
  });

  it('writes one JSON line with method, path, status, correlation id and duration — no query string', async () => {
    await call('/api/v1/contacts?type=emergency', { headers: { 'X-Correlation-Id': 'team16-v1-0002' } });
    const lines = log.mock.calls.map((a) => String(a[0])).filter((l) => l.startsWith('{') && l.includes('team16-v1-0002'));
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);
    expect(entry).toMatchObject({ method: 'GET', path: '/api/v1/contacts', status: 200, correlationId: 'team16-v1-0002' });
    expect(typeof entry.ms).toBe('number');
    expect(lines[0]).not.toContain('type=');
  });

  it('does not change other routes: they still echo the caller id unchecked (Team 10 unaffected)', async () => {
    const res = await call('/api/v1', { headers: { 'X-Correlation-Id': 'abc' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-correlation-id')).toBe('abc');
  });
});
