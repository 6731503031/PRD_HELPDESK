/**
 * AI-assisted triage (PRD §8). Advisory only — never writes ticket state (BR-05).
 * Owner: P4 (AI Triage & Admin)
 *
 * Uses Cloudflare Workers AI (binding `AI` in wrangler.toml) — no API key needed.
 * Prompt must NOT include the requester's name/email (data minimisation).
 */
import type { Bindings } from '../core/env';
import type { TriageInput } from './fallback';

export const AI_MODEL = '@cf/meta/llama-3.1-8b-instruct';
export const AI_TIMEOUT_MS = 4000;

/**
 * TODO(P4, F19):
 *  1. env.AI missing → return null
 *  2. prompt: list the allowed category ids/names, priorities, routes; ask for JSON only:
 *       {"category_id": <id>, "priority": "...", "route": "...", "reason": "..."}
 *  3. await Promise.race([env.AI.run(AI_MODEL, { messages }), timeout(AI_TIMEOUT_MS)])
 *  4. extract the JSON object from the text → return the parsed object (unvalidated)
 *  5. any error → return null
 */
export async function askAi(env: Bindings, input: TriageInput): Promise<unknown | null> {
  void env;
  void input;
  return null; // TODO(P4, F19)
}
