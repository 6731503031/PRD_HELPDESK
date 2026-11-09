/**
 * Work Order status → Helpdesk effect (Integration Proposal §6).
 * Owner: P3 (Maintenance Integration)
 *
 * LEFT side = Team 10's statuses — STILL TO BE CONFIRMED by Team 10.
 * RIGHT side = what we do to OUR ticket. We never auto-resolve:
 * a Helpdesk admin confirms and resolves (human in control).
 */
import type { TicketStatus } from '../tickets/rules';

export type MaintenanceEffect = {
  /** New Helpdesk ticket status, or null = leave status unchanged. */
  ticketStatus: TicketStatus | null;
  /** Thai label shown to the requester. */
  label: string;
};

/**
 * F14: what a Work Order status does to OUR ticket (names are Team 10's guess until they confirm — see the
 * "สถานะใบงาน" table in the Team 10 doc).
 *   reported / assigned  -> label only
 *   in_progress          -> ticket in_progress
 *   completed / closed   -> label only: "repair done, waiting for the admin" (never auto-resolve)
 *   cancelled            -> ticket back to in_progress so the admin looks at it again
 *   anything else        -> null  (the webhook answers 400)
 */
export function mapWorkOrderStatus(status: string): MaintenanceEffect | null {
  switch (status) {
    case 'reported':
    case 'assigned':
      return { ticketStatus: null, label: 'ส่งต่อฝ่ายซ่อมบำรุงแล้ว' };
    case 'in_progress':
      return { ticketStatus: 'in_progress', label: 'ช่างกำลังดำเนินการ' };
    case 'completed':
    case 'closed':
      return { ticketStatus: null, label: 'ซ่อมเสร็จแล้ว — รอผู้ดูแลยืนยัน' };
    case 'cancelled':
      return { ticketStatus: 'in_progress', label: 'ฝ่ายซ่อมบำรุงยกเลิกใบงาน' };
    default:
      return null;
  }
}

/**
 * The status the ticket actually moves to, or null = leave it alone.
 * Team 10 may start a ticket (open -> in_progress) but never touches a finished one, and never moves it backwards.
 */
export function nextTicketStatus(current: TicketStatus, effect: MaintenanceEffect): TicketStatus | null {
  if (!effect.ticketStatus) return null;
  if (current === 'resolved' || current === 'closed') return null;
  return current === effect.ticketStatus ? null : effect.ticketStatus;
}
