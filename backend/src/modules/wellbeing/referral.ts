/**
 * Referral to Wellbeing (Team 16) — proposal "TEAM14-WELLBEING-REFERRAL-PROPOSAL.md".
 * Owner: P3 (Integrations)
 *
 *   1. The requester ticks a separate consent and presses "Send to Wellbeing".
 *   2. We create a RANDOM reference (hd-…) and POST {WELLBEING_API_URL}/referrals { ref, service_id, consent_at }.
 *      Nothing else: no name, email, user id, ticket number or ticket text ever leaves Helpdesk.
 *   3. Team 16 staff approve or decline. Their server calls POST /webhooks/wellbeing (HMAC, like Team 10),
 *      or we ask GET {WELLBEING_API_URL}/referrals/{ref} (cron) if a callback was missed.
 *   4. approved → our ticket is resolved (same steps as the admin's Resolve button)
 *      declined → the ticket stays open; the requester may book on Wellbeing's site or send again
 *   A decision is final (Team 16 reply, 10 Nov 2026): received → approved | declined; there is no "cancelled".
 *   While waiting, Team 16 reports "received".
 *   Every step adds a status-history row and an automatic chat line. The admin sees them too: the requester is
 *   told so before consenting.
 *
 * Off unless WELLBEING_REFERRALS = 'on' (wrangler.toml), so nothing changes until Team 16 has built their side.
 */
import type { Bindings } from '../../core/env';
import { postSystemMessage } from '../comments/templates';
import { getTicket, recordStatus, type TicketRow } from '../tickets/repo';
import { resolveTicket } from '../tickets/resolve';
import { WELLBEING_TIMEOUT_MS } from './client';

// ---------- pure rules ----------

export type ReferralStatus = 'sent' | 'approved' | 'declined' | 'withdrawn';
/** The decisions Team 16 sends us. Anything else from GET /referrals/{ref} (e.g. "received") means still waiting. */
export const CALLBACK_STATUSES = ['approved', 'declined'] as const;
export type CallbackStatus = (typeof CALLBACK_STATUSES)[number];

export const REF_PATTERN = /^hd-[0-9a-f]{32}$/;

export const referralsEnabled = (env: Pick<Bindings, 'WELLBEING_REFERRALS'>) => (env.WELLBEING_REFERRALS ?? '').trim().toLowerCase() === 'on';

