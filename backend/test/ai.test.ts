/**
 * PRD §18 recommended: AI suggestion validation, AI fallback, invalid AI output
 * Owner: P4 — remove .skip when suggestFallback / validateAiOutput are implemented.
 */
import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { suggestFallback, validateAiOutput } from '../src/ai/fallback';
import { pickSuggestion } from '../src/ai/record';
import { askAi } from '../src/ai/ai';
import { triageRoutes } from '../src/ai/routes';
import type { AppEnv } from '../src/core/env';
import { handleError } from '../src/core/http';

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

describe('fallback: Wellbeing category (Team 16 contract 2.0)', () => {
  const withWellbeing = [...categories, { id: 6, name: 'Wellbeing' }];
  it('routes stress to the Wellbeing category', () => {
    const s = suggestFallback({ subject: 'Feeling stressed and lonely', description: 'I feel overwhelmed this month', categories: withWellbeing });
    expect(s).toMatchObject({ category_id: 6, route: 'wellbeing' });
  });
  it('uses the same words as the Wellbeing card, Thai included', () => {
    expect(suggestFallback({ subject: 'Need help', description: "I'm worried about my thesis", categories: withWellbeing })).toMatchObject({ category_id: 6, route: 'wellbeing' });
    expect(suggestFallback({ subject: 'เครียดเรื่องสอบ', description: 'นอนไม่หลับมาหลายคืน', categories: withWellbeing }).route).toBe('wellbeing');
  });
  it('repairs and IT win over Wellbeing words', () => {
    expect(suggestFallback({ subject: 'Projector in lecture hall not working', description: 'It turns off during my class', categories: withWellbeing }).route).toBe('maintenance');
  });
  it('never routes illness or injury to Wellbeing', () => {
    const s = suggestFallback({ subject: 'I feel ill', description: 'I need a medical certificate for my injury', categories: withWellbeing });
    expect(s.route).not.toBe('wellbeing');
  });
});

describe('AI triage + fallback (PRD §8)', () => {
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
    expect(validateAiOutput({ category_id: 1, priority: 'low', route: 'other', reason: 'test' }, categories)).toBeNull();
    expect(validateAiOutput('not json', categories)).toBeNull();
  });

  it('does not match keywords inside other words and honors explicit urgency', () => {
    expect(suggestFallback({ subject: 'The printer will not print', description: 'Please check it', categories }))
      .toMatchObject({ category_name: 'Hardware', route: 'it_support', priority: 'medium' });
    expect(suggestFallback({ subject: 'Broken air conditioner', description: 'Room is hot', urgency: 'low', categories }))
      .toMatchObject({ category_name: 'Facility', route: 'maintenance', priority: 'low' });
  });
});

describe('suggestion kept for the admin (F31)', () => {
  it('junk AI output still gives a fallback suggestion', () => {
    expect(pickSuggestion('not json', { subject: 'x', description: 'y', categories }).source).toBe('fallback');
  });
});

describe('suggestion kept for the admin (F31)', () => {
  it('uses valid AI output when there is one', () => {
    const s = pickSuggestion({ category_id: 5, priority: 'high', route: 'maintenance', reason: 'aircon' }, { subject: 'x', description: 'y', categories });
    expect(s).toMatchObject({ category_id: 5, route: 'maintenance', source: 'ai' });
  });
});

describe('Workers AI adapter', () => {
  it('returns null when the AI binding is unavailable', async () => {
    expect(await askAi({} as never, { subject: 'test issue', description: 'a long enough description', categories }))
      .toBeNull();
  });

  it('extracts JSON from the model response and sends no identity data', async () => {
    let sentMessages: unknown;
    const env = {
      AI: {
        run: async (_model: string, options: { messages: unknown }) => {
          sentMessages = options.messages;
          return { response: '```json\n{"category_id":1,"priority":"low","route":"it_support","reason":"Wi-Fi issue"}\n```' };
        },
      },
    } as never;
    const result = await askAi(env, { subject: 'Wi-Fi issue', description: 'Cannot connect', categories });
    expect(result).toMatchObject({ category_id: 1, route: 'it_support' });
    expect(JSON.stringify(sentMessages)).not.toMatch(/email|requester name/i);
  });
});

describe('Workers AI adapter: current model', () => {
  it('uses a model that is not retired', async () => {
    let model = '';
    const env = { AI: { run: async (m: string) => { model = m; return { response: '{}' }; } } } as never;
    await askAi(env, { subject: 'Wi-Fi issue', description: 'Cannot connect', categories });
    expect(model).not.toBe('@cf/meta/llama-3.1-8b-instruct'); // retired 2026-05-30
  });

  it('reads a response that is already a JSON object', async () => {
    const env = {
      AI: { run: async () => ({ response: { category_id: 5, priority: 'high', route: 'maintenance', reason: 'aircon' }, choices: [] }) },
    } as never;
    expect(await askAi(env, { subject: 'Aircon broken', description: 'Room B-204 is hot', categories })).toMatchObject({ category_id: 5 });
  });

  it('reads the OpenAI-style choices shape', async () => {
    const env = {
      AI: { run: async () => ({ choices: [{ message: { content: '{"category_id":1,"priority":"low","route":"it_support","reason":"wifi"}' } }] }) },
    } as never;
    expect(await askAi(env, { subject: 'Wifi down', description: 'Cannot connect at all', categories })).toMatchObject({ category_id: 1 });
  });
});

describe('POST /tickets/suggest API contract', () => {
  const app = new Hono<AppEnv>();
  app.route('/', triageRoutes);
  app.onError(handleError);
  const env = {
    DB: {
      prepare: () => ({ all: async () => ({ results: categories }) }),
    },
  } as never;

  it('returns the fallback suggestion using the shared API response shape', async () => {
    const response = await app.request('/tickets/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: 'Air conditioner broken', description: 'Room is too hot now' }),
    }, env);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      data: { category_name: 'Facility', route: 'maintenance', priority: 'high', source: 'fallback' },
    });
  });

  it('validates short or missing content', async () => {
    const response = await app.request('/tickets/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: 'x', description: '' }),
    }, env);
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: 'ValidationError', fields: { subject: expect.any(String) } });
  });
});
