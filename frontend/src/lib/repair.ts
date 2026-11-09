/**
 * Team 10 work order categories + a first guess from the ticket text (the admin can always change it).
 * Must match the backend list (backend/src/modules/maintenance/envelope.ts REPAIR_CATEGORIES).
 */
export const REPAIR_CATEGORIES = ['Plumbing', 'Electrical', 'HVAC', 'Safety', 'Not sure'] as const;
export type RepairCategory = (typeof REPAIR_CATEGORIES)[number];

export const REPAIR_CATEGORY_LABEL: Record<RepairCategory, string> = {
  Plumbing: 'Plumbing (water, leaks, toilets)',
  Electrical: 'Electrical (power, sockets, lights)',
  HVAC: 'HVAC (air conditioning, ventilation)',
  Safety: 'Safety',
  'Not sure': 'Not sure',
};

/** Checked in this order: the first group with a matching word wins. Thai words are matched as plain text. */
const HINTS: { category: RepairCategory; words: string[] }[] = [
  { category: 'Safety', words: ['fire', 'smoke', 'gas', 'spark', 'shock', 'danger', 'ไฟไหม้', 'ควัน', 'แก๊ส', 'ไฟช็อต', 'ไฟดูด', 'อันตราย', 'สะเก็ดไฟ'] },
  { category: 'HVAC', words: ['air conditioner', 'aircon', 'air con', 'a/c', 'hvac', 'ventilation', 'แอร์', 'เครื่องปรับอากาศ', 'พัดลม', 'ระบายอากาศ'] },
  { category: 'Plumbing', words: ['leak', 'water', 'toilet', 'pipe', 'sink', 'drain', 'tap', 'รั่ว', 'น้ำ', 'ห้องน้ำ', 'ท่อ', 'ก๊อก', 'ชักโครก', 'อ่างล้างมือ'] },
  { category: 'Electrical', words: ['light', 'lamp', 'socket', 'power', 'plug', 'electric', 'switch', 'projector', 'ไฟ', 'หลอด', 'ปลั๊ก', 'สวิตช์', 'ไฟฟ้า', 'โปรเจคเตอร์', 'โปรเจกเตอร์'] },
];

/** Thai words that contain "ไฟ" but have nothing to do with electricity (file, Wi-Fi). */
const NOT_ELECTRICAL = /ไฟล์|ไวไฟ/g;

/** English: whole word (plus s/es/ed/ing), so "fire" ≠ "firewall", "light" ≠ "highlight". Thai: plain text. */
function hasWord(text: string, word: string): boolean {
  if (!/^[\x00-\x7F]+$/.test(word)) return text.includes(word);
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}(s|es|ed|ing)?\\b`).test(text);
}

export function guessRepairCategory(text: string): RepairCategory {
  const t = text.toLowerCase().replace(NOT_ELECTRICAL, ' ');
  return HINTS.find((h) => h.words.some((w) => hasWord(t, w)))?.category ?? 'Not sure';
}

/** Only the Facility category is a repair that goes to Team 10. One place, so a rename is a one-line fix. */
export const REPAIR_HELPDESK_CATEGORY = 'facility';
export const isRepairCategoryName = (name: string | null | undefined) =>
  (name ?? '').trim().toLowerCase() === REPAIR_HELPDESK_CATEGORY;
