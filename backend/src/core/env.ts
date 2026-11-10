/**
 * Shared types for the whole Worker.
 * Owner: P1 (Core & Tickets). Other modules import from here — do not redefine.
 */
import type { Role } from './identity';

/** Cloudflare bindings + vars + secrets (see wrangler.toml). */
export type Bindings = {
  DB: D1Database;
  /** Workers AI — used by src/ai (P4). */
  AI?: Ai;
  ENVIRONMENT: string;
  WELLBEING_API_URL: string;
  /** 'on' = requesters may send a referral to Wellbeing (Team 16). Anything else hides it. Off until Team 16 is ready. */
  WELLBEING_REFERRALS?: string;
  /** Secret (optional): Bearer token for Team 16's referral API. `wrangler secret put WELLBEING_API_KEY` */
  WELLBEING_API_KEY?: string;
  /** Secret: shared HMAC key for Team 16 referral callbacks. `wrangler secret put WELLBEING_WEBHOOK_SECRET` */
  WELLBEING_WEBHOOK_SECRET?: string;
  /** Team 10 Maintenance base URL, e.g. https://…/api/v1 — empty until Team 10 confirms. */
  MAINTENANCE_API_URL: string;
  /** Link to Team 10's report-a-repair page, shown to the admin as a button. Empty until Team 10 gives it (see core/config.ts). */
  MAINTENANCE_PORTAL_URL?: string;
  /** Secret (optional): credential for calling Team 10's API, sent as a Bearer token until the scheme is agreed. */
  MAINTENANCE_API_KEY?: string;
  /** Secret: shared HMAC key for Team 10 webhooks. `wrangler secret put MAINTENANCE_WEBHOOK_SECRET` */
  MAINTENANCE_WEBHOOK_SECRET?: string;
  /** Where outbound events are POSTed (Notification Hub). Empty = store in outbox only. */
  EVENT_HUB_URL: string;
  /** Secret: HMAC key used to sign our outbound events. */
  EVENT_SIGNING_SECRET?: string;
};

/** The signed-in user, set by requireAuth. */
export type AuthUser = { id: number; role: Role; displayName: string };

/** Per-request variables (c.get / c.set). */
export type Variables = {
  user: AuthUser;
  correlationId: string;
};

export type AppEnv = { Bindings: Bindings; Variables: Variables };
