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
 *   submitted / reported / assigned  -> label only
 *   in_progress          -> ticket in_progress
 *   resolved             -> label only (Team 10's board shows Resolved before Closed; never auto-resolve)
 *   completed / closed   -> label only: "repair done, waiting for the admin" (never auto-resolve)
 *   cancelled            -> ticket back to in_progress so the admin looks at it again
 *   anything else        -> null  (the webhook answers 400)
 */
export function mapWorkOrderStatus(status: string): MaintenanceEffect | null {
  switch (status) {
    // One label per status, so the history never shows the same line twice for two different steps.
    case 'submitted':
    case 'reported':
      return { ticketStatus: null, label: 'Maintenance received the work order' };
    case 'assigned':
      return { ticketStatus: null, label: 'Maintenance assigned a technician' };
    case 'in_progress':
      return { ticketStatus: 'in_progress', label: 'Technician working on it' };
    case 'resolved':
      return { ticketStatus: null, label: 'Repair resolved by Maintenance, awaiting admin confirmation' };
    case 'completed':
      return { ticketStatus: null, label: 'Repair done, awaiting admin confirmation' };
    case 'closed':
      return { ticketStatus: null, label: 'Work order closed by Maintenance' };
    case 'cancelled':
      return { ticketStatus: 'in_progress', label: 'Work order cancelled by Maintenance' };
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

/** How far a work order has got. Equal ranks are the same stage under two names. */
const PROGRESS: Record<string, number> = { submitted: 1, reported: 1, assigned: 2, in_progress: 3, resolved: 4, completed: 4, closed: 5 };

/**
 * Sync (we ask Team 10): should the status we just read be applied? Only real forward progress, so a poll never
 * repeats a history line or moves the repair backwards. Cancelled always counts once; a cancelled work order is
 * never revived by a poll (the admin links a new one instead).
 */
export function shouldApplyPolledStatus(current: string | null, remote: string): boolean {
  if (!mapWorkOrderStatus(remote) || current === remote) return false;
  if (remote === 'cancelled') return true;
  if (current === 'cancelled') return false;
  return (PROGRESS[remote] ?? 0) > (PROGRESS[current ?? ''] ?? 0);
}
