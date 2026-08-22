/**
 * Helpdesk Ticket CRUD API
 * Stack: Cloudflare Workers + Hono + D1 (SQLite)
 *
 * Assignment 2 scope: Ticket CRUD + Categories reference
 *  - Identity: stub via headers + src/identity.ts (PRD §10.2 — Helpdesk ไม่ own user data)
 *  - DB: D1 (Cloudflare serverless SQLite)
 *
 * Endpoints:
 *   GET    /                  health
 *   GET    /categories        list categories
 *   GET    /users             list Identity directory (stub for testing)
 *   GET    /tags              list tags
 *   POST   /tickets           create
 *   GET    /tickets           list (filter: ?status=&priority=&customer_id=&assigned_agent_id=)
 *   GET    /tickets/:id       read one (with category/customer/agent join)
 *   PATCH  /tickets/:id       partial update
 *   PUT    /tickets/:id       full replace of editable fields
 *   DELETE /tickets/:id       delete
 *   POST   /tickets/:id/assign assign agent
 *   POST   /tickets/:id/resolve resolve ticket
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import {
  verify as verifyIdentity,
  isAgentOrAdmin,
  USER_DIRECTORY,
  type Role,
} from './identity';

// ===== Types =====
type Bindings = {
  DB: D1Database;
};

type Ticket = {
  id: number;
  ticket_number: string;
  title: string;
  description: string;
  status: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category_id: number;
  customer_id: number;
  assigned_agent_id: number | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

const ALLOWED_STATUSES = ['open', 'assigned', 'in_progress', 'resolved', 'closed'] as const;
const ALLOWED_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

// ===== App =====
const app = new Hono<{ Bindings: Bindings }>();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'x-user-id', 'x-user-role'],
  }),
);

// ===== Stub auth middleware =====
// PRD §10.2 + §20: Identity stub — verify against static directory.
// Production จะเปลี่ยน verifyIdentity() → real Identity JWT/API call แค่ที่เดียว
const requireAuth = async (
  c: any,
  next: () => Promise<void>,
) => {
  const userId = c.req.header('x-user-id');
  const declaredRole = c.req.header('x-user-role') as Role | undefined;

  if (!userId || !declaredRole) {
    return c.json(
      { error: 'Unauthorized', message: 'ต้องส่ง header x-user-id และ x-user-role' },
      401,
    );
  }
  if (!['customer', 'agent', 'admin'].includes(declaredRole)) {
    return c.json({ error: 'Forbidden', message: 'role ไม่ถูกต้อง' }, 403);
  }

  const externalId = Number(userId);
  const identity = verifyIdentity(externalId);

  if (!identity) {
    return c.json(
      { error: 'Unauthorized', message: 'ไม่พบ user นี้ในระบบ (Identity stub)' },
      401,
    );
  }

  // Optional: ตรวจสอบ role ที่ส่งมาให้ตรงกับ Identity (ป้องกัน client spoofing)
  if (identity.role !== declaredRole) {
    return c.json(
      { error: 'Forbidden', message: `role ไม่ตรงกับ Identity (Identity บอกว่าเป็น ${identity.role})` },
      403,
    );
  }

  c.set('user', { id: identity.externalId, role: identity.role, displayName: identity.displayName });
  await next();
};

app.use('/tickets', requireAuth);
app.use('/tickets/*', requireAuth);

// ===== Helper: ownership check =====
const canAccessTicket = async (
  c: any,
  ticket: Ticket,
): Promise<{ allowed: boolean; reason?: string }> => {
  const user = c.get('user') as { id: number; role: Role };
  if (user.role === 'agent' || user.role === 'admin') return { allowed: true };
  if (user.role === 'customer' && ticket.customer_id === user.id) return { allowed: true };
  return { allowed: false, reason: 'เห็นได้เฉพาะ ticket ของตัวเอง' };
};

// ===== Helper: generate ticket_number =====
async function generateTicketNumber(db: D1Database): Promise<string> {
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM tickets')
    .first<{ n: number }>();
  const next = String((row?.n ?? 0) + 1).padStart(5, '0');
  return `TKT-${next}`;
}

// ===== Health =====
app.get('/', (c) =>
  c.json({
    service: 'helpdesk-api',
    version: '1.0.0',
    endpoints: [
      'GET    /',
      'GET    /categories',
      'GET    /users',
      'GET    /tags',
      'POST   /tickets',
      'GET    /tickets',
      'GET    /tickets/:id',
      'PATCH  /tickets/:id',
      'PUT    /tickets/:id',
      'DELETE /tickets/:id',
      'POST   /tickets/:id/assign',
      'POST   /tickets/:id/resolve',
    ],
  }),
);

// ===== Reference data =====

app.get('/categories', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, name, description, created_at FROM ticket_categories ORDER BY id',
  ).all();
  return c.json({ count: results?.length ?? 0, data: results });
});

// /users → expose Identity stub directory (PRD §10.2 — reference, not owned data)
// ใน production endpoint นี้จะถูกแทนด้วยการเรียก Identity API โดยตรง
app.get('/users', async (c) => {
  const data = Object.values(USER_DIRECTORY).map((u) => ({
    id: u.externalId,
    email: u.email,
    full_name: u.displayName,
    role: u.role,
  }));
  return c.json({ count: data.length, data });
});

app.get('/tags', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT id, name FROM tags ORDER BY id').all();
  return c.json({ count: results?.length ?? 0, data: results });
});

// ===== Ticket CRUD =====

// CREATE
app.post('/tickets', async (c) => {
  const body = await c.req.json<{
    title?: string;
    description?: string;
    category_id?: number;
    priority?: string;
    customer_id?: number;
    assigned_agent_id?: number | null;
  }>();

  // Validate required fields
  if (!body.title || !body.description || !body.category_id) {
    return c.json(
      {
        error: 'BadRequest',
        message: 'ต้องมี title, description, category_id',
        required: ['title', 'description', 'category_id'],
      },
      400,
    );
  }

  // Validate priority
  const priority =
    body.priority && ALLOWED_PRIORITIES.includes(body.priority as any)
      ? body.priority
      : 'medium';

  // customer_id default = current user (ถ้าเป็น customer)
  const user = c.get('user') as { id: number; role: Role };
  let customerId = body.customer_id;
  if (!customerId) customerId = user.id;

  // customer ห้ามสร้าง ticket แทนคนอื่น
  if (user.role === 'customer' && customerId !== user.id) {
    return c.json(
      { error: 'Forbidden', message: 'customer สร้าง ticket ได้เฉพาะของตัวเอง' },
      403,
    );
  }

  // Validate FKs
  const category = await c.env.DB.prepare('SELECT id FROM ticket_categories WHERE id = ?')
    .bind(body.category_id)
    .first();
  if (!category) {
    return c.json({ error: 'BadRequest', message: 'category_id ไม่มีในระบบ' }, 400);
  }
  const customer = verifyIdentity(customerId);
  if (!customer) {
    return c.json({ error: 'BadRequest', message: 'customer_id ไม่มีในระบบ (Identity)' }, 400);
  }
  if (body.assigned_agent_id) {
    const agent = verifyIdentity(body.assigned_agent_id);
    if (!agent || !isAgentOrAdmin(agent.role)) {
      return c.json(
        { error: 'BadRequest', message: 'assigned_agent_id ต้องเป็น agent หรือ admin (Identity)' },
        400,
      );
    }
  }

  const ticketNumber = await generateTicketNumber(c.env.DB);

  const result = await c.env.DB.prepare(
    `INSERT INTO tickets
      (ticket_number, title, description, priority, category_id, customer_id, assigned_agent_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      ticketNumber,
      body.title,
      body.description,
      priority,
      body.category_id,
      customerId,
      body.assigned_agent_id ?? null,
    )
    .run();

  const newId = result.meta.last_row_id;
  const ticket = await c.env.DB.prepare('SELECT * FROM tickets WHERE id = ?')
    .bind(newId)
    .first<Ticket>();

  // TODO (PRD §7): publish ticket.created event here
  // await publishEvent('ticket.created', ticket);

  return c.json({ message: 'Ticket created', data: ticket }, 201);
});

// LIST
app.get('/tickets', async (c) => {
  const user = c.get('user') as { id: number; role: Role };

  const status = c.req.query('status');
  const priority = c.req.query('priority');
  const customerId = c.req.query('customer_id');
  const agentId = c.req.query('assigned_agent_id');

  // Build WHERE
  const where: string[] = [];
  const params: any[] = [];

  // Customer เห็นได้เฉพาะ ticket ตัวเอง
  if (user.role === 'customer') {
    where.push('t.customer_id = ?');
    params.push(user.id);
  }
  if (status && ALLOWED_STATUSES.includes(status as any)) {
    where.push('t.status = ?');
    params.push(status);
  }
  if (priority && ALLOWED_PRIORITIES.includes(priority as any)) {
    where.push('t.priority = ?');
    params.push(priority);
  }
  if (customerId) {
    where.push('t.customer_id = ?');
    params.push(Number(customerId));
  }
  if (agentId) {
    where.push('t.assigned_agent_id = ?');
    params.push(Number(agentId));
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const sql = `
    SELECT
      t.*,
      c.name AS category_name
    FROM tickets t
    LEFT JOIN ticket_categories c ON c.id = t.category_id
    ${whereClause}
    ORDER BY t.created_at DESC
  `;

  const { results } = await c.env.DB.prepare(sql).bind(...params).all<Ticket & { category_name: string }>();

  // Enrich with Identity data (PRD §10.2 — reference, not duplicated)
  const enriched = (results ?? []).map((t) => {
    const customer = verifyIdentity(t.customer_id);
    const agent = t.assigned_agent_id != null ? verifyIdentity(t.assigned_agent_id) : null;
    return {
      ...t,
      customer_name: customer?.displayName ?? null,
      customer_email: customer?.email ?? null,
      agent_name: agent?.displayName ?? null,
    };
  });

  return c.json({ count: enriched.length, data: enriched });
});

// READ ONE
app.get('/tickets/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'BadRequest', message: 'id ไม่ถูกต้อง' }, 400);
  }

  const ticket = await c.env.DB.prepare(
    `SELECT
      t.*,
      c.name AS category_name
    FROM tickets t
    LEFT JOIN ticket_categories c ON c.id = t.category_id
    WHERE t.id = ?`,
  )
    .bind(id)
    .first<Ticket & { category_name: string }>();

  if (!ticket) {
    return c.json({ error: 'NotFound', message: 'ไม่พบ ticket' }, 404);
  }

  const access = await canAccessTicket(c, ticket as Ticket);
  if (!access.allowed) {
    return c.json({ error: 'Forbidden', message: access.reason }, 403);
  }

  // Enrich with Identity (PRD §10.2 — reference, not duplicated)
  const customer = verifyIdentity(ticket.customer_id);
  const agent = ticket.assigned_agent_id != null ? verifyIdentity(ticket.assigned_agent_id) : null;

  return c.json({
    data: {
      ...ticket,
      customer_name: customer?.displayName ?? null,
      customer_email: customer?.email ?? null,
      agent_name: agent?.displayName ?? null,
    },
  });
});

// PATCH (partial update)
app.patch('/tickets/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'BadRequest', message: 'id ไม่ถูกต้อง' }, 400);
  }

  const existing = await c.env.DB.prepare('SELECT * FROM tickets WHERE id = ?')
    .bind(id)
    .first<Ticket>();
  if (!existing) {
    return c.json({ error: 'NotFound', message: 'ไม่พบ ticket' }, 404);
  }

  const user = c.get('user') as { id: number; role: Role };

  // Authorization
  if (user.role === 'customer' && existing.customer_id !== user.id) {
    return c.json({ error: 'Forbidden', message: 'แก้ไขได้เฉพาะ ticket ตัวเอง' }, 403);
  }
  // Customer แก้ได้เฉพาะ title/description (per PRD FR-07)
  const customerEditable = ['title', 'description'];
  const agentEditable = [
    ...customerEditable,
    'priority',
    'status',
    'category_id',
    'assigned_agent_id',
    'resolution_note',
  ];

  const body = await c.req.json<Record<string, any>>();
  const updates: string[] = [];
  const params: any[] = [];
  const editable = user.role === 'customer' ? customerEditable : agentEditable;

  for (const key of editable) {
    if (body[key] !== undefined) {
      // Validate enum
      if (key === 'status' && !ALLOWED_STATUSES.includes(body[key])) {
        return c.json({ error: 'BadRequest', message: `status ไม่ถูกต้อง` }, 400);
      }
      if (key === 'priority' && !ALLOWED_PRIORITIES.includes(body[key])) {
        return c.json({ error: 'BadRequest', message: `priority ไม่ถูกต้อง` }, 400);
      }
      updates.push(`${key} = ?`);
      params.push(body[key]);
    }
  }

  if (updates.length === 0) {
    return c.json(
      { error: 'BadRequest', message: 'ไม่มี field ที่แก้ไขได้', allowed_fields: editable },
      400,
    );
  }

  updates.push('updated_at = datetime("now")');
  params.push(id);

  await c.env.DB.prepare(`UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...params)
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM tickets WHERE id = ?')
    .bind(id)
    .first<Ticket>();

  return c.json({ message: 'Ticket updated', data: updated });
});

// PUT (full replace of editable fields — same editable set as PATCH ใน assignment นี้)
app.put('/tickets/:id', async (c) => {
  // ส่งต่อไป PATCH handler เพื่อให้ behavior เหมือนกัน (assignment scope)
  // production จะแยก logic PUT vs PATCH ชัดเจน
  return app.fetch(
    new Request(c.req.url, {
      method: 'PATCH',
      headers: c.req.raw.headers,
      body: JSON.stringify(await c.req.json()),
    }),
    c.env,
  );
});

// DELETE
app.delete('/tickets/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'BadRequest', message: 'id ไม่ถูกต้อง' }, 400);
  }

  const user = c.get('user') as { id: number; role: Role };
  const existing = await c.env.DB.prepare('SELECT * FROM tickets WHERE id = ?')
    .bind(id)
    .first<Ticket>();
  if (!existing) {
    return c.json({ error: 'NotFound', message: 'ไม่พบ ticket' }, 404);
  }

  // Authorization: เฉพาะ owner (ก่อน resolve) หรือ admin
  if (user.role === 'customer' && existing.customer_id !== user.id) {
    return c.json({ error: 'Forbidden', message: 'ลบได้เฉพาะ ticket ตัวเอง' }, 403);
  }
  if (user.role === 'agent') {
    return c.json(
      { error: 'Forbidden', message: 'agent ลบ ticket ไม่ได้ ใช้ resolve แทน' },
      403,
    );
  }
  if (existing.status === 'resolved' || existing.status === 'closed') {
    return c.json(
      { error: 'Conflict', message: 'ticket ที่ resolved/closed แล้วลบไม่ได้' },
      409,
    );
  }

  await c.env.DB.prepare('DELETE FROM tickets WHERE id = ?').bind(id).run();
  return c.json({ message: 'Ticket deleted', id });
});

// ASSIGN (Agent only)
app.post('/tickets/:id/assign', async (c) => {
  const id = Number(c.req.param('id'));
  const user = c.get('user') as { id: number; role: Role };

  if (user.role === 'customer') {
    return c.json({ error: 'Forbidden', message: 'customer assign ticket ไม่ได้' }, 403);
  }

  const body = await c.req.json<{ agent_id?: number }>();
  if (!body.agent_id) {
    return c.json({ error: 'BadRequest', message: 'ต้องมี agent_id' }, 400);
  }

  const agent = verifyIdentity(body.agent_id);
  if (!agent || !isAgentOrAdmin(agent.role)) {
    return c.json(
      { error: 'BadRequest', message: 'agent_id ต้องเป็น agent หรือ admin (Identity)' },
      400,
    );
  }

  const existing = await c.env.DB.prepare('SELECT * FROM tickets WHERE id = ?')
    .bind(id)
    .first<Ticket>();
  if (!existing) {
    return c.json({ error: 'NotFound', message: 'ไม่พบ ticket' }, 404);
  }

  await c.env.DB.prepare(
    `UPDATE tickets
       SET assigned_agent_id = ?, status = 'assigned', updated_at = datetime('now')
       WHERE id = ?`,
  )
    .bind(body.agent_id, id)
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM tickets WHERE id = ?')
    .bind(id)
    .first<Ticket>();

  // TODO (PRD §7): publish ticket.assigned event
  return c.json({ message: 'Ticket assigned', data: updated });
});

// RESOLVE (Agent only)
app.post('/tickets/:id/resolve', async (c) => {
  const id = Number(c.req.param('id'));
  const user = c.get('user') as { id: number; role: Role };

  if (user.role === 'customer') {
    return c.json({ error: 'Forbidden', message: 'customer resolve ticket ไม่ได้' }, 403);
  }

  const body = await c.req.json<{ resolution_note?: string }>().catch(() => ({}));

  const existing = await c.env.DB.prepare('SELECT * FROM tickets WHERE id = ?')
    .bind(id)
    .first<Ticket>();
  if (!existing) {
    return c.json({ error: 'NotFound', message: 'ไม่พบ ticket' }, 404);
  }

  await c.env.DB.prepare(
    `UPDATE tickets
       SET status = 'resolved',
           resolved_at = datetime('now'),
           resolution_note = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
  )
    .bind(body.resolution_note ?? null, id)
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM tickets WHERE id = ?')
    .bind(id)
    .first<Ticket>();

  // TODO (PRD §7): publish ticket.resolved event
  return c.json({ message: 'Ticket resolved', data: updated });
});

// ===== 404 =====
app.notFound((c) =>
  c.json({ error: 'NotFound', message: 'ไม่พบ endpoint นี้', path: c.req.path }, 404),
);

// ===== Error handler =====
app.onError((err, c) => {
  console.error(err);
  return c.json(
    { error: 'InternalServerError', message: 'มีบางอย่างผิดพลาด', detail: String(err) },
    500,
  );
});

export default app;