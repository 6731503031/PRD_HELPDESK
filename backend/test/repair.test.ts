import { describe, expect, it } from 'vitest';
import { REPAIR_CATEGORIES as BACKEND } from '../src/modules/maintenance/envelope';
import { REPAIR_CATEGORIES as FRONTEND, guessRepairCategory, isRepairCategoryName } from '../../frontend/src/lib/repair';

describe('repair categories (frontend/src/lib/repair.ts)', () => {
  it('frontend list matches the backend list (Team 10 rejects anything else)', () => {
    expect([...FRONTEND]).toEqual([...BACKEND]);
  });

  it.each([
    ['Air conditioner in B-204 is leaking water', 'HVAC'],
    ['แอร์ไม่เย็น', 'HVAC'],
    ['Toilet leaking on floor 2', 'Plumbing'],
    ['น้ำรั่วในห้องน้ำ', 'Plumbing'],
    ['หลอดไฟห้อง C1 ดับ', 'Electrical'],
    ['Lights flickering in the hall', 'Electrical'],
    ['Smoke from the socket', 'Safety'],
    // whole words only: no false hits
    ['Firewall blocks the projector page', 'Electrical'],
    ['Please highlight the broken chair', 'Not sure'],
    ['เปิดไฟล์ไม่ได้', 'Not sure'],
    ['ไวไฟห้องเรียนช้า', 'Not sure'],
  ])('%s → %s', (text, expected) => {
    expect(guessRepairCategory(text)).toBe(expected);
  });

  it('Facility is the repair category, whatever the case/spaces', () => {
    expect(isRepairCategoryName(' Facility ')).toBe(true);
    expect(isRepairCategoryName('Network')).toBe(false);
    expect(isRepairCategoryName(null)).toBe(false);
  });
});
