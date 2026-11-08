/**
 * Ticket chat = comments (PRD §9.1, FR-11 public messages, FR-12 internal notes, BR-03).
 * Owner: P2 (Comments & Events)
 *
 *   GET  /tickets/:id/comments?after=<id>   list, oldest first (requester sees public only)
 *                                            `after` = only messages newer than that id (for polling)
 *   POST /tickets/:id/comments              { content, visibility: 'public' | 'internal' }
 *
 * Response:
 *   GET  → { count, data: [{ id, ticket_id, author_id, author_name, author_role, content, visibility, created_at }] }
 *   POST → 201 { message, data: <same item> }
 *
 * Ideas for P2 to build on (not required by the PRD):
 *   TODO(P2): publishEvent('ticket.commented', …) for public messages (events/publish.ts)
 *   TODO(P2): unread count per ticket for the staff dashboard (e.g. last_seen table)
 *   TODO(P2): when a requester replies to a 'resolved' ticket, flag it for the admin
 */
import { Hono, type Context } from 'hono';
import type { AppEnv } from '../../core/env';
import { verify } from '../../core/identity';
import { badRequest, forbidden, notFound, parseId, readJson } from '../../core/http';
import { getTicket } from '../tickets/repo';
import { canViewTicket } from '../tickets/rules';
import { canPost, validateContent, visibleTo, VISIBILITIES, type Comment, type Visibility } from './rules';

export const commentRoutes = new Hono<AppEnv>();

const withAuthor = (c: Comment) => {
  const author = verify(c.author_id);
  return { ...c, author_name: author?.displayName ?? null, author_role: author?.role ?? null };
};

/** Same rule as viewing the ticket: requester sees own tickets, staff see all (FR-07). */
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
    `SELECT id, ticket_id, author_id, content, visibility, created_at
       FROM ticket_comments WHERE ticket_id = ? AND id > ? ORDER BY id`,
  )
    .bind(ticket.id, after)
    .all<Comment>();
  const rows = visibleTo(c.get('user').role, results ?? []).map(withAuthor);
  return c.json({ count: rows.length, data: rows });
});

commentRoutes.post('/tickets/:id/comments', async (c) => {
  const user = c.get('user');
  const ticket = await loadVisibleTicket(c);
  const body = await readJson<{ content?: unknown; visibility?: unknown }>(c);

  const problem = validateContent(body.content);
  if (problem) throw badRequest(problem);
  const visibility = (body.visibility ?? 'public') as Visibility;
  if (!VISIBILITIES.includes(visibility)) throw badRequest("visibility ต้องเป็น 'public' หรือ 'internal'");
  if (!canPost(user.role, visibility)) throw forbidden('ผู้แจ้งเขียนบันทึกภายในไม่ได้');

  const content = String(body.content).trim();
  const inserted = await c.env.DB.prepare(
    `INSERT INTO ticket_comments (ticket_id, author_id, content, visibility) VALUES (?, ?, ?, ?)
     RETURNING id, ticket_id, author_id, content, visibility, created_at`,
  )
    .bind(ticket.id, user.id, content, visibility)
    .first<Comment>();
  // FR-05: a new public message counts as an update the requester can see
  if (visibility === 'public') {
    await c.env.DB.prepare(`UPDATE tickets SET updated_at = datetime('now') WHERE id = ?`).bind(ticket.id).run();
  }
  return c.json({ message: 'Comment added', data: withAuthor(inserted!) }, 201);
});
