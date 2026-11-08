/**
 * Ticket endpoints (PRD §9.1).
 * Owner: P1 (Core & Tickets)
 *
 *   POST   /tickets               FR-03 create
 *   GET    /tickets/me            FR-05 my tickets
 *   GET    /tickets               FR-08 agent queue (customer → own only)
 *   GET    /tickets/:id           FR-06 detail + status history
 *   PATCH  /tickets/:id           FR-10 triage / requester edit (field whitelist)
 *   PUT    /tickets/:id           legacy alias of PATCH (Assignment 2)
 *   DELETE /tickets/:id           Assignment 2 (admin / owner before resolve)
 *   POST   /tickets/:id/assign    FR-09
 *   POST   /tickets/:id/resolve   FR-13
 */
import { Hono, type Context } from 'hono';
import type { AppEnv } from '../../core/env';
import { verify } from '../../core/identity';
import { ApiError, badRequest, conflict, forbidden, notFound, parseId, readJson } from '../../core/http';
import { recordSuggestion } from '../../ai/record';
import { publishEvent } from '../events/publish';
import {
  PRIORITIES,
  STATUSES,
  WELLBEING_SLUGS,
  canAssign,
  canBeAssignee,
  canResolve,
  canTransition,
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
  withNames,
} from './repo';

export const ticketRoutes = new Hono<AppEnv>();

async function loadVisible(c: Context<AppEnv>, id: number) {
  const ticket = await getTicket(c.env.DB, id);
  if (!ticket) throw notFound('ไม่พบ ticket');
  if (!canViewTicket(c.get('user'), ticket)) throw forbidden('ดูได้เฉพาะ ticket ของตัวเอง');
  return ticket;
}

// ---------- FR-03 Create ----------
ticketRoutes.post('/tickets', async (c) => {
  const user = c.get('user');
  const parsed = validateCreate(await readJson(c));
  if (!parsed.ok) throw new ApiError(422, 'ValidationError', 'ข้อมูลไม่ครบหรือไม่ถูกต้อง', { fields: parsed.errors });

  const input = parsed.value;
  const customerId = input.customer_id ?? user.id;
  if (!isStaff(user.role) && customerId !== user.id) throw forbidden('สร้าง ticket ได้เฉพาะของตัวเอง');
  if (!verify(customerId)) throw badRequest('customer_id ไม่มีใน Identity');
  if (!(await categoryIsActive(c.env.DB, input.category_id))) throw badRequest('หมวดหมู่นี้ไม่มีหรือถูกปิดใช้งาน');

  const id = await insertTicket(c.env.DB, { ...input, customer_id: customerId });
  await recordStatus(c.env.DB, id, null, 'open', user.id, 'helpdesk', 'สร้างคำร้อง');
  const ticket = (await getTicket(c.env.DB, id))!;
  await publishEvent(c.env, 'ticket.created', ticket); // FR-04
  // PRD §8.1: keep the triage suggestion for the agent — runs after the response, never blocks creation (F31, P4)
  c.executionCtx.waitUntil(recordSuggestion(c.env, ticket));
  return c.json({ message: 'Ticket created', data: withNames(ticket) }, 201);
});

// ---------- FR-05 My tickets ----------
ticketRoutes.get('/tickets/me', async (c) => {
  const rows = await listTickets(c.env.DB, { customerId: c.get('user').id });
  return c.json({ count: rows.length, data: rows.map(withNames) });
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
    assignedAgentId: q.assigned_agent_id ? Number(q.assigned_agent_id) : undefined,
    unassigned: q.unassigned === 'true',
    sort: q.sort === 'queue' ? 'queue' : 'recent',
  });
  return c.json({ count: rows.length, data: rows.map(withNames) });
});

// ---------- FR-06 Detail ----------
ticketRoutes.get('/tickets/:id', async (c) => {
  const ticket = await loadVisible(c, parseId(c.req.param('id')));
  const history = await getHistory(c.env.DB, ticket.id);
  return c.json({ data: { ...withNames(ticket), history } });
});

