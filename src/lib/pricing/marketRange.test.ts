import { describe, it, expect } from 'vitest';
import { computeMarketRange } from './marketRange';

describe('computeMarketRange', () => {
  it('spans raw and every graded tier', () => {
    const range = computeMarketRange({
      raw: 6.19,
      psa: { '9': 20, '10': 80 },
      bgs: { '9.5': 45 },
      sgc: {},
      salesVolume: 'high',
    });
    expect(range).toMatchObject({ low: 6.19, high: 80, median: 32.5, salesVolume: 'high' });
  });

  it('ignores zero, null and missing tiers', () => {
    expect(computeMarketRange({ raw: 0, psa: { '10': null, '9': 12 }, bgs: {}, sgc: {} }))
      .toMatchObject({ low: 12, median: 12, high: 12 });
  });

  it('returns null when nothing is priced', () => {
    expect(computeMarketRange(null)).toBeNull();
    expect(computeMarketRange({ raw: null, psa: {}, bgs: {}, sgc: {} })).toBeNull();
  });
});
