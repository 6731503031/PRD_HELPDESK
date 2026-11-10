/**
 * Wellbeing (Team 16) integration — contract 2.0 (AI-MIGRATION-BRIEF, 2026-11-09).
 * Owner: P3 (Integrations)
 *
 *   GET /wellbeing/services                public catalogue proxy (Team 16 has no CORS)
 *   GET /tickets/:id/wellbeing-suggestion  which service to suggest for this ticket (+ referral status), read-only
 *   POST   /tickets/:id/wellbeing-referral requester only, with consent: send a referral (random reference only)
 *   DELETE /tickets/:id/wellbeing-referral requester only: withdraw it
 *   POST /webhooks/wellbeing               Team 16 → us: referral approved / declined (HMAC)
 *   The referral part is OFF unless WELLBEING_REFERRALS = 'on' — see referral.ts.
 *
 * No ticket text and no personal data goes to Team 16: the catalogue is public, and a referral carries only a
 * random reference, the service id and the consent time.
 * A stored wellbeing_service_id means "we suggested this", never "this student is a Wellbeing client".
 */
import { Hono, type Context } from 'hono';
import type { AppEnv } from '../../core/env';
import { ApiError, badRequest, conflict, forbidden, notFound, parseId, readJson } from '../../core/http';
import { verifyWebhook } from '../maintenance/signature';
import { getTicket } from '../tickets/repo';
import { canViewTicket } from '../tickets/rules';
import { findService, listWellbeingServices, wellbeingCorrelationId, type WellbeingService } from './client';
import {
  applyReferralStatus,
  latestReferral,
  newReferralRef,
  notifyWithdrawn,
  parseReferralEvent,
  recordSentReferral,
  referralByRef,
  referralsEnabled,
  sendReferral,
  withdrawReferral,
} from './referral';
import { EMERGENCY_NUMBERS, WELLBEING_EMERGENCY_URL, WELLBEING_SITE_URL, isWellbeingTicket, routeWellbeing } from './routing';

export const wellbeingRoutes = new Hono<AppEnv>();

/** Our request id, in the character set Team 16 accepts (8–128 of A–Z a–z 0–9 _ . : -). */
function correlationFor(c: Context<AppEnv>): string {
  const ours = String(c.get('correlationId') ?? '').replace(/[^A-Za-z0-9_.:-]/g, '-');
  if (!ours) return wellbeingCorrelationId();
  return (ours.startsWith('team14-') ? ours : `team14-${ours}`).slice(0, 128);
}

/** Same field names as the rest of our API (snake_case). */
const toJson = (s: WellbeingService) => ({ id: s.id, name: s.name, description: s.description, duration_minutes: s.durationMinutes });

wellbeingRoutes.get('/wellbeing/services', async (c) => {
  const list = await listWellbeingServices(c.env.WELLBEING_API_URL, correlationFor(c));
  return c.json({ available: list.available, stale: list.stale, services: list.services.map(toJson) });
});

/** Always sent, so the UI can show the emergency numbers and the booking link even when Team 16 is down. */
const base = (ticketId: number) => ({
  ticket_id: ticketId,
  emergency_numbers: EMERGENCY_NUMBERS,
  emergency_url: WELLBEING_EMERGENCY_URL,
  booking_url: WELLBEING_SITE_URL,
});

wellbeingRoutes.get('/tickets/:id/wellbeing-suggestion', async (c) => {
  const id = parseId(c.req.param('id'));
  const ticket = await getTicket(c.env.DB, id);
  if (!ticket) throw notFound('Ticket not found');
  if (!canViewTicket(c.get('user'), ticket)) throw forbidden('You can only view your own tickets');

  // Brief §8 rule 1: danger first, on EVERY ticket — emergency numbers, and no appointment is suggested.
  const route = routeWellbeing(`${ticket.title}\n${ticket.description}`);
  // A service is suggested only on a Wellbeing ticket (a projector "in the lecture hall" is a repair, not exam stress).
  const wellbeingTicket = isWellbeingTicket(ticket);
  // Referral (proposal): only read while the feature is on, so the table is not needed before the migration runs.
  const enabled = referralsEnabled(c.env);
  const latest = enabled ? await latestReferral(c.env.DB, id) : null;
  const referral = latest ? { status: latest.status, status_at: latest.status_at } : null;

  if (!route.danger && !wellbeingTicket) {
    return c.json({ ...base(id), available: true, danger: false, wellbeing_ticket: false, suggested_service: null, referrals_enabled: enabled, referral });
  }
  const list = await listWellbeingServices(c.env.WELLBEING_API_URL, correlationFor(c));
  // A service the admin chose wins over the keyword guess; either must still be in the live list (else hidden).
  const chosen = route.danger ? null : findService(list, ticket.wellbeing_service_id) ?? findService(list, route.serviceId);

  return c.json({
    ...base(id),
    available: list.available,
    danger: route.danger,
    wellbeing_ticket: wellbeingTicket,
    suggested_service: chosen ? toJson(chosen) : null,
    referrals_enabled: enabled,
    referral,
  });
});

// ---------- Referral to Wellbeing (proposal; off unless WELLBEING_REFERRALS = 'on') ----------

/** Only the requester can refer themselves: the consent is theirs, not the admin's. */
async function loadOwnTicket(c: Context<AppEnv>) {
  if (!referralsEnabled(c.env)) throw conflict('Referral to Wellbeing is not available yet');
  const user = c.get('user');
  const ticket = await getTicket(c.env.DB, parseId(c.req.param('id')));
  if (!ticket) throw notFound('Ticket not found');
  if (user.role !== 'customer' || ticket.customer_id !== user.id) throw forbidden('Only the requester can send or withdraw a referral');
  return ticket;
}

