/**
 * PRD §18 required test #4 Comment (FR-11) — one conversation per ticket, requester <-> admin.
 * Owner: P2
 */
import { describe, expect, it } from 'vitest';
import { validateContent } from '../src/modules/comments/rules';
import { validateProfile } from '../src/core/profiles';
import { GUEST_ID_MIN, isGuestId, verify } from '../src/core/identity';
import { MESSAGES, SYSTEM_AUTHOR_ID, repairMessage } from '../src/modules/comments/templates';

describe('automatic chat messages (templates.ts)', () => {
  it('the system author is no real user or guest', () => {
    expect(verify(SYSTEM_AUTHOR_ID)).toBeNull();
    expect(isGuestId(SYSTEM_AUTHOR_ID)).toBe(false);
  });
  it('announces repair progress once per stage', () => {
    expect(repairMessage('reported', 'in_progress')).toBe(MESSAGES.repairStarted);
    expect(repairMessage('in_progress', 'in_progress')).toBeNull();
    expect(repairMessage('in_progress', 'completed')).toBe(MESSAGES.repairDone);
    expect(repairMessage('completed', 'closed')).toBeNull(); // both mean "done"
    expect(repairMessage('assigned', 'cancelled')).toBe(MESSAGES.repairCancelled);
  });
  it('stays quiet for reported / assigned (the "sent" message already said it)', () => {
    expect(repairMessage(null, 'reported')).toBeNull();
    expect(repairMessage('reported', 'assigned')).toBeNull();
  });
  it('the resolve message carries the summary when there is one', () => {
    expect(MESSAGES.resolved('Replaced the compressor')).toContain('Replaced the compressor');
    expect(MESSAGES.resolved(null)).toBe('Ticket resolved.');
  });
});

describe('#4 Comment (FR-11)', () => {
  it('rejects empty and whitespace-only text', () => {
    expect(validateContent('')).not.toBeNull();
    expect(validateContent('   ')).not.toBeNull();
    expect(validateContent(undefined)).not.toBeNull();
  });
  it('rejects text over 2,000 characters', () => {
    expect(validateContent('x'.repeat(2001))).not.toBeNull();
    expect(validateContent('x'.repeat(2000))).toBeNull();
  });
  it('accepts normal messages', () => {
    expect(validateContent('Thank you')).toBeNull();
    expect(validateContent('แอร์ยังไม่เย็นเลยค่ะ')).toBeNull();
  });
});

describe('guest sign-in profile (Identity stub, PRD §20)', () => {
  it('needs a name of 2-60 characters', () => {
    expect(validateProfile({ name: 'A' }).ok).toBe(false);
    expect(validateProfile({ name: 'x'.repeat(61) }).ok).toBe(false);
    expect(validateProfile({ name: 'สมชาย ใจดี' }).ok).toBe(true);
  });
  it('treats the contact email as optional but checks its shape', () => {
    const none = validateProfile({ name: 'Somchai', email: '' });
    expect(none.ok && none.value.email).toBeNull();
    expect(validateProfile({ name: 'Somchai', email: 'not-an-email' }).ok).toBe(false);
    const ok = validateProfile({ name: 'Somchai', email: ' s@uni.ac.th ' });
    expect(ok.ok && ok.value.email).toBe('s@uni.ac.th');
  });
  it('keeps guest ids apart from the static directory, and guests are never in it', () => {
    expect(isGuestId(GUEST_ID_MIN)).toBe(true);
    expect(isGuestId(999)).toBe(false);
    expect(verify(GUEST_ID_MIN)).toBeNull();
  });
});
