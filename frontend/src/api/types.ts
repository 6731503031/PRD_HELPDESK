/** Shapes returned by the Helpdesk API (/api/v1). Keep in sync with src/modules/*. */

export type Role = 'customer' | 'admin';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export type User = { id: number; full_name: string; role: Role; email: string };
export type Category = { id: number; name: string; description: string | null; is_active: number };

export type Ticket = {
  id: number;
  ticket_number: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: Priority;
  category_id: number;
  category_name: string | null;
  customer_id: number;
  customer_name: string | null;
  resolution_note: string | null;
  maintenance_work_order_id: string | null;
  maintenance_status: string | null;
  maintenance_status_at: string | null;
  ai_category_id: number | null;
  ai_category_name: string | null;
  ai_priority: Priority | null;
  ai_route: Suggestion['route'] | null;
  ai_source: Suggestion['source'] | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export type HistoryEntry = {
  from_status: string | null;
  to_status: string;
  changed_by: number | null;
  changed_by_name: string | null;
  source: 'helpdesk' | 'maintenance' | 'system';
  note: string | null;
  created_at: string;
};

export type TicketDetail = Ticket & { history: HistoryEntry[] };

export type Comment = {
  id: number;
  author_id: number;
  author_name: string | null;
  /** 'system' = automatic message (start, sent to Team 10, repair progress, resolved), shown as a grey line */
  author_role: Role | 'system' | null;
  content: string;
  created_at: string;
};

export type Suggestion = {
  category_id: number;
  category_name: string;
  priority: Priority;
  route: 'helpdesk' | 'maintenance' | 'it_support' | 'wellbeing';
  source: 'ai' | 'fallback';
  reason: string;
};

export type Stats = {
  total: number;
  by_status: Partial<Record<TicketStatus, number>>;
  by_priority: Partial<Record<Priority, number>>;
};
