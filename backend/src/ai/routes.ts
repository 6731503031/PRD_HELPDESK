/**
 * POST /tickets/suggest (PRD §9.3) — returns a suggestion, never saves anything.
 * Owner: P4 (AI Triage & Admin)
 *
 * Request:  { subject, description, urgency? }
 * Response: { data: Suggestion }   — see fallback.ts
 *   { category_id, category_name, priority, route, source: 'ai' | 'fallback', reason }
 *
 * The Create Ticket page already calls this and pre-fills the form;
 * the user can change every field before submitting (human-in-the-loop, §8.4).
 */
import { Hono } from 'hono';
import type { AppEnv } from '../core/env';
import { notImplemented } from '../core/http';

export const triageRoutes = new Hono<AppEnv>();

/**
 * TODO(P4, F19–F22):
 *  1. body = readJson ; subject + description required (400)
 *  2. categories = SELECT id, name FROM ticket_categories WHERE is_active = 1
 *  3. raw = await askAi(env, input) ; suggestion = validateAiOutput(raw, categories)
 *  4. suggestion ?? suggestFallback(input)
 *  5. 200 { data: suggestion }
 */
triageRoutes.post('/tickets/suggest', async () => {
  throw notImplemented('F19 AI triage suggestion', 'P4');
});
