/**
 * Wellbeing (Team 16) integration — A5, already delivered. Moved here unchanged
 * except: keyword matching now uses whole words (fixes "will" matching "ill").
 * Owner: P3 (Integrations)
 *
 *   GET /wellbeing/services                     public catalogue proxy (Team 16 has no CORS)
 *   GET /tickets/:id/wellbeing-suggestion       keyword match, read-only
 */
import { Hono, type Context } from 'hono';
import type { AppEnv } from '../../core/env';
import { forbidden, notFound, parseId } from '../../core/http';
import { getTicket } from '../tickets/repo';
import { canViewTicket } from '../tickets/rules';

export const wellbeingRoutes = new Hono<AppEnv>();

type WellbeingService = { id: string; slug: string; name: string; whatFor: string; firstSession: string; whoWillKnow: string };

const CACHE_TTL_SECONDS = 600;
const TIMEOUT_MS = 3000; // Team 16 contract §9

async function getCatalogue(c: Context<AppEnv>) {
  const cache = caches.default;
  const cacheKey = new Request('https://internal-cache.local/wellbeing-services');
  const cached = await cache.match(cacheKey);
  if (cached) return { services: (await cached.json<{ services: WellbeingService[] }>()).services, degraded: false };

  const correlationId = `team14-a5-${crypto.randomUUID()}`;
  const fetchOnce = async () => {
    const res = await fetch(`${c.env.WELLBEING_API_URL}/services`, {
      headers: { 'X-Correlation-Id': correlationId },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    return res;
  };

  let upstream: Response;
  try {
    upstream = await fetchOnce();
  } catch {
    try {
      await new Promise((r) => setTimeout(r, 300)); // one retry — GET is safe to retry
      upstream = await fetchOnce();
    } catch {
      return { services: [] as WellbeingService[], degraded: true }; // never block Helpdesk
    }
  }
  const body = await upstream.json<{ services: WellbeingService[] }>();
  c.executionCtx.waitUntil(
    cache.put(cacheKey, new Response(JSON.stringify({ services: body.services }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}` },
    })),
  );
  return { services: body.services, degraded: false };
}

const KEYWORDS: Record<string, string[]> = {
  counselling: ['stress', 'stressed', 'anxious', 'anxiety', 'depressed', 'depression', 'overwhelmed', 'grief', 'lonely', 'mental health', 'counselling', 'counseling', 'sad', 'panic'],
  'health-clinic': ['sick', 'ill', 'flu', 'fever', 'medical certificate', 'vaccine', 'vaccination', 'injury', 'injured', 'hurt', 'unwell', 'nurse', 'clinic'],
  physiotherapy: ['back pain', 'neck pain', 'sports injury', 'sprain', 'physio', 'physiotherapy', 'muscle', 'posture'],
  'wellbeing-advising': ['financial hardship', 'sleep', 'homesick', 'settling in', 'work-life', 'study-life'],
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whole-word, case-insensitive match. Exported for tests. */
export function matchWellbeingSlug(text: string): string | null {
  for (const [slug, words] of Object.entries(KEYWORDS)) {
    if (words.some((w) => new RegExp(`\\b${escapeRe(w)}\\b`, 'i').test(text))) return slug;
  }
  return null;
}

wellbeingRoutes.get('/wellbeing/services', async (c) => c.json(await getCatalogue(c)));

wellbeingRoutes.get('/tickets/:id/wellbeing-suggestion', async (c) => {
  const id = parseId(c.req.param('id'));
  const ticket = await getTicket(c.env.DB, id);
  if (!ticket) throw notFound('ไม่พบ ticket');
  if (!canViewTicket(c.get('user'), ticket)) throw forbidden('ดูได้เฉพาะ ticket ของตัวเอง');

  const { services, degraded } = await getCatalogue(c);
  const slug = degraded ? null : matchWellbeingSlug(`${ticket.title} ${ticket.description}`);
  return c.json({ ticket_id: id, suggested_service: services.find((s) => s.slug === slug) ?? null, degraded });
});
