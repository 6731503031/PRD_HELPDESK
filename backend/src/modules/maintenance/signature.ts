/**
 * Webhook signature (PRD §13 "Maintenance Webhook Security", proposal §7).
 * Owner: P3 (Maintenance Integration)
 *
 * Agreed scheme (Integration Proposal v0.2):
 *   X-Timestamp: <unix seconds when sent>
 *   X-Signature: hex( HMAC-SHA256( secret, `${X-Timestamp}.${rawBody}` ) )
 *   Reject if |now - X-Timestamp| > 300 seconds.
 */

const enc = new TextEncoder();

/** hex(HMAC-SHA256(secret, message)) — ready to use (also used by events/publish.ts). */
export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string compare (avoid timing attacks) — ready to use. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const MAX_SKEW_SECONDS = 300;

export type VerifyInput = {
  secret: string | undefined;
  timestamp: string | undefined;
  signature: string | undefined;
  rawBody: string;
  now: Date;
};

/**
 * F29: accept only a correctly signed, fresh event.
 *  - missing secret              -> not ok ('not configured')
 *  - missing timestamp/signature -> not ok ('missing headers')
 *  - timestamp not a number, or older/newer than MAX_SKEW_SECONDS -> not ok ('stale')
 *  - expected = HMAC-SHA256(secret, `${timestamp}.${rawBody}`), compared in constant time
 * Rejecting is the safe default: every doubt answers "not ok".
 */
export async function verifyWebhook(input: VerifyInput): Promise<{ ok: boolean; reason?: string }> {
  if (!input.secret) return { ok: false, reason: 'not configured' };
  if (!input.timestamp || !input.signature) return { ok: false, reason: 'missing headers' };
  if (!/^\d{1,12}$/.test(input.timestamp)) return { ok: false, reason: 'stale' };
  const skew = Math.abs(input.now.getTime() / 1000 - Number(input.timestamp));
  if (skew > MAX_SKEW_SECONDS) return { ok: false, reason: 'stale' };
  const expected = await hmacHex(input.secret, `${input.timestamp}.${input.rawBody}`);
  return safeEqual(expected, input.signature.trim().toLowerCase()) ? { ok: true } : { ok: false, reason: 'bad signature' };
}
