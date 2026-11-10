/**
 * Anonymous requesters ("guests") — Identity stub, PRD §20.
 * Owner: P1 (Core & Tickets)
 *
 * A guest clicks "เข้าสู่ระบบ", gives a display name (+ optional contact email) and gets an id >= 1000.
 * Nothing is verified: it is a self-declared profile, NOT an account. The browser remembers the id.
 * Guests are always role 'customer'. The admin comes only from the static directory in identity.ts.
 *
 * Real SSO later = replace identity.ts + auth.ts; this file then goes away.
 */
import { GUEST_ID_MIN, isGuestId, verify, type IdentityRef } from './identity';

type ProfileRow = { id: number; full_name: string; email: string | null };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** PURE — name 2–60 chars, email optional (≤120, basic shape). */
export function validateProfile(
  input: { name?: unknown; email?: unknown },
): { ok: true; value: { name: string; email: string | null } } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const rawEmail = typeof input.email === 'string' ? input.email.trim() : '';

  if (name.length < 2) errors.name = 'Please enter a name of at least 2 characters';
  else if (name.length > 60) errors.name = 'Name must be 60 characters or fewer';
  if (rawEmail && (rawEmail.length > 120 || !EMAIL.test(rawEmail))) errors.email = 'Invalid email address';

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { name, email: rawEmail || null } };
}

/** Static directory first, then a guest profile. Returns null for unknown ids. */
export async function findIdentity(db: D1Database, id: number): Promise<IdentityRef | null> {
  const known = verify(id);
  if (known) return known;
  if (!isGuestId(id)) return null;
  const row = await db.prepare('SELECT id, full_name, email FROM user_profiles WHERE id = ?').bind(id).first<ProfileRow>();
  return row ? { externalId: row.id, displayName: row.full_name, role: 'customer', email: row.email ?? '' } : null;
}

/** id → display name for lists (tickets, history, messages). Unknown ids are simply absent. */
export async function displayNames(db: D1Database, ids: Array<number | null | undefined>): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  const guests: number[] = [];
  for (const id of new Set(ids)) {
    if (id == null) continue;
    const known = verify(id);
    if (known) out.set(id, known.displayName);
    else if (isGuestId(id)) guests.push(id);
  }
  for (let i = 0; i < guests.length; i += 50) {
    const chunk = guests.slice(i, i + 50);
    const { results } = await db
      .prepare(`SELECT id, full_name FROM user_profiles WHERE id IN (${chunk.map(() => '?').join(',')})`)
      .bind(...chunk)
      .all<{ id: number; full_name: string }>();
    for (const r of results ?? []) out.set(r.id, r.full_name);
  }
  return out;
}

/**
 * Creates the guest AND logs their PDPA consent in one batch (one transaction in D1):
 * a profile never exists without the consent that allowed us to collect it.
 */
export async function createGuest(
  db: D1Database,
  v: { name: string; email: string | null },
  noticeVersion: string,
): Promise<ProfileRow> {
  const [created] = await db.batch<ProfileRow>([
    db
      .prepare(
        `INSERT INTO user_profiles (id, full_name, email)
         VALUES ((SELECT COALESCE(MAX(id), ${GUEST_ID_MIN - 1}) + 1 FROM user_profiles), ?, ?)
         RETURNING id, full_name, email`,
      )
      .bind(v.name, v.email),
    db
      .prepare(
        `INSERT INTO privacy_consents (user_id, notice_version, action)
         VALUES ((SELECT MAX(id) FROM user_profiles), ?, 'accepted')`,
      )
      .bind(noticeVersion),
  ]);
  return created.results[0];
}

export async function updateGuest(db: D1Database, id: number, v: { name: string; email: string | null }): Promise<ProfileRow | null> {
  return db
    .prepare(
      `UPDATE user_profiles SET full_name = ?, email = ?, updated_at = datetime('now')
       WHERE id = ? RETURNING id, full_name, email`,
    )
    .bind(v.name, v.email, id)
    .first<ProfileRow>();
}
