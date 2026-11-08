/**
 * Reference data (public, no auth).
 * Owner: P1 (Core & Tickets)
 *
 *   GET /categories          active categories (?all=true includes deactivated — for Admin page)
 *   GET /users               Identity stub directory (demo "sign in as" picker)
 *   GET /tags
 *   GET /health              runbook health check (DB reachable?)
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../core/env';
import { USER_DIRECTORY } from '../../core/identity';

export const referenceRoutes = new Hono<AppEnv>();

referenceRoutes.get('/categories', async (c) => {
  const all = c.req.query('all') === 'true';
  const { results } = await c.env.DB.prepare(
    `SELECT id, name, description, is_active, created_at FROM ticket_categories ${all ? '' : 'WHERE is_active = 1'} ORDER BY id`,
  ).all();
  return c.json({ count: results?.length ?? 0, data: results ?? [] });
});

referenceRoutes.get('/users', (c) => {
  const data = Object.values(USER_DIRECTORY).map((u) => ({
    id: u.externalId,
    full_name: u.displayName,
    role: u.role,
    email: u.email,
  }));
  return c.json({ count: data.length, data });
});

referenceRoutes.get('/tags', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT id, name FROM tags ORDER BY id').all();
  return c.json({ count: results?.length ?? 0, data: results ?? [] });
});

referenceRoutes.get('/health', async (c) => {
  try {
    await c.env.DB.prepare('SELECT 1').first();
    return c.json({ status: 'ok', service: 'helpdesk', database: 'up', time: new Date().toISOString() });
  } catch {
    return c.json({ status: 'degraded', service: 'helpdesk', database: 'down' }, 503);
  }
});
