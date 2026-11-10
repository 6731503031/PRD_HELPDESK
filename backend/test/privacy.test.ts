import { describe, expect, it } from 'vitest';
import { checkAcceptance, consentStatus, PRIVACY_NOTICE_VERSION as BACKEND } from '../src/core/privacy';
import { PRIVACY_NOTICE, PRIVACY_NOTICE_VERSION as FRONTEND } from '../../frontend/src/lib/privacy';

describe('PDPA privacy notice', () => {
  it('frontend and backend agree on the notice version (bump both when the text changes)', () => {
    expect(FRONTEND).toBe(BACKEND);
  });

  it('Thai and English versions have the same sections (PDPA s.23 items in both languages)', () => {
    const ids = (l: 'th' | 'en') => PRIVACY_NOTICE[l].sections.map((s) => s.id);
    expect(ids('th')).toEqual(ids('en'));
    for (const id of ['controller', 'data', 'purpose', 'basis', 'sharing', 'retention', 'rights', 'decline']) {
      expect(ids('th')).toContain(id);
    }
  });
});

describe('checkAcceptance (consent must name the version the person read)', () => {
  it('accepts the current version', () => {
    expect(checkAcceptance(BACKEND)).toEqual({ ok: true });
  });

  it.each([undefined, null, '', false])('missing consent %s → rejected', (v) => {
    expect(checkAcceptance(v).ok).toBe(false);
  });

  it('true is not enough, and an old version is rejected', () => {
    expect(checkAcceptance(true).ok).toBe(false);
    expect(checkAcceptance('0.9', '1.0')).toEqual({ ok: false, message: expect.stringContaining('1.0') });
  });
});

describe('consentStatus (newest log row = current answer)', () => {
  const row = (action: 'accepted' | 'withdrawn', notice_version = '1.0') => ({ action, notice_version, created_at: '2026-11-10 08:00:00' });

  it('never answered → not accepted', () => {
    expect(consentStatus(null, '1.0')).toEqual({ notice_version: '1.0', accepted: false, accepted_at: null, last_action: null, last_action_at: null });
  });

  it('accepted the current version → accepted, with the time', () => {
    expect(consentStatus(row('accepted'), '1.0')).toMatchObject({ accepted: true, accepted_at: '2026-11-10 08:00:00' });
  });

  it('withdrawn → not accepted', () => {
    expect(consentStatus(row('withdrawn'), '1.0')).toMatchObject({ accepted: false, accepted_at: null, last_action: 'withdrawn' });
  });

  it('accepted an older version → must accept again', () => {
    expect(consentStatus(row('accepted', '1.0'), '1.1')).toMatchObject({ accepted: false, last_action: 'accepted', notice_version: '1.1' });
  });
});
