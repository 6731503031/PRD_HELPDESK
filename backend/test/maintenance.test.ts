/**
 * PRD §18 required test #6 Maintenance link + recommended "webhook verification", "duplicate event"
 * Owner: P3 — remove .skip when verifyWebhook / mapWorkOrderStatus are implemented.
 */
import { describe, expect, it } from 'vitest';
import { hmacHex, safeEqual, verifyWebhook } from '../src/modules/maintenance/signature';
import { mapWorkOrderStatus } from '../src/modules/maintenance/mapping';

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

describe.skip('#6 Maintenance webhook signature (F29) — TODO P3', () => {
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

describe.skip('#6 Work Order status mapping (F14) — TODO P3', () => {
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
