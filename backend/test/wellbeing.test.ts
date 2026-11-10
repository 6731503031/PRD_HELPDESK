/**
 * Wellbeing (Team 16) contract 2.0 — AI-MIGRATION-BRIEF §10 tests 1, 4, 7, 8 (mocked fetch) + routing (§7, §8).
 * Owner: P3. Tests 2–3 (405 / 401 at Team 16) are live checks, see scripts/smoke.sh notes in the PR.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearWellbeingCache,
  findService,
  listWellbeingServices,
  parseServices,
  wellbeingCorrelationId,
} from '../src/modules/wellbeing/client';
import { isWellbeingTicket, routeWellbeing } from '../src/modules/wellbeing/routing';

const BASE = 'https://wellbeing.example/api/v1';
const LIVE_SHAPE = [
  { id: 'srv_academic_stress', name: 'Academic Stress Counselling', description: 'Exams and study.', duration_minutes: 45, is_active: true },
  { id: 'srv_general_counselling', name: 'General Counselling', description: 'Anything weighing on you.', duration_minutes: 45, is_active: true },
  { id: 'srv_urgent_drop_in', name: 'Urgent Drop-in', description: '', duration_minutes: 30, is_active: true, new_field: 'ignored' },
];
const ok = () => new Response(JSON.stringify(LIVE_SHAPE), { headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  clearWellbeingCache();
  vi.unstubAllGlobals();
});

describe('Wellbeing client (contract 2.0)', () => {
  it('1. reads the plain-array shape, ignores unknown fields, resolves by id', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok()));
    const list = await listWellbeingServices(BASE);
    expect(list).toMatchObject({ available: true, stale: false });
    expect(list.services.map((s) => s.id)).toEqual(['srv_academic_stress', 'srv_general_counselling', 'srv_urgent_drop_in']);
    expect(list.services[0]).toEqual({ id: 'srv_academic_stress', name: 'Academic Stress Counselling', description: 'Exams and study.', durationMinutes: 45 });
    expect(findService(list, 'srv_general_counselling')?.name).toBe('General Counselling');
  });

  it('rejects the old 1.2 shape { services: [...] }', () => {
    expect(() => parseServices({ services: LIVE_SHAPE })).toThrow('wellbeing_bad_shape');
  });

  it('a missing description becomes an empty string', () => {
    expect(parseServices([{ id: 'srv_x', name: 'X' }])[0]).toMatchObject({ description: '', durationMinutes: 0 });
  });

  it('4. an unknown id is "not found" (null), not an error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok()));
    const list = await listWellbeingServices(BASE);
    expect(findService(list, 'srv_dentistry')).toBeNull();
    expect(findService(list, null)).toBeNull();
  });

  it('7. never throws when Wellbeing is down: suggestion hidden', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    await expect(listWellbeingServices(BASE)).resolves.toMatchObject({ available: false, services: [] });
  });

  it('7. a 500 from Wellbeing is handled the same way', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"internal_error"}', { status: 500 })));
    await expect(listWellbeingServices(BASE)).resolves.toMatchObject({ available: false, error: 'wellbeing_http_500' });
  });

  it('8. recovers on the next call with no manual repair', async () => {
    const fetchMock = vi.fn(async (): Promise<Response> => { throw new TypeError('fetch failed'); });
    vi.stubGlobal('fetch', fetchMock);
    expect((await listWellbeingServices(BASE)).available).toBe(false);
    fetchMock.mockImplementation(async () => ok());
    expect((await listWellbeingServices(BASE)).available).toBe(true);
  });

  it('serves the cached list (stale) during an outage after the cache expires', async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn(async () => ok());
      vi.stubGlobal('fetch', fetchMock);
      await listWellbeingServices(BASE);
      vi.advanceTimersByTime(11 * 60 * 1000);
      fetchMock.mockImplementation(async () => { throw new TypeError('fetch failed'); });
      expect(await listWellbeingServices(BASE)).toMatchObject({ available: true, stale: true });
    } finally {
      vi.useRealTimers();
    }
  });

  it('calls GET /services with a 3 s timeout and a valid correlation id', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ok());
    vi.stubGlobal('fetch', fetchMock);
    await listWellbeingServices(`${BASE}/`, 'team14-v2-0001');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/services`);
    expect((init.headers as Record<string, string>)['X-Correlation-Id']).toBe('team14-v2-0001');
    expect(init.signal).toBeDefined();
    expect(init.method ?? 'GET').toBe('GET');
    expect(init.body).toBeUndefined(); // nothing about the ticket is ever sent
  });

  it('generated correlation ids fit Team 16 rules', () => {
    expect(wellbeingCorrelationId()).toMatch(/^[A-Za-z0-9_.:-]{8,128}$/);
  });
});

describe('which service to suggest (brief §7, §8)', () => {
  it('danger comes first: emergency numbers, no appointment', () => {
    expect(routeWellbeing('Exam stress, I want to die')).toEqual({ danger: true, serviceId: null });
    expect(routeWellbeing('ไม่ไหวแล้ว อยากตาย')).toEqual({ danger: true, serviceId: null });
  });
  it('study words → Academic Stress Counselling', () => {
    expect(routeWellbeing('So stressed about my thesis deadline').serviceId).toBe('srv_academic_stress');
    expect(routeWellbeing('เครียดเรื่องสอบมาก').serviceId).toBe('srv_academic_stress');
  });
  it('"soon" words → Urgent Drop-in', () => {
    expect(routeWellbeing("I need to talk to someone today, I can’t wait").serviceId).toBe('srv_urgent_drop_in');
  });
  it('general words → General Counselling', () => {
    expect(routeWellbeing('Feeling lonely and homesick').serviceId).toBe('srv_general_counselling');
    expect(routeWellbeing('นอนไม่หลับ กังวลเรื่องครอบครัว').serviceId).toBe('srv_general_counselling');
  });
  it('illness, injury and unrelated tickets get nothing', () => {
    expect(routeWellbeing('I feel ill and need a medical certificate')).toEqual({ danger: false, serviceId: null });
    expect(routeWellbeing('Sprained my ankle, need physiotherapy')).toEqual({ danger: false, serviceId: null });
    expect(routeWellbeing('The printer will not print')).toEqual({ danger: false, serviceId: null });
  });
  it('matches whole English words only', () => {
    expect(routeWellbeing('The latest firmware').serviceId).toBeNull(); // "test" inside "latest"
  });
});

describe('only Wellbeing tickets get a service suggestion', () => {
  it('a repair in a lecture hall is not exam stress', () => {
    expect(routeWellbeing('Projector in lecture hall not working for my class').serviceId).toBe('srv_academic_stress');
    expect(isWellbeingTicket({ category_name: 'Facility', ai_route: 'maintenance', wellbeing_service_id: null })).toBe(false);
  });
  it('the Wellbeing category, an AI route of wellbeing, or an admin choice count', () => {
    expect(isWellbeingTicket({ category_name: 'Wellbeing' })).toBe(true);
    expect(isWellbeingTicket({ category_name: 'Software', ai_route: 'wellbeing' })).toBe(true);
    expect(isWellbeingTicket({ category_name: 'Account', wellbeing_service_id: 'srv_general_counselling' })).toBe(true);
  });
});
