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
import { ApiError, badRequest, readJson } from '../core/http';
import { PRIORITIES, type Priority } from '../modules/tickets/rules';
import { askAi } from './ai';
import { pickSuggestion } from './pickSuggestion';
import type { Category } from './fallback';

export const triageRoutes = new Hono<AppEnv>();

triageRoutes.post('/tickets/suggest', async (c) => {
  const body = await readJson<Record<string, unknown>>(c);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Request body must be a JSON object');
  }

  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const errors: Record<string, string> = {};
  if (subject.length < 5 || subject.length > 150) errors.subject = 'Subject must be 5–150 characters';
  if (description.length < 10 || description.length > 5000) errors.description = 'Description must be 10–5,000 characters';
  if (body.urgency !== undefined && !PRIORITIES.includes(body.urgency as Priority)) {
    errors.urgency = 'Invalid urgency';
  }
  if (Object.keys(errors).length) {
    throw new ApiError(422, 'ValidationError', 'Some fields are missing or invalid', { fields: errors });
  }

  const { results } = await c.env.DB.prepare(
    'SELECT id, name FROM ticket_categories WHERE is_active = 1 ORDER BY id',
  ).all<Category>();
  const categories = results ?? [];
  if (categories.length === 0) throw new ApiError(503, 'NoCategories', 'No active categories yet');

  const input = {
    subject,
    description,
    urgency: body.urgency as Priority | undefined,
    categories,
  };
  const suggestion = pickSuggestion(await askAi(c.env, input), input);
  return c.json({ data: suggestion });
});
