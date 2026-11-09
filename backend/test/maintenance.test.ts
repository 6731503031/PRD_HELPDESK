/**
 * PRD §18 required test #6 Maintenance link + recommended "webhook verification", "duplicate event"
 * Owner: P3
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hmacHex, safeEqual, verifyWebhook } from '../src/modules/maintenance/signature';
import { mapWorkOrderStatus, nextTicketStatus } from '../src/modules/maintenance/mapping';
import { parseWebhookEvent, validateRepairRequest, validateWorkOrderId } from '../src/modules/maintenance/envelope';
import { createWorkOrder, fetchWorkOrder } from '../src/modules/maintenance/client';

describe('HMAC helper', () => {
  it('matches the standard HMAC-SHA256 test vector', async () => {
    expect(await hmacHex('key', 'The quick brown fox jumps over the lazy dog')).toBe(
      'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8',
    );
  });
  it('compares strings safely', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
  });
});

describe('#6 Maintenance webhook signature (F29)', () => {
  const secret = 'test-secret';
  const body = JSON.stringify({ eventId: 'e1', type: 'maintenance.status_changed', data: { workOrderId: 'WO-0045', status: 'in_progress' } });
  const now = new Date('2026-11-20T09:15:00Z');
  const ts = String(Math.floor(now.getTime() / 1000));

  it('accepts a correctly signed, fresh event', async () => {
    const signature = await hmacHex(secret, `${ts}.${body}`);
    expect((await verifyWebhook({ secret, timestamp: ts, signature, rawBody: body, now })).ok).toBe(true);
  });
  it('rejects a wrong signature', async () => {
    expect((await verifyWebhook({ secret, timestamp: ts, signature: 'deadbeef', rawBody: body, now })).ok).toBe(false);
  });
  it('rejects a replay older than 5 minutes', async () => {
    const old = String(Number(ts) - 301);
    const signature = await hmacHex(secret, `${old}.${body}`);
    expect((await verifyWebhook({ secret, timestamp: old, signature, rawBody: body, now })).ok).toBe(false);
  });
});

describe('#6 Work Order status mapping (F14)', () => {
  it('moves the ticket to in_progress when repair starts', () => {
    expect(mapWorkOrderStatus('in_progress')?.ticketStatus).toBe('in_progress');
  });
  it('never auto-resolves: completed leaves the status for the admin to confirm', () => {
    expect(mapWorkOrderStatus('completed')?.ticketStatus).toBeNull();
  });
  it('rejects unknown statuses', () => {
    expect(mapWorkOrderStatus('teleported')).toBeNull();
  });
});

describe('webhook signature — more cases', () => {
  const secret = 'test-secret';
  const body = '{"eventId":"e1"}';
  const now = new Date('2026-11-20T09:15:00Z');
  const ts = String(Math.floor(now.getTime() / 1000));

  it('rejects when no secret is configured, or headers are missing', async () => {
    expect((await verifyWebhook({ secret: undefined, timestamp: ts, signature: 'x', rawBody: body, now })).reason).toBe('not configured');
    expect((await verifyWebhook({ secret, timestamp: undefined, signature: 'x', rawBody: body, now })).reason).toBe('missing headers');
    expect((await verifyWebhook({ secret, timestamp: ts, signature: undefined, rawBody: body, now })).reason).toBe('missing headers');
  });
  it('rejects a body changed after signing, and a non-numeric timestamp', async () => {
    const signature = await hmacHex(secret, `${ts}.${body}`);
    expect((await verifyWebhook({ secret, timestamp: ts, signature, rawBody: body + ' ', now })).ok).toBe(false);
    expect((await verifyWebhook({ secret, timestamp: 'abc', signature, rawBody: body, now })).reason).toBe('stale');
  });
  it('accepts an upper-case hex signature and a timestamp 4 minutes in the future', async () => {
    const future = String(Number(ts) + 240);
    const signature = (await hmacHex(secret, `${future}.${body}`)).toUpperCase();
    expect((await verifyWebhook({ secret, timestamp: future, signature, rawBody: body, now })).ok).toBe(true);
  });
});

describe('status mapping — what happens to the ticket', () => {
  it('knows every status of the table in the Team 10 doc', () => {
    for (const s of ['reported', 'assigned', 'in_progress', 'completed', 'closed', 'cancelled']) expect(mapWorkOrderStatus(s)).not.toBeNull();
  });
  it('starts an open ticket when the repair starts, and does nothing if it already runs', () => {
    const start = mapWorkOrderStatus('in_progress')!;
    expect(nextTicketStatus('open', start)).toBe('in_progress');
    expect(nextTicketStatus('in_progress', start)).toBeNull();
  });
  it('never touches a ticket the admin already resolved', () => {
    expect(nextTicketStatus('resolved', mapWorkOrderStatus('in_progress')!)).toBeNull();
    expect(nextTicketStatus('closed', mapWorkOrderStatus('cancelled')!)).toBeNull();
  });
  it('a finished repair changes the label, not the status', () => {
    expect(nextTicketStatus('in_progress', mapWorkOrderStatus('completed')!)).toBeNull();
  });
});

describe('work order id typed by the admin', () => {
  it('accepts normal ids', () => {
    expect(validateWorkOrderId(' WO-0045 ')).toEqual({ ok: true, id: 'WO-0045' });
  });
  it('rejects empty, too long, odd characters and our own ticket numbers', () => {
    expect(validateWorkOrderId('').ok).toBe(false);
    expect(validateWorkOrderId('W'.repeat(65)).ok).toBe(false);
    expect(validateWorkOrderId('WO 45/../x').ok).toBe(false);
    const own = validateWorkOrderId('TKT-00034');
    expect(own.ok).toBe(false);
    expect(!own.ok && own.message).toContain('เลขคำร้องของเรา');
  });
});

describe('webhook envelope', () => {
  const good = { eventId: 'e1', type: 'maintenance.status_changed', data: { workOrderId: 'WO-0045', status: 'in_progress', ticketRef: 'TKT-00012' } };
  it('accepts the agreed shape', () => {
    const r = parseWebhookEvent(good);
    expect(r.ok && r.event).toEqual({ eventId: 'e1', type: 'maintenance.status_changed', workOrderId: 'WO-0045', status: 'in_progress' });
  });
  it('rejects a missing id, a wrong type and missing data', () => {
    expect(parseWebhookEvent({ ...good, eventId: '' }).ok).toBe(false);
    expect(parseWebhookEvent({ ...good, type: 'other' }).ok).toBe(false);
    expect(parseWebhookEvent({ ...good, data: {} }).ok).toBe(false);
    expect(parseWebhookEvent(null).ok).toBe(false);
  });
});

describe('Team 10 client without a URL (F13, no network)', () => {
  const env = (over: object) => ({ ENVIRONMENT: 'development', MAINTENANCE_API_URL: '', ...over }) as never;
  it('answers WO-MOCK-* ids locally in development', async () => {
    expect((await fetchWorkOrder(env({}), 'WO-MOCK-1', 'c1')).kind).toBe('found');
  });
  it('says unavailable for a real id when nothing is configured, and outside development', async () => {
    expect((await fetchWorkOrder(env({}), 'WO-0045', 'c1')).kind).toBe('unavailable');
    expect((await fetchWorkOrder(env({ ENVIRONMENT: 'production' }), 'WO-MOCK-1', 'c1')).kind).toBe('unavailable');
  });
});

describe('repair text the admin sends to Team 10', () => {
  const ticket = { title: 'Air conditioner in B-204', description: 'It does not cool at all.' };
  const where = { location: 'Building B, Room B-204', category: 'HVAC' };
  it('falls back to the ticket text and trims what the admin typed', () => {
    expect(validateRepairRequest(where, ticket)).toEqual({ ok: true, ...ticket, ...where });
    expect(
      validateRepairRequest({ title: '  Aircon B-204  ', description: ' No cold air ', location: ' B-204 ', category: 'HVAC' }, ticket),
    ).toEqual({ ok: true, title: 'Aircon B-204', description: 'No cold air', location: 'B-204', category: 'HVAC' });
  });
  it('rejects empty or too long text', () => {
    expect(validateRepairRequest({ ...where, title: ' ' }, ticket).ok).toBe(false);
    expect(validateRepairRequest({ ...where, description: 'x' }, ticket).ok).toBe(false);
    expect(validateRepairRequest({ ...where, title: 'x'.repeat(151) }, ticket).ok).toBe(false);
    expect(validateRepairRequest({ ...where, description: 'x'.repeat(5001) }, ticket).ok).toBe(false);
  });
  it('needs a location (Team 10 must know where to go)', () => {
    expect(validateRepairRequest({ category: 'HVAC' }, ticket).ok).toBe(false);
    expect(validateRepairRequest({ ...where, location: ' ' }, ticket).ok).toBe(false);
    expect(validateRepairRequest({ ...where, location: 'x'.repeat(201) }, ticket).ok).toBe(false);
  });
  it("category is one of Team 10's five values, exactly", () => {
    for (const category of ['Plumbing', 'Electrical', 'HVAC', 'Safety', 'Not sure']) {
      expect(validateRepairRequest({ ...where, category }, ticket).ok).toBe(true);
    }
    expect(validateRepairRequest({ location: 'B-204' }, ticket).ok).toBe(false);
    expect(validateRepairRequest({ ...where, category: 'hvac' }, ticket).ok).toBe(false);
    expect(validateRepairRequest({ ...where, category: 'Facility' }, ticket).ok).toBe(false);
  });
});

describe('Team 10 client: create a work order (POST /work-orders)', () => {
  const input = { ticketRef: 'TKT-00012', title: 'Aircon B-204', description: 'No cold air', location: 'Building B, Room B-204', category: 'HVAC' };
  const env = (over: object = {}) =>
    ({ ENVIRONMENT: 'production', MAINTENANCE_API_URL: 'https://t10.test/api/v1/', MAINTENANCE_API_KEY: 'k1', ...over }) as never;
  const reply = (status: number, body: unknown) =>
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
  afterEach(() => vi.restoreAllMocks());

  it('in development without a URL, answers a mock work order the lookup also knows', async () => {
    const devEnv = { ENVIRONMENT: 'development', MAINTENANCE_API_URL: '' } as never;
    const r = await createWorkOrder(devEnv, input, 'c1');
    expect(r.kind).toBe('created');
    if (r.kind !== 'created') return;
    expect(r.workOrder.id.startsWith('WO-MOCK-')).toBe(true);
    expect(validateWorkOrderId(r.workOrder.id).ok).toBe(true);
    expect((await fetchWorkOrder(devEnv, r.workOrder.id, 'c1')).kind).toBe('found');
  });
  it('without a URL outside development: unavailable, no call made', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    expect((await createWorkOrder(env({ MAINTENANCE_API_URL: '' }), input, 'c1')).kind).toBe('unavailable');
    expect(spy).not.toHaveBeenCalled();
  });
  it('POSTs the three fields with the agreed headers, and reads {data:{id,status}}', async () => {
    const spy = reply(201, { data: { id: '7f3c2a9e-1b4d-4c8e-9a21-5d6e7f8a9b01', status: 'reported', ticketRef: 'TKT-00012' } });
    const r = await createWorkOrder(env(), input, 'corr-1');
    expect(r).toEqual({ kind: 'created', workOrder: { id: '7f3c2a9e-1b4d-4c8e-9a21-5d6e7f8a9b01', status: 'reported' } });
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://t10.test/api/v1/work-orders');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual(input);
    const h = init.headers as Record<string, string>;
    expect(h.Authorization).toBe('Bearer k1');
    expect(h['X-Correlation-Id']).toBe('corr-1');
  });
  it('accepts 200 (Team 10 already has one for this ticketRef) and a bare object', async () => {
    reply(200, { id: 'wo-1', status: 'in_progress' });
    expect(await createWorkOrder(env(), input, 'c1')).toEqual({ kind: 'created', workOrder: { id: 'wo-1', status: 'in_progress' } });
  });
  it('no POST endpoint at Team 10 (404/405): unavailable with a clear reason, not a rejection', async () => {
    reply(404, { error: { code: 'NOT_FOUND', message: 'Not found' } });
    expect(await createWorkOrder(env(), input, 'c1')).toEqual({ kind: 'unavailable', reason: 'create not supported' });
    vi.restoreAllMocks();
    reply(405, {});
    expect(await createWorkOrder(env(), input, 'c1')).toEqual({ kind: 'unavailable', reason: 'create not supported' });
  });
  it("passes Team 10's 400 message on to the admin", async () => {
    reply(400, { error: { code: 'VALIDATION', message: 'title is required' } });
    expect(await createWorkOrder(env(), input, 'c1')).toEqual({ kind: 'rejected', message: 'title is required' });
  });
  it('a wrong credential, a server error, an odd body or a timeout: unavailable', async () => {
    reply(401, {});
    expect((await createWorkOrder(env(), input, 'c1')).kind).toBe('unavailable');
    vi.restoreAllMocks();
    reply(500, {});
    expect((await createWorkOrder(env(), input, 'c1')).kind).toBe('unavailable');
    vi.restoreAllMocks();
    reply(201, { data: { status: 'reported' } });
    expect((await createWorkOrder(env(), input, 'c1')).kind).toBe('unavailable');
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('timed out', 'TimeoutError'));
    expect(await createWorkOrder(env(), input, 'c1')).toEqual({ kind: 'unavailable', reason: 'TimeoutError' });
  });
});
