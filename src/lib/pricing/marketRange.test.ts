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

  it('names the tier behind the low and the high', () => {
    const range = computeMarketRange({
      raw: 6.19,
      psa: { '9': 20, '10': 80 },
      bgs: { '9.5': 45 },
      sgc: {},
    });
    expect(range).toMatchObject({ lowLabel: 'Raw', highLabel: 'PSA 10' });
  });

  it('names BGS / SGC / CGC ends too, and a graded low when there is no raw price', () => {
    const range = computeMarketRange({
      raw: null,
      psa: { '8': 30 },
      bgs: { '9.5': 12 },
      sgc: {},
      cgc: { '10': 500 },
    });
    expect(range).toMatchObject({ low: 12, lowLabel: 'BGS 9.5', high: 500, highLabel: 'CGC 10' });
  });

  it('labels a single-quote range at both ends', () => {
    expect(computeMarketRange({ raw: 4, psa: {}, bgs: {}, sgc: {} }))
      .toMatchObject({ low: 4, high: 4, lowLabel: 'Raw', highLabel: 'Raw' });
  });

  it('returns null when nothing is priced', () => {
    expect(computeMarketRange(null)).toBeNull();
    expect(computeMarketRange({ raw: null, psa: {}, bgs: {}, sgc: {} })).toBeNull();
  });
});
