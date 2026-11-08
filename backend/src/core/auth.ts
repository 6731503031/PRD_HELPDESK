/**
 * Authentication + role checks (PRD FR-01, FR-02, §13).
 * Owner: P1 (Core & Tickets).
 *
 * Identity is a documented STUB (PRD §20): the caller sends
 *   x-user-id: 5
 *   x-user-role: admin
 * and we verify both against src/core/identity.ts.
 * Real SSO later = change only identity.ts / this file.
 */
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from './env';
import { verify, type Role } from './identity';
import { ApiError, forbidden } from './http';

const ROLES: Role[] = ['customer', 'admin'];

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const userId = c.req.header('x-user-id');
  const declaredRole = c.req.header('x-user-role') as Role | undefined;

  if (!userId || !declaredRole) {
    throw new ApiError(401, 'Unauthorized', 'ต้องส่ง header x-user-id และ x-user-role');
  }
  if (!ROLES.includes(declaredRole)) throw forbidden('role ไม่ถูกต้อง');

  const identity = verify(Number(userId));
  if (!identity) throw new ApiError(401, 'Unauthorized', 'ไม่พบผู้ใช้นี้ใน Identity');
  if (identity.role !== declaredRole) {
    throw forbidden(`role ไม่ตรงกับ Identity (Identity ระบุว่าเป็น ${identity.role})`);
  }

  c.set('user', { id: identity.externalId, role: identity.role, displayName: identity.displayName });
  await next();
};

/** Allow only the given roles, e.g. requireRole('admin'). */
export const requireRole =
  (...roles: Role[]): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    if (!roles.includes(c.get('user').role)) {
      throw forbidden(`ต้องเป็น ${roles.join(' หรือ ')} เท่านั้น`);
    }
    await next();
  };
