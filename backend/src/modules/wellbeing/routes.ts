/**
 * Wellbeing (Team 16) integration — contract 2.0 (AI-MIGRATION-BRIEF, 2026-11-09).
 * Owner: P3 (Integrations)
 *
 *   GET /wellbeing/services                public catalogue proxy (Team 16 has no CORS)
 *   GET /tickets/:id/wellbeing-suggestion  which service to suggest for this ticket, read-only
 *
 * Helpdesk only reads the public catalogue: no ticket text, no personal data goes to Team 16, nothing comes back.
 * A stored wellbeing_service_id means "we suggested this", never "this student is a Wellbeing client".
 */
import { Hono, type Context } from 'hono';
import type { AppEnv } from '../../core/env';
import { forbidden, notFound, parseId } from '../../core/http';
import { getTicket } from '../tickets/repo';
import { canViewTicket } from '../tickets/rules';
import { findService, listWellbeingServices, wellbeingCorrelationId, type WellbeingService } from './client';
import { EMERGENCY_NUMBERS, WELLBEING_EMERGENCY_URL, WELLBEING_SITE_URL, isWellbeingTicket, routeWellbeing } from './routing';

export const wellbeingRoutes = new Hono<AppEnv>();

/** Our request id, in the character set Team 16 accepts (8–128 of A–Z a–z 0–9 _ . : -). */
function correlationFor(c: Context<AppEnv>): string {
  const ours = String(c.get('correlationId') ?? '').replace(/[^A-Za-z0-9_.:-]/g, '-');
  if (!ours) return wellbeingCorrelationId();
  return (ours.startsWith('team14-') ? ours : `team14-${ours}`).slice(0, 128);
}

/** Same field names as the rest of our API (snake_case). */
const toJson = (s: WellbeingService) => ({ id: s.id, name: s.name, description: s.description, duration_minutes: s.durationMinutes });

wellbeingRoutes.get('/wellbeing/services', async (c) => {
  const list = await listWellbeingServices(c.env.WELLBEING_API_URL, correlationFor(c));
  return c.json({ available: list.available, stale: list.stale, services: list.services.map(toJson) });
});

/** Always sent, so the UI can show the emergency numbers and the booking link even when Team 16 is down. */
const base = (ticketId: number) => ({
  ticket_id: ticketId,
  emergency_numbers: EMERGENCY_NUMBERS,
  emergency_url: WELLBEING_EMERGENCY_URL,
  booking_url: WELLBEING_SITE_URL,
});

wellbeingRoutes.get('/tickets/:id/wellbeing-suggestion', async (c) => {
  const id = parseId(c.req.param('id'));
  const ticket = await getTicket(c.env.DB, id);
  if (!ticket) throw notFound('Ticket not found');
  if (!canViewTicket(c.get('user'), ticket)) throw forbidden('You can only view your own tickets');

  // Brief §8 rule 1: danger first, on EVERY ticket — emergency numbers, and no appointment is suggested.
  const route = routeWellbeing(`${ticket.title}\n${ticket.description}`);
  // A service is suggested only on a Wellbeing ticket (a projector "in the lecture hall" is a repair, not exam stress).
  const wellbeingTicket = isWellbeingTicket(ticket);
  if (!route.danger && !wellbeingTicket) {
    return c.json({ ...base(id), available: true, danger: false, wellbeing_ticket: false, suggested_service: null });
  }
  const list = await listWellbeingServices(c.env.WELLBEING_API_URL, correlationFor(c));
  // A service the admin chose wins over the keyword guess; either must still be in the live list (else hidden).
  const chosen = route.danger ? null : findService(list, ticket.wellbeing_service_id) ?? findService(list, route.serviceId);

  return c.json({
    ...base(id),
    available: list.available,
    danger: route.danger,
    wellbeing_ticket: wellbeingTicket,
    suggested_service: chosen ? toJson(chosen) : null,
  });
});

