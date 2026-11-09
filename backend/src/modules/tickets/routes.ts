/**
 * Ticket endpoints (PRD §9.1).
 * Owner: P1 (Core & Tickets)
 *
 *   POST   /tickets               FR-03 create
 *   GET    /tickets/me            FR-05 my tickets
 *   GET    /tickets               FR-08 admin dashboard list (customer → own only)
 *   GET    /tickets/:id           FR-06 detail + status history
 *   PATCH  /tickets/:id           FR-10 triage / requester edit (field whitelist)
 *   PUT    /tickets/:id           legacy alias of PATCH (Assignment 2)
 *   DELETE /tickets/:id           Assignment 2 (admin / owner before resolve)
 *   POST   /tickets/:id/resolve   FR-13
 */
import { Hono, type Context } from 'hono';
import type { AppEnv } from '../../core/env';
import { findIdentity } from '../../core/profiles';
import { ApiError, badRequest, conflict, forbidden, notFound, parseId, readJson } from '../../core/http';
import { recordSuggestion } from '../../ai/record';
import { publishEvent } from '../events/publish';
import { MESSAGES, postSystemMessage } from '../comments/templates';
import {
  PRIORITIES,
  STATUSES,
  WELLBEING_SLUGS,
  canResolve,
  canTransition,
  checkLocation,
  canViewTicket,
  editableFields,
  isStaff,
  validateCreate,
  type TicketStatus,
} from './rules';
import {
  categoryIsActive,
  getHistory,
  getTicket,
  insertTicket,
  listTickets,
  recordStatus,
  updateTicket,
  attachNames,
} from './repo';

export const ticketRoutes = new Hono<AppEnv>();

/** One ticket with the requester's display name (guest or directory). */
const named = async (c: Context<AppEnv>, t: Parameters<typeof attachNames>[1][number]) => (await attachNames(c.env.DB, [t]))[0];

async function loadVisible(c: Context<AppEnv>, id: number) {
  const ticket = await getTicket(c.env.DB, id);
  if (!ticket) throw notFound('Ticket not found');
  if (!canViewTicket(c.get('user'), ticket)) throw forbidden('You can only view your own tickets');
  return ticket;
}

// ---------- FR-03 Create ----------
ticketRoutes.post('/tickets', async (c) => {
  const user = c.get('user');
  const parsed = validateCreate(await readJson(c));
  if (!parsed.ok) throw new ApiError(422, 'ValidationError', 'Some fields are missing or invalid', { fields: parsed.errors });

  const input = parsed.value;
  const customerId = input.customer_id ?? user.id;
  if (!isStaff(user.role) && customerId !== user.id) throw forbidden('You can only create tickets for yourself');
  if (!(await findIdentity(c.env.DB, customerId))) throw badRequest('customer_id not found in Identity');
  if (!(await categoryIsActive(c.env.DB, input.category_id))) throw badRequest('This category does not exist or is disabled');

  const id = await insertTicket(c.env.DB, { ...input, customer_id: customerId });
  await recordStatus(c.env.DB, id, null, 'open', user.id, 'helpdesk', 'Ticket created');
  const ticket = (await getTicket(c.env.DB, id))!;
  await publishEvent(c.env, 'ticket.created', ticket); // FR-04
  // PRD §8.1: keep the triage suggestion for the admin — runs after the response, never blocks creation (F31, P4)
  c.executionCtx.waitUntil(recordSuggestion(c.env, ticket));
  return c.json({ message: 'Ticket created', data: await named(c, ticket) }, 201);
});

// ---------- FR-05 My tickets ----------
ticketRoutes.get('/tickets/me', async (c) => {
  const rows = await listTickets(c.env.DB, { customerId: c.get('user').id });
  return c.json({ count: rows.length, data: await attachNames(c.env.DB, rows) });
});

// ---------- FR-08 Queue / list ----------
ticketRoutes.get('/tickets', async (c) => {
  const user = c.get('user');
  const q = c.req.query();
  const status = STATUSES.includes(q.status as TicketStatus) ? q.status : undefined;
  const priority = PRIORITIES.includes(q.priority as never) ? q.priority : undefined;
  const rows = await listTickets(c.env.DB, {
    customerId: isStaff(user.role) ? (q.customer_id ? Number(q.customer_id) : undefined) : user.id,
    status,
    priority,
    sort: q.sort === 'queue' ? 'queue' : 'recent',
  });
  return c.json({ count: rows.length, data: await attachNames(c.env.DB, rows) });
});

// ---------- FR-06 Detail ----------
ticketRoutes.get('/tickets/:id', async (c) => {
  const ticket = await loadVisible(c, parseId(c.req.param('id')));
  const history = await getHistory(c.env.DB, ticket.id);
  return c.json({ data: { ...(await named(c, ticket)), history } });
});

