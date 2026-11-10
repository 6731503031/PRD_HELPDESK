/**
 * Sync with Team 10 (we ASK for the work-order status) — used when a webhook was missed.
 * Owner: P3. Team 10 is mocked with a stubbed fetch; the database is a small fake that records the SQL.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { shouldApplyPolledStatus } from '../src/modules/maintenance/mapping';
import { syncOpenWorkOrders, syncWorkOrder } from '../src/modules/maintenance/sync';
import { repairMessage } from '../src/modules/comments/templates';

type Call = { sql: string; args: unknown[] };
function fakeDb() {
  const writes: Call[][] = [];
  const stmt = (sql: string) => {
    const call: Call = { sql, args: [] };
    const s = {
      bind: (...args: unknown[]) => ((call.args = args), s),
      first: async () => null,
      all: async () => ({ results: [] }),
      run: async () => ({}),
      call,
    };
    return s;
  };
  return {
    writes,
    prepare: stmt,
    batch: async (list: { call: Call }[]) => {
      writes.push(list.map((s) => s.call));
      return [];
    },
  };
}

const ticket = (maintenance_status: string | null, status: 'open' | 'in_progress' = 'in_progress') => ({
  id: 21,
  ticket_number: 'TKT-00021',
  status,
  maintenance_status,
  maintenance_work_order_id: 'a5689d80-c94b-4729-9a88-58bf40bfe4b9',
});
const env = (db = fakeDb()) =>
  ({ ENVIRONMENT: 'production', MAINTENANCE_API_URL: 'https://t10.test/api/v1', MAINTENANCE_API_KEY: 'k', EVENT_HUB_URL: '', DB: db }) as never;
const team10Says = (status: string, http = 200) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: { id: 'a5689d80', status } }), { status: http })));

afterEach(() => vi.unstubAllGlobals());

describe('which polled status is applied (forward only)', () => {
  it('applies real progress', () => {
    expect(shouldApplyPolledStatus('reported', 'in_progress')).toBe(true);
    expect(shouldApplyPolledStatus('in_progress', 'resolved')).toBe(true);
    expect(shouldApplyPolledStatus('resolved', 'closed')).toBe(true);
    expect(shouldApplyPolledStatus(null, 'submitted')).toBe(true);
  });
  it('ignores the same status, the same stage under another name, and going backwards', () => {
    expect(shouldApplyPolledStatus('in_progress', 'in_progress')).toBe(false);
    expect(shouldApplyPolledStatus('reported', 'submitted')).toBe(false);
    expect(shouldApplyPolledStatus('completed', 'resolved')).toBe(false);
    expect(shouldApplyPolledStatus('in_progress', 'assigned')).toBe(false);
  });
  it('applies a cancellation once, and never revives a cancelled work order', () => {
    expect(shouldApplyPolledStatus('in_progress', 'cancelled')).toBe(true);
    expect(shouldApplyPolledStatus('cancelled', 'cancelled')).toBe(false);
    expect(shouldApplyPolledStatus('cancelled', 'in_progress')).toBe(false);
  });
  it('ignores statuses we do not know', () => {
    expect(shouldApplyPolledStatus('reported', 'teleported')).toBe(false);
  });
});

describe('syncWorkOrder', () => {
  it('asks GET /work-orders/{id} with the key and a correlation id', async () => {
    team10Says('reported');
    await syncWorkOrder(env(), ticket('reported'), 'team14-test-0001');
    const [url, init] = (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(url).toBe('https://t10.test/api/v1/work-orders/a5689d80-c94b-4729-9a88-58bf40bfe4b9');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer k', 'X-Correlation-Id': 'team14-test-0001' });
  });

  it('writes the new status, one history row and the chat message when Team 10 has moved on', async () => {
    team10Says('resolved');
    const db = fakeDb();
    const out = await syncWorkOrder(env(db), ticket('reported'), 'team14-test-0002');
    expect(out).toEqual({ kind: 'changed', from: 'reported', to: 'resolved' });
    const [update, history] = db.writes[0];
    expect(update.sql).toContain('UPDATE tickets SET maintenance_status = ?');
    expect(update.args[0]).toBe('resolved');
    expect(history.sql).toContain('INSERT INTO ticket_status_history');
    expect(history.args).toContain('Repair resolved by Maintenance, awaiting admin confirmation');
    expect(db.writes[0].some((c) => c.sql.includes('processed_events'))).toBe(false); // a poll has no event id
    expect(db.writes.length).toBe(2); // + the "repair done" chat message
  });

  it('changes nothing when Team 10 reports the same status', async () => {
    team10Says('reported');
    const db = fakeDb();
    expect(await syncWorkOrder(env(db), ticket('reported'), 'x')).toEqual({ kind: 'unchanged', team10: 'reported' });
    expect(db.writes).toHaveLength(0);
  });

  it('reports a status we do not know, without writing', async () => {
    team10Says('ON_HOLD');
    const db = fakeDb();
    expect(await syncWorkOrder(env(db), ticket('reported'), 'x')).toEqual({ kind: 'unknown_status', team10: 'ON_HOLD' });
    expect(db.writes).toHaveLength(0);
  });

  it('reports Team 10 down or the work order unknown, without writing', async () => {
    team10Says('x', 500);
    expect((await syncWorkOrder(env(), ticket('reported'), 'x')).kind).toBe('unavailable');
    team10Says('x', 404);
    expect((await syncWorkOrder(env(), ticket('reported'), 'x')).kind).toBe('not_found');
  });
});

describe('cron sync', () => {
  it('does nothing while no Team 10 URL is set (local development)', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const out = await syncOpenWorkOrders({ ENVIRONMENT: 'development', MAINTENANCE_API_URL: '', DB: fakeDb() } as never);
    expect(out).toMatchObject({ checked: 0, skipped: 'no Team 10 URL' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('chat message for Team 10 "resolved"', () => {
  it('announces the repair as done, once', () => {
    expect(repairMessage('in_progress', 'resolved')).not.toBeNull();
    expect(repairMessage('resolved', 'completed')).toBeNull();
  });
});