/** A random reference: 128 bits, not derived from the ticket or the person. The only id Team 16 ever sees. */
export function newReferralRef(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `hd-${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** Wording of every step — neutral, no appointment details (the admin reads these too). */
export const REFERRAL_TEXT = {
  sent: { history: 'Referred to Wellbeing', chat: 'Your referral has been sent to Wellbeing. This chat will show when they accept it.' },
  approved: {
    history: 'Wellbeing accepted the referral',
    resolution: 'Referred to Wellbeing and accepted.',
    chat: 'Wellbeing has accepted your referral. This ticket is now resolved. You can now book a session on the Wellbeing site, anonymously.',
  },
  declined: { history: 'Wellbeing could not take the referral', chat: 'Wellbeing could not take this referral. You can book on their site, or send it again.' },
  withdrawn: { history: 'Referral withdrawn by the requester', chat: 'You withdrew the referral. Wellbeing will no longer send updates to Helpdesk.' },
} as const;

export type ReferralEffect =
  | { apply: false; reason: string }
  | { apply: true; next: ReferralStatus; ticket: 'resolve' | 'none' };

/**
 * What a Team 16 decision does. Each reference is decided once: sent → approved | declined, and that is final.
 * A withdrawn referral, a repeat, or a second decision changes nothing.
 */
export function referralEffect(current: ReferralStatus, incoming: CallbackStatus, ticketStatus: string): ReferralEffect {
  if (current === 'withdrawn') return { apply: false, reason: 'withdrawn by the requester' };
  if (current === incoming) return { apply: false, reason: 'same status' };
  if (current !== 'sent') return { apply: false, reason: `already ${current}` };
  if (incoming === 'approved') return { apply: true, next: 'approved', ticket: ticketStatus === 'resolved' || ticketStatus === 'closed' ? 'none' : 'resolve' };
  return { apply: true, next: 'declined', ticket: 'none' };
}

export type ReferralEvent = { eventId: string; type: 'wellbeing.referral_status'; ref: string; status: CallbackStatus };

/** The callback envelope, checked strictly (field names and values only — it carries no personal data). */
export function parseReferralEvent(body: unknown): { ok: true; event: ReferralEvent } | { ok: false; message: string } {
  const b = (typeof body === 'object' && body !== null && !Array.isArray(body) ? body : {}) as Record<string, unknown>;
  const d = (typeof b.data === 'object' && b.data !== null ? b.data : {}) as Record<string, unknown>;
  const eventId = typeof b.eventId === 'string' ? b.eventId.trim() : '';
  if (!eventId || eventId.length > 128) return { ok: false, message: 'eventId is required (1-128 characters)' };
  if (b.type !== 'wellbeing.referral_status') return { ok: false, message: "type must be 'wellbeing.referral_status'" };
  if (typeof d.ref !== 'string' || !REF_PATTERN.test(d.ref)) return { ok: false, message: 'data.ref is not a Helpdesk referral reference' };
  if (!(CALLBACK_STATUSES as readonly unknown[]).includes(d.status)) return { ok: false, message: 'data.status must be approved or declined' };
  return { ok: true, event: { eventId, type: 'wellbeing.referral_status', ref: d.ref, status: d.status as CallbackStatus } };
}

// ---------- Team 16 client (never throws) ----------

const baseOf = (env: Bindings) => (env.WELLBEING_API_URL ?? '').trim().replace(/\/+$/, '');
const headersFor = (env: Bindings, correlationId: string): Record<string, string> => {
  const h: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId };
  if (env.WELLBEING_API_KEY) h.Authorization = `Bearer ${env.WELLBEING_API_KEY}`;
  return h;
};

export type SendResult = { kind: 'sent'; wellbeingId: string | null } | { kind: 'rejected'; status: number } | { kind: 'unavailable'; reason: string };

/** POST {WELLBEING_API_URL}/referrals { ref, service_id, consent_at } — 201/200 sent, 4xx rejected, else unavailable. */
export async function sendReferral(
  env: Bindings,
  input: { ref: string; service_id: string | null; consent_at: string },
  correlationId: string,
): Promise<SendResult> {
  const base = baseOf(env);
  if (!base) return { kind: 'unavailable', reason: 'not configured' };
  try {
    const res = await fetch(`${base}/referrals`, {
      method: 'POST',
      headers: headersFor(env, correlationId),
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(WELLBEING_TIMEOUT_MS),
    });
    if (res.status >= 400 && res.status < 500) return { kind: 'rejected', status: res.status };
    if (!res.ok) return { kind: 'unavailable', reason: `HTTP ${res.status}` };
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const id = body.id ?? (body.data as Record<string, unknown> | undefined)?.id;
    return { kind: 'sent', wellbeingId: typeof id === 'string' ? id.slice(0, 128) : null };
  } catch (err) {
    return { kind: 'unavailable', reason: err instanceof Error ? err.name : 'error' };
  }
}

export type StatusResult = { kind: 'found'; status: string } | { kind: 'not_found' } | { kind: 'unavailable'; reason: string };

/** GET {WELLBEING_API_URL}/referrals/{ref} → { status } — used when a callback was missed. */
export async function fetchReferralStatus(env: Bindings, ref: string, correlationId: string): Promise<StatusResult> {
  const base = baseOf(env);
  if (!base) return { kind: 'unavailable', reason: 'not configured' };
  try {
    const res = await fetch(`${base}/referrals/${encodeURIComponent(ref)}`, {
      headers: headersFor(env, correlationId),
      signal: AbortSignal.timeout(WELLBEING_TIMEOUT_MS),
    });
    if (res.status === 404) return { kind: 'not_found' };
    if (!res.ok) return { kind: 'unavailable', reason: `HTTP ${res.status}` };
    const body = (await res.json()) as Record<string, unknown>;
    const status = body.status ?? (body.data as Record<string, unknown> | undefined)?.status;
    return typeof status === 'string' ? { kind: 'found', status } : { kind: 'unavailable', reason: 'unexpected response' };
  } catch (err) {
    return { kind: 'unavailable', reason: err instanceof Error ? err.name : 'error' };
  }
}

/** Best effort: tell Team 16 the requester withdrew, so they can delete the reference. Never blocks. */
export async function notifyWithdrawn(env: Bindings, ref: string, correlationId: string): Promise<void> {
  const base = baseOf(env);
  if (!base) return;
  try {
    await fetch(`${base}/referrals/${encodeURIComponent(ref)}`, { method: 'DELETE', headers: headersFor(env, correlationId), signal: AbortSignal.timeout(WELLBEING_TIMEOUT_MS) });
  } catch {
    /* ignored: our side already stopped accepting updates */
  }
}

// ---------- database ----------

export type ReferralRow = {
  id: number;
  ticket_id: number;
  ref: string;
  service_id: string | null;
  status: ReferralStatus;
  wellbeing_id: string | null;
  consent_at: string;
  status_at: string | null;
  created_at: string;
};

const COLUMNS = 'id, ticket_id, ref, service_id, status, wellbeing_id, consent_at, status_at, created_at';

/** The newest referral of a ticket (one ticket may be sent again after a decline). */
export const latestReferral = (db: D1Database, ticketId: number) =>
  db.prepare(`SELECT ${COLUMNS} FROM wellbeing_referrals WHERE ticket_id = ? ORDER BY id DESC LIMIT 1`).bind(ticketId).first<ReferralRow>();

export const referralByRef = (db: D1Database, ref: string) =>
  db.prepare(`SELECT ${COLUMNS} FROM wellbeing_referrals WHERE ref = ?`).bind(ref).first<ReferralRow>();

export async function recordSentReferral(
  env: Bindings,
  ticket: TicketRow,
  ref: string,
  serviceId: string | null,
  consentAt: string,
  wellbeingId: string | null,
): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO wellbeing_referrals (ticket_id, ref, service_id, status, wellbeing_id, consent_at, status_at) VALUES (?, ?, ?, 'sent', ?, ?, datetime('now'))`,
    ).bind(ticket.id, ref, serviceId, wellbeingId, consentAt),
    env.DB.prepare(
      `INSERT INTO ticket_status_history (ticket_id, from_status, to_status, changed_by, source, note) VALUES (?, ?, ?, ?, 'wellbeing', ?)`,
    ).bind(ticket.id, ticket.status, ticket.status, ticket.customer_id, REFERRAL_TEXT.sent.history),
    env.DB.prepare(`UPDATE tickets SET updated_at = datetime('now') WHERE id = ?`).bind(ticket.id),
  ]);
  await postSystemMessage(env.DB, ticket.id, REFERRAL_TEXT.sent.chat);
}

