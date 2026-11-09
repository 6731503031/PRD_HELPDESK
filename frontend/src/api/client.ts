/**
 * The ONLY place the UI talks to the backend.
 * Adds the Identity-stub headers and turns error responses into typed errors.
 */
import type { Category, Comment, Priority, Stats, Suggestion, Ticket, TicketDetail, TicketStatus, User } from './types';

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
    throw new ApiError(0, 'Network', 'Cannot reach the server. Check your internet connection and try again.');
  }

  const body = await res.json().catch(() => ({}));
  if (res.ok) return body as T;
  if (res.status === 501) throw new NotReadyError(body.feature ?? '', body.owner ?? '', body.message ?? 'Not available yet');
  throw new ApiError(res.status, body.error ?? 'Error', body.message ?? `Something went wrong (${res.status})`, body.fields);
}

/** Old 'assigned' rows (before v1.1) are shown as in progress, so no screen meets an unknown status. */
const fix = <T extends { status: string }>(t: T): T => (t.status === 'assigned' ? { ...t, status: 'in_progress' } : t);

const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) });
const patch = (body: unknown) => ({ method: 'PATCH', body: JSON.stringify(body) });

export const api = {
  // sign-in (Identity stub): a guest gets an id from a self-declared name; nothing is verified
  me: () => request<{ data: User }>('/me').then((r) => r.data),
  createGuest: (name: string, email: string) => request<{ data: User }>('/auth/guest', post({ name, email })).then((r) => r.data),
  updateProfile: (name: string, email: string) =>
    request<{ data: User }>('/me', { method: 'PUT', body: JSON.stringify({ name, email }) }).then((r) => r.data),

  // reference
  config: () => request<{ data: { maintenance_portal_url: string | null } }>('/config').then((r) => r.data),
  users: () => request<{ data: User[] }>('/users').then((r) => r.data),
  categories: (all = false) => request<{ data: Category[] }>(`/categories${all ? '?all=true' : ''}`).then((r) => r.data),

  // tickets (P1)
  createTicket: (input: { subject: string; description: string; location: string; category_id: number; urgency: Priority }) =>
    request<{ data: Ticket }>('/tickets', post(input)).then((r) => fix(r.data)),
  myTickets: () => request<{ data: Ticket[] }>('/tickets/me').then((r) => r.data.map(fix)),
  queue: (f: { status?: string; priority?: string } = {}) => {
    const q = new URLSearchParams({ sort: 'queue' });
    if (f.status) q.set('status', f.status);
    if (f.priority) q.set('priority', f.priority);
    return request<{ data: Ticket[] }>(`/tickets?${q}`).then((r) => r.data.map(fix));
  },
  ticket: (id: number) => request<{ data: TicketDetail }>(`/tickets/${id}`).then((r) => fix(r.data)),
  updateTicket: (id: number, fields: Partial<{ priority: Priority; category_id: number; status: TicketStatus; title: string; description: string; location: string }>) =>
    request<{ data: Ticket }>(`/tickets/${id}`, patch(fields)).then((r) => fix(r.data)),
  resolve: (id: number, note: string) =>
    request<{ data: Ticket }>(`/tickets/${id}/resolve`, post({ resolution_note: note })).then((r) => fix(r.data)),

  // chat (F11): one conversation per ticket, requester <-> admin. No internal notes (PRD v1.1).
  comments: (id: number) => request<{ data: Comment[] }>(`/tickets/${id}/comments`).then((r) => r.data),
  addComment: (id: number, content: string) =>
    request<{ data: Comment }>(`/tickets/${id}/comments`, post({ content })).then((r) => r.data),

  // maintenance (P3)
  /** Main way: Helpdesk creates the work order at Team 10 and links it. */
  sendWorkOrder: (id: number, input: { title: string; description: string; location: string; category: string }) =>
    request<{ maintenance_work_order_id: string; work_order_status: string }>(`/tickets/${id}/send-maintenance`, post(input)),
  /** Backup way: link a work order id the admin already has. */
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