// ---------- FR-10 Triage / edit ----------
async function patchTicket(c: Context<AppEnv>) {
  const user = c.get('user');
  const ticket = await loadVisible(c, parseId(c.req.param('id')));
  if (!isStaff(user.role) && ticket.status !== 'open') {
    throw conflict('แก้ไขได้เฉพาะตอนที่คำร้องยังไม่มีผู้รับเรื่อง');
  }

  const body = await readJson<Record<string, unknown>>(c);
  const allowed = editableFields(user.role);
  const fields: Record<string, unknown> = {};
  for (const key of allowed) if (body[key] !== undefined) fields[key] = body[key];

  if (!Object.keys(fields).length) throw badRequest('ไม่มี field ที่แก้ไขได้', { allowed_fields: allowed });

  // Validate every field that reaches SQL
  if ('title' in fields && String(fields.title).trim().length < 5) throw badRequest('หัวเรื่องสั้นเกินไป');
  if ('priority' in fields && !PRIORITIES.includes(fields.priority as never)) throw badRequest('priority ไม่ถูกต้อง');
  if ('category_id' in fields && !(await categoryIsActive(c.env.DB, Number(fields.category_id)))) {
    throw badRequest('category_id ไม่มีหรือถูกปิดใช้งาน');
  }
  if ('assigned_agent_id' in fields && fields.assigned_agent_id !== null) {
    const agent = verify(Number(fields.assigned_agent_id));
    if (!agent || !canBeAssignee(agent.role)) throw badRequest('assigned_agent_id ต้องเป็นเจ้าหน้าที่ (agent)');
  }
  if ('wellbeing_service_slug' in fields && fields.wellbeing_service_slug !== null &&
      !WELLBEING_SLUGS.includes(fields.wellbeing_service_slug as never)) {
    throw badRequest('wellbeing_service_slug ไม่อยู่ใน catalogue');
  }

  let newStatus: TicketStatus | null = null;
  if ('status' in fields) {
    const to = fields.status as TicketStatus;
    if (!STATUSES.includes(to)) throw badRequest('status ไม่ถูกต้อง');
    if (!canTransition(ticket.status, to)) throw conflict(`เปลี่ยนสถานะจาก ${ticket.status} เป็น ${to} ไม่ได้`);
    if (to !== ticket.status) newStatus = to;
    if (to === 'resolved') fields.resolved_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
  }

  await updateTicket(c.env.DB, ticket.id, fields);
  if (newStatus) await recordStatus(c.env.DB, ticket.id, ticket.status, newStatus, user.id);

  const updated = (await getTicket(c.env.DB, ticket.id))!;
  if (newStatus === 'resolved') await publishEvent(c.env, 'ticket.resolved', updated);
  else if (newStatus) await publishEvent(c.env, 'ticket.status_changed', updated, { from: ticket.status });
  return c.json({ message: 'Ticket updated', data: withNames(updated) });
}
ticketRoutes.patch('/tickets/:id', patchTicket);
ticketRoutes.put('/tickets/:id', patchTicket);

// ---------- Delete (Assignment 2) ----------
ticketRoutes.delete('/tickets/:id', async (c) => {
  const user = c.get('user');
  const ticket = await loadVisible(c, parseId(c.req.param('id')));
  if (user.role === 'agent') throw forbidden('agent ลบ ticket ไม่ได้ ใช้ resolve แทน');
  if (ticket.status === 'resolved' || ticket.status === 'closed') throw conflict('ticket ที่ปิดแล้วลบไม่ได้');
  await c.env.DB.prepare('DELETE FROM tickets WHERE id = ?').bind(ticket.id).run();
  return c.json({ message: 'Ticket deleted', id: ticket.id });
});

// ---------- FR-09 Assign ----------
ticketRoutes.post('/tickets/:id/assign', async (c) => {
  const user = c.get('user');
  const ticket = await loadVisible(c, parseId(c.req.param('id')));
  const check = canAssign(user, ticket);
  if (!check.ok) throw forbidden(check.reason!);

  const body = await readJson<{ agent_id?: number }>(c);
  const agentId = Number(body.agent_id ?? user.id); // default = assign to myself (agents)
  const agent = verify(agentId);
  if (!agent || !canBeAssignee(agent.role)) throw badRequest('agent_id ต้องเป็นเจ้าหน้าที่ (agent) ผู้ดูแลระบบรับงานเองไม่ได้');

  const to: TicketStatus = ticket.status === 'open' ? 'assigned' : ticket.status;
  await updateTicket(c.env.DB, ticket.id, { assigned_agent_id: agentId, status: to });
  if (to !== ticket.status) await recordStatus(c.env.DB, ticket.id, ticket.status, to, user.id, 'helpdesk', `มอบหมายให้ ${agent.displayName}`);

  const updated = (await getTicket(c.env.DB, ticket.id))!;
  await publishEvent(c.env, 'ticket.assigned', updated);
  return c.json({ message: 'Ticket assigned', data: withNames(updated) });
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

  const updated = (await getTicket(c.env.DB, ticket.id))!;
  await publishEvent(c.env, 'ticket.resolved', updated);
  return c.json({ message: 'Ticket resolved', data: withNames(updated) });
});
