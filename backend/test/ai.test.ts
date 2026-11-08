/**
 * PRD §18 recommended: AI suggestion validation, AI fallback, invalid AI output
 * Owner: P4 — remove .skip when suggestFallback / validateAiOutput are implemented.
 */
import { describe, expect, it } from 'vitest';
import { suggestFallback, validateAiOutput } from '../src/ai/fallback';
import { pickSuggestion } from '../src/ai/record';
import { matchWellbeingSlug } from '../src/modules/wellbeing/routes';

const categories = [
  { id: 1, name: 'Network' },
  { id: 2, name: 'Hardware' },
  { id: 3, name: 'Software' },
  { id: 4, name: 'Account' },
  { id: 5, name: 'Facility' },
];

describe('fallback always answers', () => {
  it('returns a valid category even before rules exist', () => {
    const s = suggestFallback({ subject: 'x', description: 'y', categories });
    expect(categories.map((c) => c.id)).toContain(s.category_id);
    expect(s.source).toBe('fallback');
  });
});

describe('wellbeing keyword match (A5 bug fix)', () => {
  it('matches whole words only — "will" is not "ill"', () => {
    expect(matchWellbeingSlug('The printer will not print')).toBeNull();
    expect(matchWellbeingSlug('I feel ill and need a medical certificate')).toBe('health-clinic');
  });
});

describe.skip('AI triage + fallback (PRD §8) — TODO P4', () => {
  it('routes the PRD example to Facility / high / maintenance', () => {
    const s = suggestFallback({ subject: 'Air conditioner in classroom B-204 is not working', description: 'Room is very hot', categories });
    expect(s).toMatchObject({ category_name: 'Facility', priority: 'high', route: 'maintenance' });
  });
  it('accepts valid AI output', () => {
    expect(validateAiOutput({ category_id: 1, priority: 'low', route: 'it_support', reason: 'wifi' }, categories)?.source).toBe('ai');
  });
  it('rejects AI output outside the allowed values', () => {
    expect(validateAiOutput({ category_id: 99, priority: 'low', route: 'it_support' }, categories)).toBeNull();
    expect(validateAiOutput({ category_id: 1, priority: 'critical', route: 'it_support' }, categories)).toBeNull();
    expect(validateAiOutput('not json', categories)).toBeNull();
  });
});

describe('suggestion kept for the agent (F31)', () => {
  it('junk AI output still gives a fallback suggestion', () => {
    expect(pickSuggestion('not json', { subject: 'x', description: 'y', categories }).source).toBe('fallback');
  });
});

describe.skip('suggestion kept for the agent (F31) — TODO P4', () => {
  it('uses valid AI output when there is one', () => {
    const s = pickSuggestion({ category_id: 5, priority: 'high', route: 'maintenance', reason: 'aircon' }, { subject: 'x', description: 'y', categories });
    expect(s).toMatchObject({ category_id: 5, route: 'maintenance', source: 'ai' });
  });
});
