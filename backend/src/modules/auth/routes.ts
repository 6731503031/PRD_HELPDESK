/**
 * Sign-in helpers for the Identity stub (PRD FR-01, §20) + PDPA consent (PRD §13).
 * Owner: P1 (Core & Tickets)
 *
 *   POST   /auth/guest   { name, email?, privacy_notice_version }  PUBLIC → creates an anonymous requester
 *                                                                  only if they accepted the current privacy notice
 *   GET    /me                                    signed in → who am I (the UI uses it to check a remembered session)
 *   PUT    /me           { name, email? }         signed in → a guest changes their own display name / contact email
 *   GET    /me/consent                            signed in → has this person accepted the current privacy notice?
 *   POST   /me/consent   { notice_version }       signed in → accept (demo accounts, or after the notice changed)
 *   DELETE /me/consent                            signed in → withdraw consent (PDPA s.19)
 *
 * Nothing here verifies who the person is. It only gives them an id to own tickets with.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../core/env';
import { ApiError, badRequest, notFound } from '../../core/http';
import { isGuestId } from '../../core/identity';
import { createGuest, findIdentity, updateGuest, validateProfile } from '../../core/profiles';
import { checkAcceptance, consentStatus, latestConsent, PRIVACY_NOTICE_VERSION, recordConsent } from '../../core/privacy';
import { readJson } from '../../core/http';

export const authRoutes = new Hono<AppEnv>();

const shape = (p: { id: number; full_name: string; email: string | null }) => ({
  id: p.id,
  full_name: p.full_name,
  role: 'customer' as const,
  email: p.email ?? '',
});

authRoutes.post('/auth/guest', async (c) => {
  const body = await readJson<{ name?: unknown; email?: unknown; privacy_notice_version?: unknown }>(c);
  const parsed = validateProfile(body);
  const consent = checkAcceptance(body.privacy_notice_version);
  if (!parsed.ok || !consent.ok) {
    const fields = { ...(parsed.ok ? {} : parsed.errors), ...(consent.ok ? {} : { privacy: consent.message }) };
    throw new ApiError(422, 'ValidationError', 'Some fields are missing or invalid', { fields });
  }
  const created = await createGuest(c.env.DB, parsed.value, PRIVACY_NOTICE_VERSION);
  return c.json({ message: 'Guest created', data: shape(created) }, 201);
});

authRoutes.get('/me', async (c) => {
  const user = c.get('user');
  const identity = await findIdentity(c.env.DB, user.id);
  if (!identity) throw notFound('User not found');
  return c.json({ data: { id: identity.externalId, full_name: identity.displayName, role: identity.role, email: identity.email } });
});

authRoutes.put('/me', async (c) => {
  const user = c.get('user');
  if (!isGuestId(user.id)) throw badRequest('Demo accounts cannot be edited');
  const parsed = validateProfile(await readJson<{ name?: unknown; email?: unknown }>(c));
  if (!parsed.ok) throw new ApiError(422, 'ValidationError', 'Some fields are missing or invalid', { fields: parsed.errors });
  const updated = await updateGuest(c.env.DB, user.id, parsed.value);
  if (!updated) throw notFound('User not found');
  return c.json({ message: 'Profile updated', data: shape(updated) });
});

// ---------- PDPA consent ----------

authRoutes.get('/me/consent', async (c) => {
  const status = consentStatus(await latestConsent(c.env.DB, c.get('user').id));
  return c.json({ data: status });
});

authRoutes.post('/me/consent', async (c) => {
  const userId = c.get('user').id;
  const body = await readJson<{ notice_version?: unknown }>(c);
  const check = checkAcceptance(body.notice_version);
  if (!check.ok) throw new ApiError(422, 'ValidationError', check.message, { fields: { privacy: check.message } });

  const before = consentStatus(await latestConsent(c.env.DB, userId));
  if (before.accepted) return c.json({ message: 'Already accepted', data: before }); // no duplicate rows
  await recordConsent(c.env.DB, userId, 'accepted');
  return c.json({ message: 'Consent recorded', data: consentStatus(await latestConsent(c.env.DB, userId)) }, 201);
});

authRoutes.delete('/me/consent', async (c) => {
  const userId = c.get('user').id;
  const latest = await latestConsent(c.env.DB, userId);
  if (latest?.action !== 'accepted') return c.json({ message: 'Nothing to withdraw', data: consentStatus(latest) });
  await recordConsent(c.env.DB, userId, 'withdrawn', latest.notice_version);
  return c.json({ message: 'Consent withdrawn', data: consentStatus(await latestConsent(c.env.DB, userId)) });
});
