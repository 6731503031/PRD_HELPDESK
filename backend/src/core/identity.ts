/**
 * Identity stub service
 *
 * Per PRD §10.2:
 *   "Helpdesk may maintain a local identity representation/reference for
 *    requester, assignee, and comment author.
 *    Authentication credentials remain owned by Identity."
 *
 * Per PRD §20 (Risks & Mitigations):
 *   "Identity integration unavailable → Use a documented development stub
 *    while preserving the Identity contract"
 *
 * Production note:
 *   When real campus Identity (SSO) is integrated, this module is the
 *   ONLY file that should need to change — replace `verify()` with a
 *   call to the Identity provider's JWT/API. Everything downstream
 *   (`requireAuth`, route handlers) consumes the same `IdentityRef`
 *   shape so callers don't need to change.
 *
 * Stub design:
 *   - `USER_DIRECTORY` mirrors what Identity would return for known users
 *   - `verify(externalId)` returns IdentityRef if the id is known, else null
 *   - In production this becomes `await identityProvider.verify(jwt)` etc.
 */

export type Role = 'customer' | 'agent' | 'admin';

export interface IdentityRef {
  /** The external id Identity issued (campus SSO subject). */
  externalId: number;
  /** Display name (mirrors Identity claim). */
  displayName: string;
  /** Role — derived from Identity group/claim. */
  role: Role;
  /** Email (mirrors Identity claim) — kept here for audit/logging only. */
  email: string;
}

/**
 * Static directory of known users.
 * Source of truth in production = campus Identity / SSO — not this map.
 * Add entries here only to mirror what's already provisioned in Identity.
 */
export const USER_DIRECTORY: Record<number, IdentityRef> = {
  1: { externalId: 1, displayName: 'Alice Customer', role: 'customer', email: 'alice@uni.ac.th' },
  2: { externalId: 2, displayName: 'Bob Customer',   role: 'customer', email: 'bob@uni.ac.th' },
  3: { externalId: 3, displayName: 'Somchai Agent',  role: 'agent',    email: 'somchai@uni.ac.th' },
  4: { externalId: 4, displayName: 'Suda Agent',     role: 'agent',    email: 'suda@uni.ac.th' },
  5: { externalId: 5, displayName: 'Admin User',     role: 'admin',    email: 'admin@uni.ac.th' },
  // ─── Test users (added 2026-08-22 — dev only) ───
  6: { externalId: 6, displayName: 'Charlie Customer', role: 'customer', email: 'charlie@uni.ac.th' },
};

/**
 * Verify an external id is known to Identity.
 * Stub: just looks up the static map.
 * Production: `return await identityProvider.lookup(jwt)` or similar.
 */
export function verify(externalId: number): IdentityRef | null {
  if (!Number.isInteger(externalId) || externalId <= 0) return null;
  return USER_DIRECTORY[externalId] ?? null;
}

/** Helper for route handlers. */
export function isAgentOrAdmin(role: Role): boolean {
  return role === 'agent' || role === 'admin';
}

/** Helper for validation in POST /tickets/:id/assign. */
export function isAssignableAgent(role: Role): boolean {
  return role === 'agent' || role === 'admin';
}
