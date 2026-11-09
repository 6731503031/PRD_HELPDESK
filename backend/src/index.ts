/**
 * Helpdesk Platform — Team 14
 * Cloudflare Workers + Hono + D1 · PRD v1.0
 *
 * This file only WIRES modules together. Feature code lives in src/modules/<module>/.
 * Owner of this file: P1 (Core & Tickets). Others: add your router here only if you add a NEW module.
 *
 *   /            → web UI (static files in /public, served by Workers Assets)
 *   /api/v1/...  → REST API (platform PRD §4: versioned base path)
 *   /...         → same API without prefix (Assignment 2 Postman collection keeps working)
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { AppEnv, Bindings } from './core/env';
import { requireAuth, requireRole } from './core/auth';
import { correlationId, handleError } from './core/http';

import { referenceRoutes } from './modules/reference/routes';
import { authRoutes } from './modules/auth/routes';
import { ticketRoutes } from './modules/tickets/routes';
import { commentRoutes } from './modules/comments/routes';
import { maintenanceRoutes } from './modules/maintenance/routes';
import { triageRoutes } from './ai/routes';
import { adminRoutes } from './modules/admin/routes';
import { wellbeingRoutes } from './modules/wellbeing/routes';
import { runEscalation } from './modules/events/escalation';

// ---------- API ----------
const api = new Hono<AppEnv>();

api.get('/', (c) =>
  c.json({
    service: 'helpdesk-api',
    team: 14,
    version: '1.0.0',
    docs: '/openapi.yaml',
    health: '/api/v1/health',
  }),
);

// Who must be signed in (Identity stub headers). Webhooks are NOT here — they use HMAC.
api.use('/tickets', requireAuth);
api.use('/tickets/*', requireAuth);
api.use('/me', requireAuth); // /auth/guest is public: it is how a guest gets an id
api.use('/admin/*', requireAuth, requireRole('admin'));

api.route('/', referenceRoutes);   // P1
api.route('/', authRoutes);        // P1 — guest sign-in + /me
api.route('/', triageRoutes);      // P4 — before tickets so /tickets/suggest is matched first
api.route('/', ticketRoutes);      // P1
api.route('/', commentRoutes);     // P2
api.route('/', maintenanceRoutes); // P3
api.route('/', wellbeingRoutes);   // P3
api.route('/', adminRoutes);       // P4

// ---------- App ----------
const app = new Hono<AppEnv>();
app.use('*', logger());
app.use('*', correlationId);
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'x-user-id', 'x-user-role', 'x-correlation-id', 'x-timestamp', 'x-signature'],
    exposeHeaders: ['X-Correlation-Id'],
  }),
);

app.route('/api/v1', api);
app.route('/', api); // legacy paths (Assignment 2)

app.notFound((c) => c.json({ error: 'NotFound', message: 'Endpoint not found', path: c.req.path }, 404));
app.onError(handleError);

export default {
  fetch: app.fetch,
  // PRD §14 escalation — Cron Trigger in wrangler.toml (P2)
  scheduled: async (_event, env, ctx) => {
    ctx.waitUntil(runEscalation(env).then((r) => console.log(JSON.stringify({ msg: 'escalation run', ...r }))));
  },
} satisfies ExportedHandler<Bindings>;
