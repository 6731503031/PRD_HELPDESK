import type { Priority, Role, TicketStatus } from '../api/types';

export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'เปิดใหม่',
  assigned: 'มอบหมายแล้ว',
  in_progress: 'กำลังดำเนินการ',
  resolved: 'แก้ไขแล้ว',
  closed: 'ปิดแล้ว',
};
export const STATUS_ORDER: TicketStatus[] = ['open', 'assigned', 'in_progress', 'resolved', 'closed'];

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
  agent: 'เจ้าหน้าที่',
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

/** "3 ชั่วโมงที่แล้ว" — for queue age. */
export function age(v: string): string {
  const mins = Math.max(0, Math.round((Date.now() - toDate(v).getTime()) / 60000));
  if (mins < 60) return `${mins} นาที`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} ชั่วโมง`;
  return `${Math.round(hours / 24)} วัน`;
}
