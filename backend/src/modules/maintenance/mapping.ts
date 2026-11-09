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
 * TODO(P3, F14): fill in after Team 10 confirms their status list.
 *   reported / assigned  → { ticketStatus: null,          label: 'ส่งต่อฝ่ายซ่อมบำรุงแล้ว' }
 *   in_progress          → { ticketStatus: 'in_progress', label: 'ช่างกำลังดำเนินการ' }
 *   completed / closed   → { ticketStatus: null,          label: 'ซ่อมเสร็จแล้ว — รอผู้ดูแลยืนยัน' }
 *   cancelled            → { ticketStatus: 'in_progress', label: 'ฝ่ายซ่อมบำรุงยกเลิกใบงาน' }
 *   anything else        → null  (webhook answers 400)
 */
export function mapWorkOrderStatus(status: string): MaintenanceEffect | null {
  void status;
  return null; // TODO(P3, F14)
}
