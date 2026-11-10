/**
 * GET /contacts — campus contacts for Wellbeing (Team 16). Public, read-only, no personal data.
 * Owner: P3 (Integrations)
 *
 * This endpoint follows TEAM14-API-FOR-WELLBEING-BRIEF §3–4, which differ from the rest of our API on purpose:
 *   - the body is a plain JSON array (no { data } wrapper)
 *   - errors are { "error": "<code>" } only (no message, never the submitted value)
 *   - X-Correlation-Id is checked (8–128 of A–Z a–z 0–9 _ . : -); otherwise a new UUID is used
 *   - one JSON log line per request: method, path, status, correlation id, duration (no body, no query string)
 * Scoped to /contacts only, so the Team 10 webhook and every other route behave exactly as before.
 */
import { Hono, type Context } from 'hono';
import type { AppEnv } from '../../core/env';
import { contactsCorrelationId, isContactType, listContacts } from './directory';

export const contactsRoutes = new Hono<AppEnv>();

const JSON_TYPE = 'application/json; charset=utf-8';
const send = (c: Context<AppEnv>, body: unknown, status: 200 | 400 | 500, headers: Record<string, string> = {}) =>
  c.body(JSON.stringify(body), status, { 'Content-Type': JSON_TYPE, ...headers });

contactsRoutes.use('/contacts', async (c, next) => {
  const started = Date.now();
  const id = contactsCorrelationId(c.req.header('x-correlation-id'));
  c.set('correlationId', id);
  await next();
  c.header('X-Correlation-Id', id); // replaces the unchecked value the app-wide middleware echoed
  console.log(
    JSON.stringify({ msg: 'request', method: c.req.method, path: c.req.path, status: c.res.status, correlationId: id, ms: Date.now() - started }),
  );
});

contactsRoutes.get('/contacts', (c) => {
  try {
    const type = c.req.query('type');
    if (type !== undefined && !isContactType(type)) {
      return send(c, { error: 'validation_failed', fields: ['type'] }, 400);
    }
    return send(c, listContacts(type), 200, { 'Cache-Control': 'public, max-age=300' });
  } catch {
    return send(c, { error: 'internal_error' }, 500);
  }
});

// Any other method: 405, empty body.
contactsRoutes.all('/contacts', (c) => c.body(null, 405, { Allow: 'GET, HEAD' }));
