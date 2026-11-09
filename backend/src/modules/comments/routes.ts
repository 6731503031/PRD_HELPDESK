/**
 * Ticket chat = comments (PRD §9.1, FR-11). One conversation per ticket: requester <-> admin.
 * Owner: P2 (Comments & Events)
 *
 *   GET  /tickets/:id/comments?after=<id>   list, oldest first (`after` = only messages newer than that id, for polling)
 *   POST /tickets/:id/comments              { content }
 *
 * Response:
 *   GET  -> { count, data: [{ id, ticket_id, author_id, author_name, author_role, content, created_at }] }
 *   POST -> 201 { message, data: <same item> }
 *
 * Who may read / write: whoever may view the ticket (requester = own tickets, admin = all).
 *
 * Ideas for P2 to build on (not required by the PRD):
 *   TODO(P2): publishEvent('ticket.commented', ...) for new messages (events/publish.ts)
 *   TODO(P2): unread count per ticket (e.g. a last_seen table)
 *   TODO(P2): when a requester replies to a 'resolved' ticket, flag it for the admin
 */
import { Hono, type Context } from 'hono';
import type { AppEnv } from '../../core/env';
import { verify } from '../../core/identity';
import { displayNames } from '../../core/profiles';
import { badRequest, forbidden, notFound, parseId, readJson } from '../../core/http';
import { getTicket } from '../tickets/repo';
import { canViewTicket } from '../tickets/rules';
import { validateContent, type Comment } from './rules';
import { SYSTEM_AUTHOR_ID, SYSTEM_AUTHOR_NAME } from './templates';

export const commentRoutes = new Hono<AppEnv>();

/**
 * Adds author name + role (directory or guest profile). Guests are always requesters.
 * Automatic messages (author 0, see templates.ts) come back with role 'system'.
 */
async function withAuthors(db: D1Database, rows: Comment[]) {
  const names = await displayNames(db, rows.map((r) => r.author_id).filter((id) => id !== SYSTEM_AUTHOR_ID));
  return rows.map((r) =>
    r.author_id === SYSTEM_AUTHOR_ID
      ? { ...r, author_name: SYSTEM_AUTHOR_NAME, author_role: 'system' }
      : { ...r, author_name: names.get(r.author_id) ?? null, author_role: verify(r.author_id)?.role ?? 'customer' },
  );
}

/** Same rule as viewing the ticket: requester sees own tickets, admin sees all (FR-07). */
async function loadVisibleTicket(c: Context<AppEnv>) {
  const ticket = await getTicket(c.env.DB, parseId(c.req.param('id')));
  if (!ticket) throw notFound('ไม่พบคำร้อง');
  if (!canViewTicket(c.get('user'), ticket)) throw forbidden('ดูได้เฉพาะคำร้องของตัวเอง');
  return ticket;
}

commentRoutes.get('/tickets/:id/comments', async (c) => {
  const ticket = await loadVisibleTicket(c);
  const after = Number(c.req.query('after') ?? 0) || 0;
  const { results } = await c.env.DB.prepare(
    `SELECT id, ticket_id, author_id, content, created_at
       FROM ticket_comments WHERE ticket_id = ? AND id > ? ORDER BY id`,
  )
    .bind(ticket.id, after)
    .all<Comment>();
  const rows = await withAuthors(c.env.DB, results ?? []);
  return c.json({ count: rows.length, data: rows });
});

commentRoutes.post('/tickets/:id/comments', async (c) => {
  const user = c.get('user');
  const ticket = await loadVisibleTicket(c);
  const body = await readJson<{ content?: unknown }>(c);

  const problem = validateContent(body.content);
  if (problem) throw badRequest(problem);

  const content = String(body.content).trim();
  const inserted = await c.env.DB.prepare(
    `INSERT INTO ticket_comments (ticket_id, author_id, content) VALUES (?, ?, ?)
     RETURNING id, ticket_id, author_id, content, created_at`,
  )
    .bind(ticket.id, user.id, content)
    .first<Comment>();
  // FR-05: a new message counts as an update the requester can see
  await c.env.DB.prepare(`UPDATE tickets SET updated_at = datetime('now') WHERE id = ?`).bind(ticket.id).run();
  return c.json({ message: 'Comment added', data: (await withAuthors(c.env.DB, [inserted!]))[0] }, 201);
});
