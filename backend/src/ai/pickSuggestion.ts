/**
 * Suggestion logic for AI output (PRD §8).
 * Owner: P4 (AI Triage & Admin)
 */
import type { TriageInput, Suggestion } from './fallback';
import { suggestFallback, validateAiOutput } from './fallback';

/**
 * Shared by POST /tickets/suggest and recordSuggestion: accept valid AI output,
 * otherwise use deterministic triage.
 */
export function pickSuggestion(raw: unknown, input: TriageInput): Suggestion {
  return validateAiOutput(raw, input.categories) ?? suggestFallback(input);
}
