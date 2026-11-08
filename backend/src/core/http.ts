/**
 * HTTP helpers shared by every module.
 * Owner: P1 (Core & Tickets).
 *
 * Error format (all endpoints):
 *   { "error": "BadRequest", "message": "…", ...extra }
 */
import type { Context, MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from './env';

export class ApiError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 422 | 501 | 502 | 503,
    public code: string,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export const badRequest = (message: string, extra?: Record<string, unknown>) =>
  new ApiError(400, 'BadRequest', message, extra);
export const forbidden = (message: string) => new ApiError(403, 'Forbidden', message);
export const notFound = (message = 'ไม่พบข้อมูล') => new ApiError(404, 'NotFound', message);
export const conflict = (message: string) => new ApiError(409, 'Conflict', message);

/**
 * Placeholder for a feature that a team member still has to build.
 * The UI shows these as "ยังไม่เปิดใช้งาน" instead of breaking.
 */
export const notImplemented = (feature: string, owner: string) =>
  new ApiError(501, 'NotImplemented', `ฟีเจอร์ ${feature} ยังไม่ได้ทำ (ผู้รับผิดชอบ: ${owner})`, {
    feature,
    owner,
  });

/** Read a JSON body; invalid JSON → 400 instead of 500. */
export async function readJson<T = Record<string, unknown>>(c: Context): Promise<T> {
  try {
    return (await c.req.json()) as T;
  } catch {
    throw badRequest('request body ต้องเป็น JSON ที่ถูกต้อง');
  }
}

/** Parse a positive integer path param or throw 400. */
export function parseId(raw: string | undefined, name = 'id'): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw badRequest(`${name} ไม่ถูกต้อง`);
  return n;
}

/** X-Correlation-Id: accept the caller's, or create one; echo it back (platform PRD §4). */
export const correlationId: MiddlewareHandler<AppEnv> = async (c, next) => {
  const id = c.req.header('x-correlation-id') || `team14-${crypto.randomUUID()}`;
  c.set('correlationId', id);
  c.header('X-Correlation-Id', id);
  await next();
};

/** Central error handler — never leaks stack traces to the client. */
export function handleError(err: Error, c: Context<AppEnv>) {
  if (err instanceof ApiError) {
    return c.json({ error: err.code, message: err.message, ...err.extra }, err.status);
  }
  if (err instanceof HTTPException) {
    return c.json({ error: 'HttpError', message: err.message }, err.status);
  }
  console.error(JSON.stringify({ level: 'error', correlationId: c.get('correlationId'), err: String(err) }));
  return c.json(
    { error: 'InternalServerError', message: 'มีบางอย่างผิดพลาด', correlationId: c.get('correlationId') },
    500,
  );
}
