/**
 * Deterministic triage rules (PRD §8.5, BR-06) + output validation (§8.6).
 * Owner: P4 (AI Triage & Admin)
 */
import { PRIORITIES, type Priority } from '../modules/tickets/rules';

export const ROUTES = ['helpdesk', 'maintenance', 'it_support', 'wellbeing'] as const;
export type Route = (typeof ROUTES)[number];

export type Category = { id: number; name: string };

export type TriageInput = {
  subject: string;
  description: string;
  urgency?: Priority;
  categories: Category[];
};

export type Suggestion = {
  category_id: number;
  category_name: string;
  priority: Priority;
  route: Route;
  source: 'ai' | 'fallback';
  reason: string;
};

/**
 * TODO(P4, F21): keyword + urgency rules. Must ALWAYS return a valid Suggestion.
 * Suggested rules (match whole words, case-insensitive — use /\bword\b/i, not includes()):
 *   Facility  : air conditioner, aircon, light, door, leak, toilet, projector, room, building → route 'maintenance'
 *   Network   : wifi, wi-fi, internet, vpn, network, lan                                     → route 'it_support'
 *   Account   : password, login, mfa, account, locked                                         → route 'it_support'
 *   Hardware  : printer, laptop, computer, keyboard, mouse, monitor                           → route 'it_support'
 *   Software  : install, license, error, crash, app, software                                 → route 'it_support'
 *   none      : first category, route 'helpdesk'
 * Priority: urgency given → use it; else words like "urgent", "exam", "cannot", "broken" → 'high'; else 'medium'.
 * Example (PRD §8.3): "Air conditioner in classroom B-204 is not working" → Facility / high / maintenance
 */
export function suggestFallback(input: TriageInput): Suggestion {
  const first = input.categories[0] ?? { id: 1, name: 'General' };
  return {
    category_id: first.id,
    category_name: first.name,
    priority: input.urgency ?? 'medium',
    route: 'helpdesk',
    source: 'fallback',
    reason: 'TODO(P4, F21): rules not implemented yet',
  };
}

/**
 * TODO(P4, F20): accept the AI's raw output only if every value is allowed.
 *   category_id ∈ input.categories, priority ∈ PRIORITIES, route ∈ ROUTES  → Suggestion (source 'ai')
 *   anything else → null  (caller falls back)
 */
export function validateAiOutput(raw: unknown, categories: Category[]): Suggestion | null {
  void raw;
  void categories;
  void PRIORITIES;
  return null; // TODO(P4, F20)
}
