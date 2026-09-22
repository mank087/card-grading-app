import { describe, it, expect } from 'vitest';
import { buildValuation, formatStoredDate, formatStoredFreshness } from './valuation';

const NOW = Date.parse('2026-09-21T12:00:00.000Z');
const THREE_DAYS_AGO = '2026-09-18T12:00:00.000Z';

const stored = {
  status: 'priced',
  amount: 1200,
  source: 'dcm-estimate' as const,
  updatedAt: THREE_DAYS_AGO,
};

describe('buildValuation', () => {
  it('a recent live lookup beats an old stored value, and never inherits the stored timestamp', () => {
    const v = buildValuation(stored, { amount: 1658.62, isCached: false }, NOW);
    expect(v).toMatchObject({
      amount: 1658.62,
      sourceLabel: 'DCM estimate (live lookup)',
      freshnessLabel: null,
      basis: 'live',
    });
    // The stored row's 3-day-old timestamp must not follow the live number, and
    // a completed fetch is not evidence of fresh prices, so nothing is printed.
    expect(v.freshnessLabel).toBeNull();
  });

  it('a cached live result says it is cached and gives its age', () => {
    expect(buildValuation(stored, { amount: 900, isCached: true, cacheAgeDays: 3 }, NOW))
      .toMatchObject({
        amount: 900,
        freshnessLabel: 'Cached · updated 3 days ago',
        basis: 'live-cached',
      });
  });

  it('a cached live result less than a day old says today, not "just now"', () => {
    expect(buildValuation(stored, { amount: 900, isCached: true, cacheAgeDays: 0.2 }, NOW)
      .freshnessLabel).toBe('Cached · updated today');
  });

  it('a cached live result with no known age still says it is cached', () => {
    expect(buildValuation(stored, { amount: 900, isCached: true, cacheAgeDays: null }, NOW)
      .freshnessLabel).toBe('Cached price');
  });

  it('an unavailable lookup falls back to the stored value and the stored timestamp', () => {
    expect(buildValuation(stored, null, NOW)).toMatchObject({
      amount: 1200,
      sourceLabel: 'DCM estimate',
      freshnessLabel: 'Updated 3 days ago',
      basis: 'stored',
    });
    // A lookup that reported no trusted number is the same case.
    expect(buildValuation(stored, { amount: null }, NOW).basis).toBe('stored');
  });

  it('an unstamped stored row prints no freshness at all', () => {
    expect(buildValuation({ ...stored, updatedAt: null }, null, NOW).freshnessLabel).toBeNull();
  });

  it('a withheld value with no live replacement is flagged withheld', () => {
    const v = buildValuation(
      { status: 'withheld', amount: null, source: 'withheld', updatedAt: THREE_DAYS_AGO },
      null,
      NOW,
    );
    expect(v.isWithheld).toBe(true);
    expect(v.amount).toBeNull();
    expect(v.freshnessLabel).toBeNull();
  });

  it('a trusted live number clears a withheld stored value', () => {
    const v = buildValuation(
      { status: 'withheld', amount: null, source: 'withheld', updatedAt: null },
      { amount: 42, isCached: false },
      NOW,
    );
    expect(v.isWithheld).toBe(false);
    expect(v.amount).toBe(42);
  });

  it('no price anywhere says so instead of naming a source', () => {
    expect(
      buildValuation({ status: 'unpriced', amount: null, source: 'none', updatedAt: null }, null, NOW)
        .sourceLabel,
    ).toBe('No price source for this card yet');
  });
});

describe('formatStoredFreshness', () => {
  it('reads minutes, hours and days', () => {
    expect(formatStoredFreshness('2026-09-21T11:30:00.000Z', NOW)).toBe('Updated 30 minutes ago');
    expect(formatStoredFreshness('2026-09-21T09:00:00.000Z', NOW)).toBe('Updated 3 hours ago');
    expect(formatStoredFreshness(THREE_DAYS_AGO, NOW)).toBe('Updated 3 days ago');
  });

  it('returns null for unparseable and future timestamps', () => {
    expect(formatStoredFreshness('not a date', NOW)).toBeNull();
    expect(formatStoredFreshness('2026-09-22T12:00:00.000Z', NOW)).toBeNull();
  });
});

/**
 * ONE status line for the hero (review 2026-09-22, polish). The panel used to
 * print "DCM estimate (live lookup) · Cached · updated 4 days ago" — three
 * statuses for one number, two of which disagree.
 */
describe('statusLabel — the single line the hero prints', () => {
  it('says the prices are fresh when the lookup actually fetched', () => {
    expect(buildValuation(stored, { amount: 1658.62, isCached: false }, NOW).statusLabel).toBe(
      'DCM estimate · fresh prices',
    );
  });

  it('says cached, once, with the age', () => {
    expect(
      buildValuation(stored, { amount: 900, isCached: true, cacheAgeDays: 4 }, NOW).statusLabel,
    ).toBe('DCM estimate · from cached prices, 4 days old');
    expect(
      buildValuation(stored, { amount: 900, isCached: true, cacheAgeDays: 1 }, NOW).statusLabel,
    ).toBe('DCM estimate · from cached prices, 1 day old');
    expect(
      buildValuation(stored, { amount: 900, isCached: true, cacheAgeDays: 0.2 }, NOW).statusLabel,
    ).toBe('DCM estimate · from cached prices, updated today');
    expect(
      buildValuation(stored, { amount: 900, isCached: true }, NOW).statusLabel,
    ).toBe('DCM estimate · from cached prices');
  });

  it('gives the stored value an actual date, not a relative age', () => {
    expect(buildValuation(stored, null, NOW).statusLabel).toBe(
      'DCM estimate · stored value, updated Sep 18, 2026',
    );
  });

  it('prints no freshness at all when the row was never stamped', () => {
    expect(buildValuation({ ...stored, updatedAt: null }, null, NOW).statusLabel).toBe(
      'DCM estimate',
    );
  });

  it('never invents a source for a card with no price', () => {
    expect(
      buildValuation({ ...stored, amount: null, source: 'none' }, null, NOW).statusLabel,
    ).toBe('No price source for this card yet');
  });

  it('never prints the word "live lookup" beside a cached price', () => {
    const v = buildValuation(stored, { amount: 900, isCached: true, cacheAgeDays: 4 }, NOW);
    expect(v.statusLabel).not.toContain('live lookup');
  });
});

describe('formatStoredDate', () => {
  it('writes the month out and is independent of the runtime locale data', () => {
    expect(formatStoredDate('2026-09-18T12:00:00.000Z')).toBe('Sep 18, 2026');
    expect(formatStoredDate('2026-01-01T00:00:00.000Z')).toBe('Jan 1, 2026');
  });

  it('is null for anything unparseable', () => {
    expect(formatStoredDate('not a date')).toBeNull();
  });
});
