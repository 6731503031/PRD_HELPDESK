/**
 * PDPA consent (พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562) — PRD §13 Data Protection.
 * Owner: P1 (Core & Tickets)
 *
 *   s.23  tell people what we collect, why, who receives it, how long, their rights → the notice
 *         (text: frontend/src/lib/privacy.ts, shown before the name form and at #/privacy)
 *   s.19  consent is asked before collecting, and we can SHOW it was given → privacy_consents log
 *   s.19  withdrawing must be as easy as giving → DELETE /me/consent (button on "My profile")
 *
 * Changing the notice text? Bump PRIVACY_NOTICE_VERSION here AND in frontend/src/lib/privacy.ts
 * (backend/test/privacy.test.ts checks they match). Everyone is then asked to accept the new version.
 */

export const PRIVACY_NOTICE_VERSION = '1.0';

export type ConsentAction = 'accepted' | 'withdrawn';
export type ConsentRow = { notice_version: string; action: ConsentAction; created_at: string };

export type ConsentStatus = {
  /** The version the person must accept now. */
  notice_version: string;
  /** true only when the newest answer is "accepted" for the CURRENT version. */
  accepted: boolean;
  accepted_at: string | null;
  /** The newest answer of any version (null = never answered). */
  last_action: ConsentAction | null;
  last_action_at: string | null;
};

/** PURE — current state from the person's newest log row. */
export function consentStatus(latest: ConsentRow | null, current = PRIVACY_NOTICE_VERSION): ConsentStatus {
  const accepted = !!latest && latest.action === 'accepted' && latest.notice_version === current;
  return {
    notice_version: current,
    accepted,
    accepted_at: accepted ? latest!.created_at : null,
    last_action: latest?.action ?? null,
    last_action_at: latest?.created_at ?? null,
  };
}

/**
 * PURE — the client must send the version the person actually read (not just `true`),
 * so an old page cannot accept a notice the person never saw.
 */
export function checkAcceptance(value: unknown, current = PRIVACY_NOTICE_VERSION): { ok: true } | { ok: false; message: string } {
  if (value === undefined || value === null || value === '' || value === false) {
    return { ok: false, message: 'Please read and accept the privacy notice to continue' };
  }
  if (value !== current) {
    return { ok: false, message: `The privacy notice has been updated (version ${current}). Please read it again and accept` };
  }
  return { ok: true };
}

export async function latestConsent(db: D1Database, userId: number): Promise<ConsentRow | null> {
  return db
    .prepare('SELECT notice_version, action, created_at FROM privacy_consents WHERE user_id = ? ORDER BY id DESC LIMIT 1')
    .bind(userId)
    .first<ConsentRow>();
}

export async function recordConsent(db: D1Database, userId: number, action: ConsentAction, version = PRIVACY_NOTICE_VERSION) {
  await db
    .prepare('INSERT INTO privacy_consents (user_id, notice_version, action) VALUES (?, ?, ?)')
    .bind(userId, version, action)
    .run();
}