wellbeingRoutes.post('/tickets/:id/wellbeing-referral', async (c) => {
  const ticket = await loadOwnTicket(c);
  const body = await readJson<{ consent?: unknown }>(c);
  if (body.consent !== true) throw new ApiError(422, 'ValidationError', 'Please tick the consent box first', { fields: { consent: 'required' } });

  if (ticket.status === 'resolved' || ticket.status === 'closed') throw conflict('This ticket is already resolved');
  if (!isWellbeingTicket(ticket)) throw conflict('Only Wellbeing tickets can be referred');
  const route = routeWellbeing(`${ticket.title}\n${ticket.description}`);
  if (route.danger) throw conflict('Please use the emergency numbers: a referral is not crisis support');
  const latest = await latestReferral(c.env.DB, ticket.id);
  if (latest && (latest.status === 'sent' || latest.status === 'approved')) throw conflict('This ticket has already been referred');

  const ref = newReferralRef();
  const consentAt = new Date().toISOString();
  const cid = correlationFor(c);
  // Team 16 answers 400 for a service it does not have, so send only an id that is in their live list; else null.
  const list = await listWellbeingServices(c.env.WELLBEING_API_URL, cid);
  const serviceId = (findService(list, ticket.wellbeing_service_id) ?? findService(list, route.serviceId))?.id ?? null;
  const sent = await sendReferral(c.env, { ref, service_id: serviceId, consent_at: consentAt }, cid);
  console.log(JSON.stringify({ level: sent.kind === 'sent' ? 'info' : 'warn', msg: 'wellbeing referral send', ticketId: ticket.id, outcome: sent.kind, correlationId: cid }));
  if (sent.kind === 'rejected') throw new ApiError(502, 'BadGateway', `Wellbeing did not accept the referral (HTTP ${sent.status})`);
  if (sent.kind === 'unavailable') throw new ApiError(503, 'ServiceUnavailable', 'Cannot reach Wellbeing right now. Nothing was sent. Please try again, or book on their site.');

  await recordSentReferral(c.env, ticket, ref, serviceId, consentAt, sent.wellbeingId);
  return c.json({ message: 'Referral sent', data: { status: 'sent' } }, 201);
});

wellbeingRoutes.delete('/tickets/:id/wellbeing-referral', async (c) => {
  const ticket = await loadOwnTicket(c);
  const latest = await latestReferral(c.env.DB, ticket.id);
  if (!latest || (latest.status !== 'sent' && latest.status !== 'approved')) throw conflict('There is no active referral to withdraw');
  await withdrawReferral(c.env, ticket, latest);
  await notifyWithdrawn(c.env, latest.ref, correlationFor(c));
  return c.json({ message: 'Referral withdrawn', data: { status: 'withdrawn' } });
});

/**
 * Team 16 → us when their staff approve or decline a referral (final; no cancel). HMAC-signed exactly like Team 10:
 *   X-Timestamp: unix seconds · X-Signature: hex(HMAC-SHA256(WELLBEING_WEBHOOK_SECRET, `${X-Timestamp}.${rawBody}`))
 *   { "eventId", "type": "wellbeing.referral_status", "data": { "ref": "hd-…", "status": "approved"|"declined" } }
 * They retry 408/429/5xx with the same eventId, so a retry is answered "duplicate".
 * One log line per call (ids and status words only).
 */
wellbeingRoutes.post('/webhooks/wellbeing', async (c) => {
  const trace = (http: number, outcome: string, extra: Record<string, unknown> = {}) =>
    console.log(JSON.stringify({ level: http >= 400 ? 'warn' : 'info', msg: 'wellbeing webhook', http, outcome, correlationId: c.get('correlationId'), ...extra }));

  const rawBody = await c.req.text();
  const verdict = await verifyWebhook({
    secret: c.env.WELLBEING_WEBHOOK_SECRET,
    timestamp: c.req.header('x-timestamp'),
    signature: c.req.header('x-signature'),
    rawBody,
    now: new Date(),
  });
  if (!verdict.ok) {
    trace(verdict.reason === 'not configured' ? 503 : 401, `signature: ${verdict.reason}`, { hasTimestamp: !!c.req.header('x-timestamp'), hasSignature: !!c.req.header('x-signature') });
    if (verdict.reason === 'not configured') throw new ApiError(503, 'ServiceUnavailable', 'The Helpdesk webhook secret is not configured');
    throw new ApiError(401, 'Unauthorized', `Invalid signature (${verdict.reason})`);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    trace(400, 'body is not JSON');
    throw badRequest('Body is not valid JSON');
  }
  const parsed = parseReferralEvent(body);
  if (!parsed.ok) {
    const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
    trace(400, `envelope: ${parsed.message}`, { keys: Object.keys(b) });
    throw badRequest(parsed.message);
  }
  const { eventId, ref, status } = parsed.event;

  const seen = await c.env.DB.prepare('SELECT 1 AS x FROM processed_events WHERE event_id = ?').bind(eventId).first();
  if (seen) {
    trace(200, 'duplicate event id, ignored', { eventId, status });
    return c.json({ received: true, duplicate: true });
  }
  const referral = await referralByRef(c.env.DB, ref);
  if (!referral) {
    trace(202, 'unknown reference', { eventId, status });
    return c.json({ received: true, known: false }, 202);
  }
  const out = await applyReferralStatus(c.env, referral, status, eventId);
  trace(200, out.outcome === 'applied' ? `applied (${out.ticket})` : `${out.outcome}${out.reason ? `: ${out.reason}` : ''}`, { eventId, status, ticketId: referral.ticket_id });
  return c.json({ received: true, ...(out.outcome === 'duplicate' ? { duplicate: true } : {}), ...(out.outcome === 'ignored' ? { ignored: out.reason } : {}) });
});

