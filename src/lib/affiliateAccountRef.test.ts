import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: {} }));
vi.mock('@/lib/affiliates', () => ({ getAffiliateByCode: vi.fn() }));
vi.mock('@/lib/credits', () => ({ isFirstPurchase: vi.fn() }));

import { accountRefCode, normalizeRefCode } from './affiliateAccountRef';

const NOW = Date.parse('2026-10-22T20:30:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86400000).toISOString();

describe('accountRefCode', () => {
  it('uses the server-bound code inside 30 days of binding', () => {
    expect(accountRefCode({ app_metadata: { referral: { code: 'williej', at: daysAgo(3) } } }, NOW)).toBe('WILLIEJ');
    expect(accountRefCode({ app_metadata: { referral: { code: 'WILLIEJ', at: daysAgo(31) } } }, NOW)).toBeNull();
  });

  it('falls back to the sign-up code inside 30 days of account creation', () => {
    expect(accountRefCode({ created_at: daysAgo(1), user_metadata: { ref_code: 'WILLIEJ' } }, NOW)).toBe('WILLIEJ');
    expect(accountRefCode({ created_at: daysAgo(40), user_metadata: { ref_code: 'WILLIEJ' } }, NOW)).toBeNull();
  });

  it('prefers the bound code over the sign-up code', () => {
    expect(accountRefCode({ created_at: daysAgo(1), user_metadata: { ref_code: 'OTHER' }, app_metadata: { referral: { code: 'WILLIEJ', at: daysAgo(1) } } }, NOW)).toBe('WILLIEJ');
  });

  it('returns null for no user, no code, or a malformed code', () => {
    expect(accountRefCode(null, NOW)).toBeNull();
    expect(accountRefCode({ created_at: daysAgo(1), user_metadata: {} }, NOW)).toBeNull();
    expect(accountRefCode({ created_at: daysAgo(1), user_metadata: { ref_code: 'not a code!' } }, NOW)).toBeNull();
  });
});

describe('normalizeRefCode', () => {
  it('upper-cases and validates', () => {
    expect(normalizeRefCode(' williej ')).toBe('WILLIEJ');
    expect(normalizeRefCode('a')).toBeNull();
    expect(normalizeRefCode(null)).toBeNull();
  });
});
