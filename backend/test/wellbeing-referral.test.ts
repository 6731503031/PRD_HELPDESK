/**
 * Referral to Wellbeing (Team 16) — proposal TEAM14-WELLBEING-REFERRAL-PROPOSAL.md.
 * Owner: P3. Team 16 is mocked with a stubbed fetch; nothing here needs D1.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  REF_PATTERN,
  fetchReferralStatus,
  newReferralRef,
  parseReferralEvent,
  referralEffect,
  referralsEnabled,
  sendReferral,
  syncSentReferrals,
} from '../src/modules/wellbeing/referral';

const env = (over: Record<string, unknown> = {}) =>
  ({ WELLBEING_API_URL: 'https://wb.test/api/v1/', WELLBEING_API_KEY: 'k16', WELLBEING_REFERRALS: 'on', ...over }) as never;
const REF = 'hd-0123456789abcdef0123456789abcdef';
const reply = (status: number, body: unknown = {}) => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })));
type Calls = { mock: { calls: [string, RequestInit][] } };

afterEach(() => vi.unstubAllGlobals());

describe('reference and switch', () => {
  it('makes a random reference that carries nothing about the ticket or the person', () => {
    const a = newReferralRef();
    const b = newReferralRef();
    expect(a).toMatch(REF_PATTERN);
    expect(a).not.toBe(b);
  });
  it('is off unless WELLBEING_REFERRALS is "on"', () => {
    expect(referralsEnabled({ WELLBEING_REFERRALS: 'on' })).toBe(true);
    expect(referralsEnabled({ WELLBEING_REFERRALS: ' ON ' })).toBe(true);
    expect(referralsEnabled({ WELLBEING_REFERRALS: 'off' })).toBe(false);
    expect(referralsEnabled({})).toBe(false);
  });
});

describe('what a Team 16 status does (referralEffect)', () => {
  it('approved resolves an open ticket', () => {
    expect(referralEffect('sent', 'approved', 'in_progress')).toEqual({ apply: true, next: 'approved', ticket: 'resolve' });
    expect(referralEffect('sent', 'approved', 'open')).toEqual({ apply: true, next: 'approved', ticket: 'resolve' });
  });
  it('approved on a ticket the admin already resolved changes only the referral', () => {
    expect(referralEffect('sent', 'approved', 'resolved')).toEqual({ apply: true, next: 'approved', ticket: 'none' });
  });
  it('declined leaves the ticket open', () => {
    expect(referralEffect('sent', 'declined', 'in_progress')).toEqual({ apply: true, next: 'declined', ticket: 'none' });
  });
  it('cancelled after approval re-opens a resolved ticket, but never a closed one', () => {
    expect(referralEffect('approved', 'cancelled', 'resolved')).toEqual({ apply: true, next: 'cancelled', ticket: 'reopen' });
    expect(referralEffect('approved', 'cancelled', 'closed')).toEqual({ apply: true, next: 'cancelled', ticket: 'none' });
  });
  it('ignores a withdrawn referral, a repeat, and anything out of order', () => {
    expect(referralEffect('withdrawn', 'approved', 'in_progress').apply).toBe(false);
    expect(referralEffect('approved', 'approved', 'resolved').apply).toBe(false);
    expect(referralEffect('declined', 'approved', 'in_progress').apply).toBe(false);
    expect(referralEffect('approved', 'declined', 'resolved').apply).toBe(false);
  });
});

describe('callback envelope (parseReferralEvent)', () => {
  const ok = { eventId: 'e-1', type: 'wellbeing.referral_status', data: { ref: REF, status: 'approved' } };
  it('accepts the agreed shape', () => {
    expect(parseReferralEvent(ok)).toEqual({ ok: true, event: { eventId: 'e-1', type: 'wellbeing.referral_status', ref: REF, status: 'approved' } });
  });
  it('rejects a missing event id, a wrong type, a foreign reference and an unknown status', () => {
    expect(parseReferralEvent({ ...ok, eventId: '' }).ok).toBe(false);
    expect(parseReferralEvent({ ...ok, type: 'booking.updated' }).ok).toBe(false);
    expect(parseReferralEvent({ ...ok, data: { ...ok.data, ref: 'TKT-00021' } }).ok).toBe(false);
    expect(parseReferralEvent({ ...ok, data: { ...ok.data, status: 'completed' } }).ok).toBe(false);
    expect(parseReferralEvent([ok]).ok).toBe(false);
  });
});

describe('Team 16 client', () => {
  it('POSTs only the reference, the service id and the consent time, with the key and a correlation id', async () => {
    reply(201, { id: 'wb-77' });
    const out = await sendReferral(env(), { ref: REF, service_id: 'srv_academic_stress', consent_at: '2026-11-10T09:00:00.000Z' }, 'team14-t-0001');
    expect(out).toEqual({ kind: 'sent', wellbeingId: 'wb-77' });
    const [url, init] = (fetch as unknown as Calls).mock.calls[0];
    expect(url).toBe('https://wb.test/api/v1/referrals');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ ref: REF, service_id: 'srv_academic_stress', consent_at: '2026-11-10T09:00:00.000Z' });
    expect(init.headers).toMatchObject({ Authorization: 'Bearer k16', 'X-Correlation-Id': 'team14-t-0001' });
  });
  it('tells a refusal (4xx) apart from an outage (5xx)', async () => {
    reply(422);
    expect(await sendReferral(env(), { ref: REF, service_id: null, consent_at: 'x' }, 'c')).toEqual({ kind: 'rejected', status: 422 });
    reply(503);
    expect((await sendReferral(env(), { ref: REF, service_id: null, consent_at: 'x' }, 'c')).kind).toBe('unavailable');
  });
  it('reads a referral status, plain or wrapped in data', async () => {
    reply(200, { status: 'approved' });
    expect(await fetchReferralStatus(env(), REF, 'c')).toEqual({ kind: 'found', status: 'approved' });
    reply(200, { data: { status: 'sent' } });
    expect(await fetchReferralStatus(env(), REF, 'c')).toEqual({ kind: 'found', status: 'sent' });
    reply(404);
    expect((await fetchReferralStatus(env(), REF, 'c')).kind).toBe('not_found');
  });
  it('the cron does nothing while referrals are off', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    expect(await syncSentReferrals(env({ WELLBEING_REFERRALS: 'off' }))).toMatchObject({ checked: 0, skipped: 'referrals off' });
    expect(spy).not.toHaveBeenCalled();
  });
});
