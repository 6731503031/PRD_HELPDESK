/**
 * PRD §18 required test #4 Comment + recommended "Internal comment visibility"
 * Owner: P2
 */
import { describe, expect, it } from 'vitest';
import { canPost, validateContent, visibleTo, type Comment } from '../src/modules/comments/rules';

const comments: Comment[] = [
  { id: 1, ticket_id: 1, author_id: 1, content: 'Still broken', visibility: 'public', created_at: '' },
  { id: 2, ticket_id: 1, author_id: 3, content: 'Waiting on Maintenance', visibility: 'internal', created_at: '' },
];

describe('comment content', () => {
  it('rejects empty and over-long text', () => {
    expect(validateContent('   ')).not.toBeNull();
    expect(validateContent('x'.repeat(2001))).not.toBeNull();
    expect(validateContent('Thank you')).toBeNull();
  });
});

describe('#4 Comment (FR-11, FR-12, BR-03)', () => {
  it('lets requesters post public comments only', () => {
    expect(canPost('customer', 'public')).toBe(true);
    expect(canPost('customer', 'internal')).toBe(false);
  });
  it('lets agents post internal comments', () => {
    expect(canPost('agent', 'internal')).toBe(true);
  });
  it('never shows internal comments to a requester', () => {
    expect(visibleTo('customer', comments).map((c) => c.id)).toEqual([1]);
    expect(visibleTo('agent', comments).map((c) => c.id)).toEqual([1, 2]);
  });
});

describe('comment edge cases', () => {
  it('rejects unknown visibility values', () => {
    expect(canPost('agent', 'secret' as never)).toBe(false);
  });
  it('lets admins see and write internal notes too', () => {
    expect(canPost('admin', 'internal')).toBe(true);
    expect(visibleTo('admin', comments)).toHaveLength(2);
  });
});