export async function withdrawReferral(env: Bindings, ticket: TicketRow, referral: ReferralRow): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(`UPDATE wellbeing_referrals SET status = 'withdrawn', withdrawn_at = datetime('now'), status_at = datetime('now') WHERE id = ?`).bind(referral.id),
    env.DB.prepare(
      `INSERT INTO ticket_status_history (ticket_id, from_status, to_status, changed_by, source, note) VALUES (?, ?, ?, ?, 'wellbeing', ?)`,
    ).bind(ticket.id, ticket.status, ticket.status, ticket.customer_id, REFERRAL_TEXT.withdrawn.history),
    env.DB.prepare(`UPDATE tickets SET updated_at = datetime('now') WHERE id = ?`).bind(ticket.id),
  ]);
  await postSystemMessage(env.DB, ticket.id, REFERRAL_TEXT.withdrawn.chat);
}

/**
 * Apply a Team 16 status (callback or poll). `eventId` is stored with the referral change in one batch, so a
 * retried callback is answered "duplicate" and changes nothing. The ticket step runs after it and only resolves
 * a ticket that is still open.
 */
export async function applyReferralStatus(
  env: Bindings,
  referral: ReferralRow,
  incoming: CallbackStatus,
  eventId: string | null,
): Promise<{ outcome: 'applied' | 'ignored' | 'duplicate'; reason?: string; ticket?: 'resolve' | 'none' }> {
  const ticket = await getTicket(env.DB, referral.ticket_id);
  if (!ticket) return { outcome: 'ignored', reason: 'ticket deleted' };
  const effect = referralEffect(referral.status, incoming, ticket.status);
  if (!effect.apply) {
    if (eventId) await env.DB.prepare(`INSERT OR IGNORE INTO processed_events (event_id, source, type) VALUES (?, 'wellbeing', 'wellbeing.referral_status')`).bind(eventId).run();
    return { outcome: 'ignored', reason: effect.reason };
  }

  const statements = [
    env.DB.prepare(`UPDATE wellbeing_referrals SET status = ?, status_at = datetime('now') WHERE id = ? AND status = ?`).bind(effect.next, referral.id, referral.status),
  ];
  if (eventId) {
    statements.unshift(env.DB.prepare(`INSERT INTO processed_events (event_id, source, type) VALUES (?, 'wellbeing', 'wellbeing.referral_status')`).bind(eventId));
  }
  try {
    await env.DB.batch(statements);
  } catch (err) {
    if (eventId && String(err).includes('UNIQUE')) return { outcome: 'duplicate' };
    throw err;
  }

  const text = REFERRAL_TEXT[effect.next as 'approved' | 'declined'];
  if (effect.ticket === 'resolve') {
    const t = REFERRAL_TEXT.approved;
    await resolveTicket(env, ticket, { by: null, source: 'wellbeing', resolutionNote: t.resolution, historyNote: t.history, chat: t.chat });
  } else {
    await recordStatus(env.DB, ticket.id, ticket.status, ticket.status, null, 'wellbeing', text.history);
    await env.DB.prepare(`UPDATE tickets SET updated_at = datetime('now') WHERE id = ?`).bind(ticket.id).run();
    if (ticket.status !== 'resolved' && ticket.status !== 'closed') await postSystemMessage(env.DB, ticket.id, text.chat);
  }
  return { outcome: 'applied', ticket: effect.ticket };
}

