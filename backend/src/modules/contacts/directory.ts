/**
 * Campus contacts directory for Wellbeing (Team 16) — TEAM14-API-FOR-WELLBEING-BRIEF Part A. PURE (easy to unit test).
 * Owner: P3 (Integrations)
 *
 * Stored as a file, not a table: Helpdesk has no admin page for contacts, and the brief allows a file.
 * Changing a number = edit this list + deploy.
 *
 * The numbers are PLACEHOLDERS (verified: false). Wellbeing shows unverified numbers as "demo".
 * Set verified: true only after checking a number against an official university source.
 * National hotlines (1669, 1323, …) are NOT listed: Wellbeing keeps those hard-coded.
 */

export const CONTACT_TYPES = ['emergency', 'service', 'support'] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export type Contact = {
  id: string;
  name: string;
  phone: string;
  tel: string;
  hours: string;
  type: ContactType;
  available_24h: boolean;
  verified: boolean;
  updated_at: string;
};

export const CONTACTS: readonly Contact[] = [
  {
    id: 'campus_security',
    name: 'Campus security',
    phone: '0-0000-0000',
    tel: '000000000',
    hours: '24 hours',
    type: 'emergency',
    available_24h: true,
    verified: false,
    updated_at: '2026-11-10T07:00:00Z',
  },
  {
    id: 'counselling_front_desk',
    name: 'Campus counselling front desk',
    phone: '0-0000-0001',
    tel: '000000001',
    hours: 'Weekdays 08:30-16:30',
    type: 'service',
    available_24h: false,
    verified: false,
    updated_at: '2026-11-10T07:00:00Z',
  },
];

export function isContactType(value: string): value is ContactType {
  return (CONTACT_TYPES as readonly string[]).includes(value);
}

/** Emergency first, then service, then support; inside a type by name. Optional filter by type. */
export function listContacts(type?: ContactType, source: readonly Contact[] = CONTACTS): Contact[] {
  const rank = (t: ContactType) => CONTACT_TYPES.indexOf(t);
  return source
    .filter((c) => !type || c.type === type)
    .slice()
    .sort((a, b) => rank(a.type) - rank(b.type) || a.name.localeCompare(b.name, 'en'));
}

const CORRELATION_ID = /^[A-Za-z0-9_.:-]{8,128}$/;

/** Brief §3: keep the caller's X-Correlation-Id if it is 8–128 of A–Z a–z 0–9 _ . : -, else a random UUID. */
export function contactsCorrelationId(raw: string | undefined | null): string {
  return raw && CORRELATION_ID.test(raw) ? raw : crypto.randomUUID();
}
