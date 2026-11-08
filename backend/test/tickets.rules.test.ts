/**
 * PRD §18 required tests #1 Create, #2 Ownership, #3 Assignment, #5 Resolve
 * Owner: P1
 */
import { describe, expect, it } from 'vitest';
import {
  canAssign,
  canResolve,
  canTransition,
  canViewTicket,
  editableFields,
  ticketNumber,
  validateCreate,
} from '../src/modules/tickets/rules';

const alice = { id: 1, role: 'customer' as const, displayName: 'Alice' };
const bob = { id: 2, role: 'customer' as const, displayName: 'Bob' };
const agent = { id: 3, role: 'agent' as const, displayName: 'Somchai' };

describe('#1 Create ticket (FR-03)', () => {
  it('accepts subject, description, category and urgency', () => {
    const r = validateCreate({ subject: 'Wi-Fi down in library', description: 'Cannot connect since 9am', category_id: 1, urgency: 'high' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ title: 'Wi-Fi down in library', priority: 'high', category_id: 1 });
  });

  it('rejects missing fields with a message per field', () => {
    const r = validateCreate({ subject: 'Hi', description: '', category_id: 0, urgency: 'whenever' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['category_id', 'description', 'subject', 'urgency']);
  });

  it('generates a unique, human-readable ticket number from the id', () => {
    expect(ticketNumber(12)).toBe('TKT-00012');
    expect(ticketNumber(5)).not.toBe(ticketNumber(6));
  });
});

describe('#2 Ownership / access control (FR-07, BR-01, BR-02)', () => {
  it("lets a requester see only their own ticket", () => {
    expect(canViewTicket(alice, { customer_id: 1 })).toBe(true);
    expect(canViewTicket(bob, { customer_id: 1 })).toBe(false);
  });

  it('lets agents see every ticket', () => {
    expect(canViewTicket(agent, { customer_id: 1 })).toBe(true);
  });

  it('stops requesters from changing status, priority or assignee', () => {
    const fields = editableFields('customer');
    expect(fields).toEqual(['title', 'description']);
    expect(fields).not.toContain('status');
    expect(editableFields('agent')).toEqual(expect.arrayContaining(['status', 'priority', 'assigned_agent_id']));
  });
});

describe('#3 Assignment (FR-09)', () => {
  it('allows agents to assign an open ticket', () => {
    expect(canAssign(agent, { status: 'open' }).ok).toBe(true);
  });
  it('blocks requesters and closed tickets', () => {
    expect(canAssign(alice, { status: 'open' }).ok).toBe(false);
    expect(canAssign(agent, { status: 'resolved' }).ok).toBe(false);
  });
});

describe('#5 Resolve (FR-13)', () => {
  it('allows agents to resolve an in-progress ticket', () => {
    expect(canResolve(agent, { status: 'in_progress' }).ok).toBe(true);
  });
  it('blocks requesters and double-resolve', () => {
    expect(canResolve(alice, { status: 'in_progress' }).ok).toBe(false);
    expect(canResolve(agent, { status: 'resolved' }).ok).toBe(false);
  });
});

// TODO(P1, F25): remove .skip after implementing canTransition()
describe.skip('Lifecycle (PRD §14)', () => {
  it('follows Open → Assigned → InProgress → Resolved → Closed', () => {
    expect(canTransition('open', 'assigned')).toBe(true);
    expect(canTransition('assigned', 'in_progress')).toBe(true);
    expect(canTransition('in_progress', 'resolved')).toBe(true);
    expect(canTransition('resolved', 'closed')).toBe(true);
  });
  it('never reopens a closed ticket', () => {
    expect(canTransition('closed', 'open')).toBe(false);
    expect(canTransition('closed', 'in_progress')).toBe(false);
  });
});
