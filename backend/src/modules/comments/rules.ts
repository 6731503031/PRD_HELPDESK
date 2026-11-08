/**
 * Comment visibility rules — PURE (PRD FR-11, FR-12, BR-03).
 * Owner: P2 (Comments & Events)
 */
import type { Role } from '../../core/identity';

export type Visibility = 'public' | 'internal';

export type Comment = {
  id: number;
  ticket_id: number;
  author_id: number;
  content: string;
  visibility: Visibility;
  created_at: string;
};

export const VISIBILITIES: readonly Visibility[] = ['public', 'internal'];

const isStaffRole = (role: Role) => role === 'agent' || role === 'admin';

/**
 * F11/F12: who may post which visibility?
 *   customer → 'public' only ; agent / admin → 'public' or 'internal'
 */
export function canPost(role: Role, visibility: Visibility): boolean {
  if (!VISIBILITIES.includes(visibility)) return false;
  return visibility === 'public' || isStaffRole(role);
}

/**
 * F12 / BR-03: a requester must NEVER receive internal comments.
 *   customer → only visibility === 'public' ; agent / admin → all
 */
export function visibleTo<T extends Pick<Comment, 'visibility'>>(role: Role, comments: T[]): T[] {
  return isStaffRole(role) ? comments : comments.filter((c) => c.visibility === 'public');
}

/** Content checks: 1–2000 characters after trim. */
export function validateContent(content: unknown): string | null {
  const text = typeof content === 'string' ? content.trim() : '';
  if (!text) return 'กรุณาพิมพ์ข้อความ';
  if (text.length > 2000) return 'ข้อความยาวเกิน 2,000 ตัวอักษร';
  return null;
}
