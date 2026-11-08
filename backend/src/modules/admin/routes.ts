/**
 * Admin endpoints (PRD §2 Admin: manage categories, view basic ticket counts).
 * Owner: P4 (AI Triage & Admin)
 * Mounted behind requireAuth + requireRole('admin') in src/index.ts.
 *
 *   GET   /admin/stats              F24 → { data: { by_status: {open: 3, …}, by_priority: {…}, total } }
 *   POST  /admin/categories         F23 → { name, description? }        201
 *   PATCH /admin/categories/:id     F23 → { is_active?: boolean, name?, description? }
 *
 * The Admin page (public/js/pages/admin.js) already calls these.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../core/env';
import { notImplemented } from '../../core/http';

export const adminRoutes = new Hono<AppEnv>();

/** TODO(P4, F24): SELECT status, COUNT(*) … GROUP BY status ; same for priority. */
adminRoutes.get('/admin/stats', async () => {
  throw notImplemented('F24 Ticket counts', 'P4');
});

/** TODO(P4, F23): validate name (2–50 chars, unique → 409), INSERT, return the row. */
adminRoutes.post('/admin/categories', async () => {
  throw notImplemented('F23 Manage categories', 'P4');
});

/** TODO(P4, F23): deactivate = is_active 0 (never DELETE — old tickets still point to it). */
adminRoutes.patch('/admin/categories/:id', async () => {
  throw notImplemented('F23 Manage categories', 'P4');
});
