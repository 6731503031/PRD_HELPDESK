/**
 * Sign-in helpers for the Identity stub (PRD FR-01, §20).
 * Owner: P1 (Core & Tickets)
 *
 *   POST /auth/guest   { name, email? }   PUBLIC  → creates an anonymous requester, returns { id, role, full_name, email }
 *   GET  /me                              signed in → who am I (the UI uses it to check a remembered session)
 *   PUT  /me           { name, email? }   signed in → a guest changes their own display name / contact email
 *
 * Nothing here verifies who the person is. It only gives them an id to own tickets with.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../core/env';
import { ApiError, badRequest, notFound } from '../../core/http';
import { isGuestId } from '../../core/identity';
import { createGuest, findIdentity, updateGuest, validateProfile } from '../../core/profiles';
import { readJson } from '../../core/http';

export const authRoutes = new Hono<AppEnv>();

const shape = (p: { id: number; full_name: string; email: string | null }) => ({
  id: p.id,
  full_name: p.full_name,
  role: 'customer' as const,
  email: p.email ?? '',
});

authRoutes.post('/auth/guest', async (c) => {
  const parsed = validateProfile(await readJson<{ name?: unknown; email?: unknown }>(c));
  if (!parsed.ok) throw new ApiError(422, 'ValidationError', 'ข้อมูลไม่ครบหรือไม่ถูกต้อง', { fields: parsed.errors });
  const created = await createGuest(c.env.DB, parsed.value);
  return c.json({ message: 'Guest created', data: shape(created) }, 201);
});

authRoutes.get('/me', async (c) => {
  const user = c.get('user');
  const identity = await findIdentity(c.env.DB, user.id);
  if (!identity) throw notFound('ไม่พบผู้ใช้');
  return c.json({ data: { id: identity.externalId, full_name: identity.displayName, role: identity.role, email: identity.email } });
});

authRoutes.put('/me', async (c) => {
  const user = c.get('user');
  if (!isGuestId(user.id)) throw badRequest('บัญชีทดสอบแก้ข้อมูลไม่ได้');
  const parsed = validateProfile(await readJson<{ name?: unknown; email?: unknown }>(c));
  if (!parsed.ok) throw new ApiError(422, 'ValidationError', 'ข้อมูลไม่ครบหรือไม่ถูกต้อง', { fields: parsed.errors });
  const updated = await updateGuest(c.env.DB, user.id, parsed.value);
  if (!updated) throw notFound('ไม่พบผู้ใช้');
  return c.json({ message: 'Profile updated', data: shape(updated) });
});
