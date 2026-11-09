/**
 * Reference data (public, no auth).
 * Owner: P1 (Core & Tickets)
 *
 *   GET /categories          active categories (?all=true includes deactivated — for Admin page)
 *   GET /users               Identity stub directory (demo "sign in as" picker)
 *   GET /config              public UI settings (link to Team 10's report page)
 *   GET /tags
 *   GET /health              runbook health check (DB reachable?)
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../core/env';
import { portalUrl } from '../../core/config';
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

/** Public settings the UI needs (no secrets). */
referenceRoutes.get('/config', (c) => c.json({ data: { maintenance_portal_url: portalUrl(c.env.MAINTENANCE_PORTAL_URL) } }));

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