/**
 * Cron: ask Team 16 about referrals still waiting ('sent'), oldest first. Only when referrals are on.
 * Team 16 deletes a referral 30 days after it arrived, so older ones are no longer asked about (they would only
 * answer 404 and, oldest first, keep newer referrals out of the batch).
 */
export const REFERRAL_SYNC_BATCH = 20;
export const REFERRAL_MAX_AGE_DAYS = 30;
export async function syncSentReferrals(env: Bindings): Promise<{ checked: number; changed: number; failed: number; skipped?: string }> {
  if (!referralsEnabled(env)) return { checked: 0, changed: 0, failed: 0, skipped: 'referrals off' };
  const { results } = await env.DB.prepare(
    `SELECT ${COLUMNS} FROM wellbeing_referrals
     WHERE status = 'sent' AND created_at > datetime('now', ?)
     ORDER BY COALESCE(status_at, created_at) ASC LIMIT ?`,
  )
    .bind(`-${REFERRAL_MAX_AGE_DAYS} days`, REFERRAL_SYNC_BATCH)
    .all<ReferralRow>();
  let changed = 0;
  let failed = 0;
  for (const r of results ?? []) {
    const found = await fetchReferralStatus(env, r.ref, `team14-sync-${crypto.randomUUID()}`);
    if (found.kind !== 'found') {
      failed++;
      console.log(JSON.stringify({ level: 'warn', msg: 'wellbeing referral sync', ticketId: r.ticket_id, outcome: found.kind }));
      continue;
    }
    if (!(CALLBACK_STATUSES as readonly string[]).includes(found.status)) continue; // still waiting (e.g. "sent", "received")
    try {
      const out = await applyReferralStatus(env, r, found.status as CallbackStatus, null);
      if (out.outcome === 'applied') changed++;
      console.log(JSON.stringify({ level: 'info', msg: 'wellbeing referral sync', ticketId: r.ticket_id, status: found.status, outcome: out.outcome }));
    } catch (err) {
      failed++;
      console.error(JSON.stringify({ level: 'error', msg: 'wellbeing referral sync failed', ticketId: r.ticket_id, err: String(err) }));
    }
  }
  return { checked: results?.length ?? 0, changed, failed };
}
