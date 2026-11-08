import type { Priority, Role, TicketStatus } from '../api/types';

export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'เปิดใหม่',
  in_progress: 'กำลังดำเนินการ',
  resolved: 'แก้ไขแล้ว',
  closed: 'ปิดแล้ว',
};
export const STATUS_ORDER: TicketStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

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
  reported: 'ส่งต่อฝ่ายซ่อมบำรุงแล้ว',
  assigned: 'ส่งต่อฝ่ายซ่อมบำรุงแล้ว',
  in_progress: 'ช่างกำลังดำเนินการ',
  completed: 'ซ่อมเสร็จแล้ว รอผู้ดูแลยืนยัน',
  closed: 'ซ่อมเสร็จแล้ว รอผู้ดูแลยืนยัน',
  cancelled: 'ฝ่ายซ่อมบำรุงยกเลิกใบงาน',
};
export const maintenanceLabel = (value: string | null) =>
  value ? MAINTENANCE_LABEL[value] ?? value : 'รอการตอบรับจากฝ่ายซ่อมบำรุง';
export const isRepairDone = (value: string | null) => value === 'completed' || value === 'closed';

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'ต่ำ',
  medium: 'ปกติ',
  high: 'สูง',
  urgent: 'ด่วนมาก',
};
export const PRIORITY_HINT: Record<Priority, string> = {
  low: 'รอได้หลายวัน',
  medium: 'ควรได้รับการแก้ไขภายในไม่กี่วัน',
  high: 'กระทบการเรียนหรือการทำงานวันนี้',
  urgent: 'ใช้งานไม่ได้เลย หรือมีความเสี่ยงด้านความปลอดภัย',
};

export const ROLE_LABEL: Record<Role, string> = {
  customer: 'ผู้แจ้ง',
  admin: 'ผู้ดูแลระบบ',
};

export const ROUTE_LABEL: Record<string, string> = {
  helpdesk: 'Helpdesk ดำเนินการเอง',
  maintenance: 'ส่งต่อฝ่ายซ่อมบำรุง',
  it_support: 'ฝ่ายไอที',
  wellbeing: 'แนะนำบริการ Wellbeing',
};

/** D1 returns 'YYYY-MM-DD HH:MM:SS' in UTC. */
function toDate(value: string): Date {
  return new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
}

const dateTime = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' });

export const formatDateTime = (v: string | null) => (v ? dateTime.format(toDate(v)) : '–');
export const formatDate = (v: string | null) => (v ? dateOnly.format(toDate(v)) : '–');

const timeOnly = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit' });
export const formatTime = (v: string) => timeOnly.format(toDate(v));

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
export const sameDay = (a: string, b: string) => dayKey(toDate(a)) === dayKey(toDate(b));
/** Messages within 5 minutes of each other count as one burst (Messenger-style grouping). */
export const closeInTime = (a: string, b: string) => Math.abs(toDate(a).getTime() - toDate(b).getTime()) < 5 * 60000;

/** "วันนี้" / "เมื่อวาน" / date — for day dividers in a conversation. */
export function dayLabel(v: string): string {
  const d = toDate(v);
  const now = new Date();
  if (dayKey(d) === dayKey(now)) return 'วันนี้';
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (dayKey(d) === dayKey(yesterday)) return 'เมื่อวาน';
  return dateOnly.format(d);
}

/** Right-hand time in a conversation list: time today, otherwise the day. */
export function listTime(v: string): string {
  const d = toDate(v);
  return dayKey(d) === dayKey(new Date()) ? timeOnly.format(d) : dayLabel(v) === 'เมื่อวาน' ? 'เมื่อวาน' : dateOnly.format(d);
}

/** "3 ชั่วโมงที่แล้ว" — for queue age. */
export function age(v: string): string {
  const mins = Math.max(0, Math.round((Date.now() - toDate(v).getTime()) / 60000));
  if (mins < 60) return `${mins} นาที`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} ชั่วโมง`;
  return `${Math.round(hours / 24)} วัน`;
}