// ---------- FR-10 Triage / edit ----------
async function patchTicket(c: Context<AppEnv>) {
  const user = c.get('user');
  const ticket = await loadVisible(c, parseId(c.req.param('id')));
  if (!isStaff(user.role) && ticket.status !== 'open') {
    throw conflict('You can only edit a ticket before work has started');
  }

  const body = await readJson<Record<string, unknown>>(c);
  const allowed = editableFields(user.role);
  const fields: Record<string, unknown> = {};
  for (const key of allowed) if (body[key] !== undefined) fields[key] = body[key];

  if (!Object.keys(fields).length) throw badRequest('No editable fields', { allowed_fields: allowed });

  // Validate every field that reaches SQL
  if ('title' in fields && String(fields.title).trim().length < 5) throw badRequest('Subject is too short');
  if ('location' in fields) {
    fields.location = String(fields.location ?? '').trim();
    const problem = checkLocation(fields.location as string);
    if (problem) throw badRequest(problem);
  }
  if ('priority' in fields && !PRIORITIES.includes(fields.priority as never)) throw badRequest('Invalid priority');
  if ('category_id' in fields && !(await categoryIsActive(c.env.DB, Number(fields.category_id)))) {
    throw badRequest('category_id does not exist or is disabled');
  }
  if ('wellbeing_service_slug' in fields && fields.wellbeing_service_slug !== null &&
      !WELLBEING_SLUGS.includes(fields.wellbeing_service_slug as never)) {
    throw badRequest('wellbeing_service_slug is not in the catalogue');
  }

  let newStatus: TicketStatus | null = null;
  if ('status' in fields) {
    const to = fields.status as TicketStatus;
    if (!STATUSES.includes(to)) throw badRequest('Invalid status');
    if (!canTransition(ticket.status, to)) throw conflict(`Cannot change status from ${ticket.status} to ${to}`);
    if (to !== ticket.status) newStatus = to;
    if (to === 'resolved') fields.resolved_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
  }

  await updateTicket(c.env.DB, ticket.id, fields);
  if (newStatus) await recordStatus(c.env.DB, ticket.id, ticket.status, newStatus, user.id);
  // Tell the requester in the chat (templates.ts)
  if (newStatus === 'in_progress' && ticket.status === 'open') await postSystemMessage(c.env.DB, ticket.id, MESSAGES.started);
  if (newStatus === 'resolved') {
    const note = typeof fields.resolution_note === 'string' ? fields.resolution_note.trim() || null : null;
    await postSystemMessage(c.env.DB, ticket.id, MESSAGES.resolved(note));
  }

  const updated = (await getTicket(c.env.DB, ticket.id))!;
  if (newStatus === 'resolved') await publishEvent(c.env, 'ticket.resolved', updated);
  else if (newStatus) await publishEvent(c.env, 'ticket.status_changed', updated, { from: ticket.status });
  return c.json({ message: 'Ticket updated', data: await named(c, updated) });
}
ticketRoutes.patch('/tickets/:id', patchTicket);
ticketRoutes.put('/tickets/:id', patchTicket);

// ---------- Delete (Assignment 2) ----------
ticketRoutes.delete('/tickets/:id', async (c) => {
  const ticket = await loadVisible(c, parseId(c.req.param('id')));
  if (ticket.status === 'resolved' || ticket.status === 'closed') throw conflict('A resolved ticket cannot be deleted');
  await c.env.DB.prepare('DELETE FROM tickets WHERE id = ?').bind(ticket.id).run();
  return c.json({ message: 'Ticket deleted', id: ticket.id });
});

// ---------- FR-13 Resolve ----------
ticketRoutes.post('/tickets/:id/resolve', async (c) => {
  const user = c.get('user');
  const ticket = await loadVisible(c, parseId(c.req.param('id')));
  const check = canResolve(user, ticket);
  if (!check.ok) throw forbidden(check.reason!);

  const body = await readJson<{ resolution_note?: string }>(c).catch(() => ({}) as { resolution_note?: string });
  const note = body.resolution_note?.trim() || null;
  await c.env.DB
    .prepare(
      `UPDATE tickets SET status = 'resolved', resolved_at = datetime('now'), resolution_note = ?, updated_at = datetime('now') WHERE id = ?`,
    )
    .bind(note, ticket.id)
    .run();
  await recordStatus(c.env.DB, ticket.id, ticket.status, 'resolved', user.id, 'helpdesk', note);
  await postSystemMessage(c.env.DB, ticket.id, MESSAGES.resolved(note));

  const updated = (await getTicket(c.env.DB, ticket.id))!;
  await publishEvent(c.env, 'ticket.resolved', updated);
  return c.json({ message: 'Ticket resolved', data: await named(c, updated) });
});
