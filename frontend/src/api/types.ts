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
  /** Where the problem is (typed by the requester). Null on tickets made before locations existed. */
  location: string | null;
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
  /** Team 10 category chosen when the ticket was sent (Plumbing, Electrical, HVAC, Safety, Not sure). */
  maintenance_category: string | null;
  ai_category_id: number | null;
  ai_category_name: string | null;
  ai_priority: Priority | null;
  ai_route: Suggestion['route'] | null;
  ai_source: Suggestion['source'] | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

/** GET /tickets/:id/wellbeing-suggestion — Team 16 contract 2.0. Nothing about the ticket is sent to Team 16. */
export type WellbeingService = { id: string; name: string; description: string; duration_minutes: number };
export type WellbeingSuggestion = {
  ticket_id: number;
  /** false: Team 16 is unreachable — hide the list, keep the ticket working */
  available: boolean;
  /** danger words in the ticket: show the emergency numbers, no appointment */
  danger: boolean;
  /** Wellbeing category, AI route 'wellbeing' or a service chosen: only then is a service suggested */
  wellbeing_ticket: boolean;
  emergency_numbers: { number: string; label: string }[];
  emergency_url: string;
  booking_url: string;
  suggested_service: WellbeingService | null;
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
