/**
 * Deterministic triage rules (PRD §8.5, BR-06) + output validation (§8.6).
 * Owner: P4 (AI Triage & Admin)
 */
import { PRIORITIES, type Priority } from '../modules/tickets/rules';
import { routeWellbeing } from '../modules/wellbeing/routing';

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
 * Keyword + urgency rules (match whole words, case-insensitive):
 *   Facility  : air conditioner, aircon, light, door, leak, toilet, projector, room, building → route 'maintenance'
 *   Network   : wifi, wi-fi, internet, vpn, network, lan                                     → route 'it_support'
 *   Account   : password, login, mfa, account, locked                                         → route 'it_support'
 *   Hardware  : printer, laptop, computer, keyboard, mouse, monitor                           → route 'it_support'
 *   Software  : install, license, error, crash, app, software                                 → route 'it_support'
 *   Wellbeing : checked LAST, with the same words as the Wellbeing card (modules/wellbeing/routing.ts, Thai too):
 *               exam, thesis, stress, worried, lonely, เครียด, สอบ, … → route 'wellbeing'
 *               Last, so "projector in the lecture hall" stays a Facility repair. Never illness or injury.
 *   none      : first category, route 'helpdesk'
 * Priority: urgency given → use it; else words like "urgent", "exam", "cannot", "broken" → 'high'; else 'medium'.
 * Example (PRD §8.3): "Air conditioner in classroom B-204 is not working" → Facility / high / maintenance
 */
export function suggestFallback(input: TriageInput): Suggestion {
  const text = `${input.subject} ${input.description}`;
  const groups: { category: string; route: Route; words: string[] }[] = [
    { category: 'Facility', route: 'maintenance', words: ['air conditioner', 'aircon', 'light', 'door', 'leak', 'toilet', 'projector', 'room', 'building'] },
    { category: 'Network', route: 'it_support', words: ['wifi', 'wi-fi', 'internet', 'vpn', 'network', 'lan'] },
    { category: 'Account', route: 'it_support', words: ['password', 'login', 'mfa', 'account', 'locked'] },
    { category: 'Hardware', route: 'it_support', words: ['printer', 'laptop', 'computer', 'keyboard', 'mouse', 'monitor'] },
    { category: 'Software', route: 'it_support', words: ['install', 'license', 'error', 'crash', 'app', 'software'] },
  ];
  const matches = (word: string) => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);
  const wellbeing = routeWellbeing(text);
  const matchedGroup =
    groups.find((group) => group.words.some(matches)) ??
    (wellbeing.danger || wellbeing.serviceId ? { category: 'Wellbeing', route: 'wellbeing' as Route, words: [] } : undefined);
  const category = matchedGroup
    ? input.categories.find((item) => item.name.toLowerCase() === matchedGroup.category.toLowerCase())
    : undefined;
  const selected = category ?? input.categories[0] ?? { id: 1, name: 'General' };
  const highPriorityWords = ['urgent', 'exam', 'cannot', 'broken', 'not working'];
  const priority = input.urgency && PRIORITIES.includes(input.urgency)
    ? input.urgency
    : highPriorityWords.some(matches)
      ? 'high'
      : 'medium';

  return {
    category_id: selected.id,
    category_name: selected.name,
    priority,
    route: matchedGroup?.route ?? 'helpdesk',
    source: 'fallback',
    reason: matchedGroup
      ? `Matched ${matchedGroup.category.toLowerCase()} keywords in the request.`
      : 'No specific category keywords matched; routed to the helpdesk.',
  };
}

/**
 * Accept AI output only when the model's category, priority and route are allowed.
 * The category name always comes from the database, never from model output.
 */
export function validateAiOutput(raw: unknown, categories: Category[]): Suggestion | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const category = categories.find((item) => item.id === value.category_id);
  if (!category || !PRIORITIES.includes(value.priority as Priority)) return null;
  if (typeof value.route !== 'string' || !ROUTES.includes(value.route as Route)) return null;
  if (typeof value.reason !== 'string' || !value.reason.trim()) return null;

  return {
    category_id: category.id,
    category_name: category.name,
    priority: value.priority as Priority,
    route: value.route as Route,
    source: 'ai',
    reason: value.reason.trim().slice(0, 500),
  };
}
