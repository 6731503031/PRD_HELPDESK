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
 * TODO(P3, F29):
 *  - missing secret            → { ok: false, reason: 'not configured' }
 *  - missing timestamp/signature → { ok: false, reason: 'missing headers' }
 *  - timestamp not a number or older/newer than MAX_SKEW_SECONDS → { ok: false, reason: 'stale' }
 *  - expected = await hmacHex(secret, `${timestamp}.${rawBody}`)
 *  - safeEqual(expected, signature.toLowerCase()) ? { ok: true } : { ok: false, reason: 'bad signature' }
 * Then un-skip test/maintenance.test.ts.
 */
export async function verifyWebhook(input: VerifyInput): Promise<{ ok: boolean; reason?: string }> {
  void input;
  return { ok: false, reason: 'not implemented' }; // TODO(P3, F29) — rejecting everything is the safe default
}
