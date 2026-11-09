/**
 * PRD §18 required tests #1 Create, #2 Ownership, #3 Admin-only triage, #5 Resolve
 * Owner: P1
 */
import { describe, expect, it } from 'vitest';
import {
  canResolve,
  canTransition,
  canViewTicket,
  editableFields,
  ticketNumber,
  validateCreate, checkLocation } from '../src/modules/tickets/rules';

const alice = { id: 1, role: 'customer' as const, displayName: 'Alice' };
const bob = { id: 2, role: 'customer' as const, displayName: 'Bob' };
const admin = { id: 5, role: 'admin' as const, displayName: 'Admin' };

describe('#1 Create ticket (FR-03)', () => {
  it('accepts subject, description, location, category and urgency', () => {
    const r = validateCreate({ subject: 'Wi-Fi down in library', description: 'Cannot connect since 9am', location: ' Main library, 2nd floor ', category_id: 1, urgency: 'high' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ title: 'Wi-Fi down in library', location: 'Main library, 2nd floor', priority: 'high', category_id: 1 });
  });

  it('rejects missing fields with a message per field', () => {
    const r = validateCreate({ subject: 'Hi', description: '', category_id: 0, urgency: 'whenever' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['category_id', 'description', 'location', 'subject', 'urgency']);
  });

  it('needs a location for every category, up to 200 characters', () => {
    const base = { subject: 'Account locked today', description: 'My password is correct but locked', category_id: 4, urgency: 'urgent' };
    expect(validateCreate(base).ok).toBe(false);
    expect(validateCreate({ ...base, location: ' ' }).ok).toBe(false);
    expect(validateCreate({ ...base, location: 'x'.repeat(201) }).ok).toBe(false);
    expect(validateCreate({ ...base, location: 'Online' }).ok).toBe(true);
    expect(checkLocation('B-204')).toBeNull();
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

  it('lets the admin see every ticket', () => {
    expect(canViewTicket(admin, { customer_id: 1 })).toBe(true);
  });

  it('stops requesters from changing status or priority', () => {
    const fields = editableFields('customer');
    expect(fields).toEqual(['title', 'description', 'location']);
    expect(fields).not.toContain('status');
  });
});

describe('#3 Admin-only triage (FR-10, BR-02)', () => {
  it('lets the admin change status, priority and category', () => {
    expect(editableFields('admin')).toEqual(expect.arrayContaining(['status', 'priority', 'category_id']));
  });
  it('has no assignee field any more (no agent role)', () => {
    expect(editableFields('admin')).not.toContain('assigned_agent_id');
  });
});

describe('#5 Resolve (FR-13)', () => {
  it('allows the admin to resolve an in-progress ticket', () => {
    expect(canResolve(admin, { status: 'in_progress' }).ok).toBe(true);
  });
  it('blocks requesters and double-resolve', () => {
    expect(canResolve(alice, { status: 'in_progress' }).ok).toBe(false);
    expect(canResolve(admin, { status: 'resolved' }).ok).toBe(false);
  });
});

// TODO(P1, F25): remove .skip after implementing canTransition()
describe.skip('Lifecycle (PRD §14)', () => {
  it('follows Open → InProgress → Resolved → Closed', () => {
    expect(canTransition('open', 'in_progress')).toBe(true);
    expect(canTransition('in_progress', 'resolved')).toBe(true);
    expect(canTransition('resolved', 'closed')).toBe(true);
  });
  it('never reopens a closed ticket', () => {
    expect(canTransition('closed', 'open')).toBe(false);
    expect(canTransition('closed', 'in_progress')).toBe(false);
  });
});
