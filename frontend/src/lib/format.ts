import type { Priority, Role, TicketStatus } from '../api/types';

export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};
/** The steps a person sees (PRD §14, v1.1). 'closed' is an internal end state: it is shown as the last step, finished. */
export const STATUS_ORDER: TicketStatus[] = ['open', 'in_progress', 'resolved'];
/** Which visible step a status belongs to. */
export const stageOf = (s: TicketStatus): TicketStatus => (s === 'closed' ? 'resolved' : s);

/** Old rows from Assignment 2 can still say 'assigned' (agent role is gone): treat as in progress. */
export function normalizeStatus(value: string): TicketStatus {
  return value === 'assigned' ? 'in_progress' : (value as TicketStatus);
}
/** Label for any status string, including history rows written before v1.1. */
export const statusLabel = (value: string) => STATUS_LABEL[normalizeStatus(value)] ?? value;

/**
 * Team 10 Work Order status → what the requester reads (Use Case doc §7.2).
 * Status names still to be confirmed by Team 10; unknown values fall back to the raw text.
 */
const MAINTENANCE_LABEL: Record<string, string> = {
  reported: 'Sent to Maintenance',
  assigned: 'Sent to Maintenance',
  in_progress: 'Technician working on it',
  completed: 'Repair done, awaiting admin confirmation',
  closed: 'Repair done, awaiting admin confirmation',
  cancelled: 'Work order cancelled by Maintenance',
};
export const maintenanceLabel = (value: string | null) =>
  value ? MAINTENANCE_LABEL[value] ?? value : 'Waiting for Maintenance';
export const isRepairDone = (value: string | null) => value === 'completed' || value === 'closed';

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};
export const PRIORITY_HINT: Record<Priority, string> = {
  low: 'Can wait a few days',
  medium: 'Should be fixed within a few days',
  high: 'Affects study or work today',
  urgent: 'Completely unusable, or a safety risk',
};

export const ROLE_LABEL: Record<Role, string> = {
  customer: 'Requester',
  admin: 'Administrator',
};

export const ROUTE_LABEL: Record<string, string> = {
  helpdesk: 'Handled by Helpdesk',
  maintenance: 'Send to Maintenance',
  it_support: 'IT Support',
  wellbeing: 'Refer to Wellbeing services',
};

/** D1 returns 'YYYY-MM-DD HH:MM:SS' in UTC. */
function toDate(value: string): Date {
  return new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
}

const dateTime = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const dateOnly = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export const formatDateTime = (v: string | null) => (v ? dateTime.format(toDate(v)) : '–');
export const formatDate = (v: string | null) => (v ? dateOnly.format(toDate(v)) : '–');

const timeOnly = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
export const formatTime = (v: string) => timeOnly.format(toDate(v));

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
export const sameDay = (a: string, b: string) => dayKey(toDate(a)) === dayKey(toDate(b));
/** Messages within 5 minutes of each other count as one burst (Messenger-style grouping). */
export const closeInTime = (a: string, b: string) => Math.abs(toDate(a).getTime() - toDate(b).getTime()) < 5 * 60000;

/** "Today" / "Yesterday" / date — for day dividers in a conversation. */
export function dayLabel(v: string): string {
  const d = toDate(v);
  const now = new Date();
  if (dayKey(d) === dayKey(now)) return 'Today';
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (dayKey(d) === dayKey(yesterday)) return 'Yesterday';
  return dateOnly.format(d);
}

/** Right-hand time in a conversation list: time today, otherwise the day. */
export function listTime(v: string): string {
  const d = toDate(v);
  return dayKey(d) === dayKey(new Date()) ? timeOnly.format(d) : dayLabel(v) === 'Yesterday' ? 'Yesterday' : dateOnly.format(d);
}

/** "3 hours" — for queue age. */
export function age(v: string): string {
  const mins = Math.max(0, Math.round((Date.now() - toDate(v).getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  return `${Math.round(hours / 24)} days`;
}
