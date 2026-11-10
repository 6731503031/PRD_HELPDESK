/**
 * Which Wellbeing service to suggest for a ticket — PURE (AI-MIGRATION-BRIEF §7, §8).
 * Owner: P3 (Integrations)
 *
 * Checked in this order, first match wins:
 *   1. danger words   → show the emergency numbers (1669, 1323); no appointment is suggested
 *   2. study words    → srv_academic_stress
 *   3. "soon" words   → srv_urgent_drop_in
 *   4. general words  → srv_general_counselling (we added worried / worry / worries to the brief's list)
 *   5. otherwise      → nothing. Illness / injury / physical health are NOT Wellbeing's any more.
 * English words match whole words; Thai has no spaces between words, so Thai words match as plain text.
 * The suggested id must still be in the live catalogue before it is shown (routes.ts).
 */

export const EMERGENCY_NUMBERS = [
  { number: '1669', label: 'Emergency medical services, 24 hours' },
  { number: '1323', label: 'Mental health hotline (Department of Mental Health), 24 hours' },
] as const;

export const WELLBEING_SITE_URL = 'https://wellbeing-intake.vercel.app';
export const WELLBEING_EMERGENCY_URL = 'https://wellbeing-intake.vercel.app/emergency';

const DANGER = ['suicide', 'suicidal', 'kill myself', 'want to die', 'hurt myself', 'harm myself', 'self-harm', 'not safe', 'ฆ่าตัวตาย', 'อยากตาย', 'ทำร้ายตัวเอง'];

const RULES: { id: string; words: string[] }[] = [
  {
    id: 'srv_academic_stress',
    words: ['exam', 'exams', 'test', 'tests', 'assignment', 'assignments', 'homework', 'deadline', 'deadlines', 'grade', 'grades', 'gpa', 'thesis', 'class', 'lecture', 'semester', 'study', 'สอบ', 'เรียน', 'การบ้าน', 'เกรด'],
  },
  { id: 'srv_urgent_drop_in', words: ['asap', 'as soon as possible', 'right away', "can't wait", 'cannot wait', 'someone today'] },
  {
    id: 'srv_general_counselling',
    words: ['stress', 'stressed', 'worried', 'worry', 'worries', 'anxious', 'anxiety', 'sad', 'low mood', 'lonely', 'relationship', 'break up', 'breakup', 'family', 'grief', 'sleep', 'money', 'homesick', 'overwhelmed', 'เครียด', 'เศร้า', 'เหงา', 'ครอบครัว', 'แฟน', 'นอนไม่หลับ', 'กังวล'],
  },
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isAscii = (s: string) => /^[\x20-\x7e]+$/.test(s);

function mentions(text: string, word: string): boolean {
  if (!isAscii(word)) return text.includes(word);
  return new RegExp(`(^|[^a-z0-9])${escapeRe(word.toLowerCase())}($|[^a-z0-9])`, 'i').test(text);
}

/**
 * Only a Wellbeing ticket gets a service suggestion: the Wellbeing category, an AI route of 'wellbeing', or a service
 * the admin chose. Study words ("lecture", "class") also appear in repair and IT tickets, so other tickets get none.
 * The danger check is NOT limited by this: it runs on every ticket.
 */
export function isWellbeingTicket(t: { category_name?: string | null; ai_route?: string | null; wellbeing_service_id?: string | null }): boolean {
  return (t.category_name ?? '').trim().toLowerCase() === 'wellbeing' || t.ai_route === 'wellbeing' || !!t.wellbeing_service_id;
}

export type WellbeingRoute = { danger: true; serviceId: null } | { danger: false; serviceId: string | null };

export function routeWellbeing(text: string): WellbeingRoute {
  const t = text.toLowerCase().replace(/[’‘]/g, "'");
  if (DANGER.some((w) => mentions(t, w))) return { danger: true, serviceId: null };
  const rule = RULES.find((r) => r.words.some((w) => mentions(t, w)));
  return { danger: false, serviceId: rule?.id ?? null };
}
