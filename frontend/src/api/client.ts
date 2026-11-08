/**
 * The ONLY place the UI talks to the backend.
 * Adds the Identity-stub headers and turns error responses into typed errors.
 */
import type { Category, Comment, Priority, Stats, Suggestion, Ticket, TicketDetail, TicketStatus, User, Visibility } from './types';

const BASE = '/api/v1';

/** Set by the identity provider whenever the demo user changes. */
let currentUser: { id: number; role: string } | null = null;
export function setApiUser(user: { id: number; role: string } | null) {
  currentUser = user;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

/** A feature a teammate has not built yet (backend answered 501). */
export class NotReadyError extends ApiError {
  constructor(public feature: string, public owner: string, message: string) {
    super(501, 'NotImplemented', message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (currentUser) {
    headers.set('x-user-id', String(currentUser.id));
    headers.set('x-user-role', currentUser.role);
  }

  let res: Response;
  try {
    res = await fetch(BASE + path, { ...init, headers });
  } catch {
    throw new ApiError(0, 'Network', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง');
  }

  const body = await res.json().catch(() => ({}));
  if (res.ok) return body as T;
  if (res.status === 501) throw new NotReadyError(body.feature ?? '', body.owner ?? '', body.message ?? 'ยังไม่เปิดใช้งาน');
  throw new ApiError(res.status, body.error ?? 'Error', body.message ?? `เกิดข้อผิดพลาด (${res.status})`, body.fields);
}

const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) });
const patch = (body: unknown) => ({ method: 'PATCH', body: JSON.stringify(body) });

export const api = {
  // reference
  users: () => request<{ data: User[] }>('/users').then((r) => r.data),
  categories: (all = false) => request<{ data: Category[] }>(`/categories${all ? '?all=true' : ''}`).then((r) => r.data),

  // tickets (P1)
  createTicket: (input: { subject: string; description: string; category_id: number; urgency: Priority }) =>
    request<{ data: Ticket }>('/tickets', post(input)).then((r) => r.data),
  myTickets: () => request<{ data: Ticket[] }>('/tickets/me').then((r) => r.data),
  queue: (f: { status?: string; priority?: string; unassigned?: boolean } = {}) => {
    const q = new URLSearchParams({ sort: 'queue' });
    if (f.status) q.set('status', f.status);
    if (f.priority) q.set('priority', f.priority);
    if (f.unassigned) q.set('unassigned', 'true');
    return request<{ data: Ticket[] }>(`/tickets?${q}`).then((r) => r.data);
  },
  ticket: (id: number) => request<{ data: TicketDetail }>(`/tickets/${id}`).then((r) => r.data),
  updateTicket: (id: number, fields: Partial<{ priority: Priority; category_id: number; status: TicketStatus; title: string; description: string }>) =>
    request<{ data: Ticket }>(`/tickets/${id}`, patch(fields)).then((r) => r.data),
  assign: (id: number, agentId: number) => request<{ data: Ticket }>(`/tickets/${id}/assign`, post({ agent_id: agentId })).then((r) => r.data),
  resolve: (id: number, note: string) =>
    request<{ data: Ticket }>(`/tickets/${id}/resolve`, post({ resolution_note: note })).then((r) => r.data),

  // comments (P2)
  comments: (id: number) => request<{ data: Comment[] }>(`/tickets/${id}/comments`).then((r) => r.data),
  addComment: (id: number, content: string, visibility: Visibility) =>
    request<{ data: Comment }>(`/tickets/${id}/comments`, post({ content, visibility })).then((r) => r.data),

  // maintenance (P3)
  linkWorkOrder: (id: number, workOrderId: string) =>
    request<{ maintenance_work_order_id: string }>(`/tickets/${id}/link-maintenance`, post({ work_order_id: workOrderId })),

  // triage + admin (P4)
  suggest: (input: { subject: string; description: string; urgency?: Priority }) =>
    request<{ data: Suggestion }>('/tickets/suggest', post(input)).then((r) => r.data),
  stats: () => request<{ data: Stats }>('/admin/stats').then((r) => r.data),
  addCategory: (name: string, description: string) =>
    request<{ data: Category }>('/admin/categories', post({ name, description })).then((r) => r.data),
  setCategoryActive: (id: number, active: boolean) =>
    request<{ data: Category }>(`/admin/categories/${id}`, patch({ is_active: active })).then((r) => r.data),
};
