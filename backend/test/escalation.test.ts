/**
 * PRD §18 required test #7 Escalation event (BR-07)
 * Owner: P2 — remove .skip when isEscalationDue is implemented.
 */
import { describe, expect, it } from 'vitest';
import { isEscalationDue } from '../src/modules/events/escalation';
import { buildEnvelope } from '../src/modules/events/publish';

const now = new Date('2026-11-20T12:00:00Z');
const base = {
  priority: 'urgent' as const,
  status: 'open' as const,
  created_at: '2026-11-20 10:30:00', // 90 minutes ago (UTC)
  escalated_at: null,
};

describe('event envelope (platform PRD §4)', () => {
  it('uses the shared envelope and leaks no personal text', () => {
    const e = buildEnvelope('ticket.created', {
      id: 12, ticket_number: 'TKT-00012', status: 'open', priority: 'high', category_id: 5, customer_id: 1,
    });
    expect(e).toMatchObject({ type: 'ticket.created', source: 'helpdesk', subject: 'ticket:TKT-00012' });
    expect(e.eventId).toMatch(/[0-9a-f-]{36}/);
    expect(JSON.stringify(e)).not.toMatch(/description|email/);
  });
});

describe.skip('#7 Escalation rule (PRD §14) — TODO P2', () => {
  it('escalates urgent tickets still open (not started) waiting over 1 hour', () => {
    expect(isEscalationDue(base, now)).toBe(true);
  });
  it('does not escalate before 1 hour', () => {
    expect(isEscalationDue({ ...base, created_at: '2026-11-20 11:30:00' }, now)).toBe(false);
  });
  it('does not escalate started, non-urgent, or already-escalated tickets', () => {
    expect(isEscalationDue({ ...base, status: 'in_progress' as const }, now)).toBe(false);
    expect(isEscalationDue({ ...base, priority: 'high' }, now)).toBe(false);
    expect(isEscalationDue({ ...base, escalated_at: '2026-11-20 11:31:00' }, now)).toBe(false);
  });
});
