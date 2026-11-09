import { describe, expect, it } from 'vitest';
import { portalUrl } from '../src/core/config';

describe('Team 10 portal link', () => {
  it('accepts http(s) links, with or without the {ticketRef} placeholder', () => {
    expect(portalUrl('https://maintenance.example/report')).toBe('https://maintenance.example/report');
    expect(portalUrl('  http://t10.local/new?ref={ticketRef} ')).toBe('http://t10.local/new?ref={ticketRef}');
  });
  it('treats empty, missing and non-http values as "not given yet"', () => {
    expect(portalUrl('')).toBeNull();
    expect(portalUrl(undefined)).toBeNull();
    expect(portalUrl('javascript:alert(1)')).toBeNull();
    expect(portalUrl('maintenance.example')).toBeNull();
    expect(portalUrl('https://a b')).toBeNull();
  });
});
