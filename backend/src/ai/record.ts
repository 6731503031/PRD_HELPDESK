/**
 * Keep the triage suggestion on the ticket so the AGENT sees it too (PRD §8.1 "user or Agent", FR-10).
 * Owner: P4 (AI Triage & Admin) — feature F31
 *
 * Flow: POST /tickets creates the ticket → responds 201 → THEN (waitUntil) recordSuggestion runs.
 * So the AI never slows down or breaks ticket creation (PRD §15 failure isolation).
 * The agent's queue/detail shows "AI suggested: <route>" and flags when the requester chose differently.
 * The suggestion is advisory only — it never changes category/priority/status (BR-05).
 */
import type { Bindings } from '../core/env';
import type { Ticket } from '../modules/tickets/rules';
import { askAi } from './ai';
import { suggestFallback, validateAiOutput, type Suggestion, type TriageInput } from './fallback';

/**
 * TODO(P4, F31): the one rule shared by POST /tickets/suggest and recordSuggestion:
 *   valid AI output → use it ; otherwise → suggestFallback(input)
 *   i.e.  return validateAiOutput(raw, input.categories) ?? suggestFallback(input);
 */
export function pickSuggestion(raw: unknown, input: TriageInput): Suggestion {
  void raw;
  void validateAiOutput;
  return suggestFallback(input); // TODO(P4, F31): try the AI output first
}

/**
 * TODO(P4, F31):
 *  1. categories = SELECT id, name FROM ticket_categories WHERE is_active = 1
 *  2. input = { subject: ticket.title, description: ticket.description, urgency: ticket.priority, categories }
 *     (NO requester name / email in the prompt — data minimisation)
 *  3. s = pickSuggestion(await askAi(env, input), input)
 *  4. UPDATE tickets SET ai_category_id = ?, ai_priority = ?, ai_route = ?, ai_source = ? WHERE id = ?
 *     (do NOT touch updated_at — this is not a user change)
 *  5. wrap 1–4 in try/catch → console.log({ msg: 'ai suggestion failed', ticket: ticket.id }) — never throw
 */
export async function recordSuggestion(env: Bindings, ticket: Ticket): Promise<void> {
  void env;
  void ticket;
  void askAi;
  // TODO(P4, F31) — until then the agent sees "ยังไม่มีคำแนะนำจากระบบ"
}
