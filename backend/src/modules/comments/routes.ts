/**
 * Comment endpoints (PRD §9.1: POST /tickets/{id}/comments).
 * Owner: P2 (Comments & Events)
 *
 *   GET  /tickets/:id/comments   list (requester sees public only)
 *   POST /tickets/:id/comments   { content, visibility: 'public' | 'internal' }
 *
 * Response shape the UI already expects (public/js/pages/ticket-detail.js):
 *   GET  → { count, data: [{ id, author_id, author_name, author_role, content, visibility, created_at }] }
 *   POST → 201 { message, data: <same item> }
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../core/env';
import { notImplemented } from '../../core/http';

export const commentRoutes = new Hono<AppEnv>();

/**
 * TODO(P2, F11/F12):
 *  1. ticket = getTicket(...) ; 404 if missing ; 403 unless canViewTicket(user, ticket)  (tickets/rules.ts)
 *  2. SELECT * FROM ticket_comments WHERE ticket_id = ? ORDER BY created_at
 *  3. return visibleTo(user.role, rows) + author_name / author_role from verify(author_id)
 */
commentRoutes.get('/tickets/:id/comments', async () => {
  throw notImplemented('F11/F12 Comments', 'P2');
});

/**
 * TODO(P2, F11/F12):
 *  1. same access check as GET
 *  2. validateContent(body.content) → 400 ; canPost(role, visibility) → 403
 *  3. INSERT INTO ticket_comments (ticket_id, author_id, content, visibility)
 *  4. touch tickets.updated_at so "last update" moves (FR-05)
 */
commentRoutes.post('/tickets/:id/comments', async () => {
  throw notImplemented('F11/F12 Comments', 'P2');
});
