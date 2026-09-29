import { describe, it, expect } from 'vitest';
import { estimateGradedValue, type GradedPriceTable } from './gradedValueEstimate';
import { estimateMTGDcmValue } from '../mtgPricing';
import { estimatePokemonDcmValue } from '../pokemonPricing';
import { estimateLorcanaDcmValue } from '../lorcanaPricing';
import { estimateOnePieceDcmValue } from '../onepiecePricing';
import { estimateOtherDcmValue } from '../otherPricing';
import { estimateDcmValue as estimateSportsDcmValue } from './dcmEstimate';

function table(p: GradedPriceTable): any {
  return {
    raw: p.raw ?? null,
    psa: p.psa ?? {},
    bgs: p.bgs ?? {},
    sgc: p.sgc ?? {},
    cgc: p.cgc ?? {},
    estimatedDcm: null,
    productId: 'test',
    productName: 'test',
    setName: 'test',
    lastUpdated: '2026-09-28T00:00:00Z',
    salesVolume: null,
  };
}

// Sept 28 customer report: Mana Vault, Ultimate Box Topper U29 (product 2201998).
const BOX_TOPPER = table({ raw: 273.89, psa: { '9.5': 299, '10': 354.44 }, bgs: { '9.5': 299, '10': 461 }, cgc: { '10': 213 }, sgc: { '10': 213 } });
// Same customer: Ultimate Masters #229 non-foil, PSA comps all BELOW raw.
const UMA_229 = table({ raw: 114.91, psa: { '9': 73, '9.5': 83, '10': 85 }, bgs: { '9': 73, '9.5': 83 }, sgc: { '9': 73 }, cgc: { '9': 73 } });

const ESTIMATORS: Array<[string, (prices: any, grade: number) => number | null]> = [
  ['mtg', estimateMTGDcmValue],
  ['pokemon', estimatePokemonDcmValue],
  ['lorcana', estimateLorcanaDcmValue],
  ['onepiece', estimateOnePieceDcmValue],
  ['other', estimateOtherDcmValue],
];

const FIXTURES: Array<[string, any]> = [
  ['box topper', BOX_TOPPER],
  ['UMA #229 (comps below raw)', UMA_229],
  ['full ladder', table({ raw: 10, psa: { '7': 14, '8': 18, '9': 30, '9.5': 45, '10': 90 } })],
  ['only PSA 7', table({ raw: 10, psa: { '7': 25 } })],
  ['only BGS 10', table({ raw: 50, bgs: { '10': 400 } })],
  ['raw only', table({ raw: 12 })],
  ['no raw', table({ psa: { '8': 20, '10': 100 } })],
  ['inverted comps', table({ raw: 20, psa: { '8': 60, '9': 40, '10': 50 } })],
];

describe('estimateMTGDcmValue — customer cases', () => {
  it('box topper grade 8 with no PSA 8 is at or below raw (was raw × 3 = $821.67)', () => {
    const v = estimateMTGDcmValue(BOX_TOPPER, 8)!;
    expect(v).toBeLessThanOrEqual(273.89);
    // PSA comps above (299, 354.44) do not cap it; a lone CGC/SGC 10 at 213 is not a ceiling.
    expect(v).toBe(273.89);
  });

  it('box topper grade 10 keeps the comp formula (≈ $330.28)', () => {
    expect(estimateMTGDcmValue(BOX_TOPPER, 10)).toBeCloseTo(330.28, 2);
  });

  it('UMA #229 grade 10 is never below raw when PSA 10 sells under raw', () => {
    expect(estimateMTGDcmValue(UMA_229, 10)!).toBeGreaterThanOrEqual(114.91);
    expect(estimateMTGDcmValue(UMA_229, 9)!).toBeGreaterThanOrEqual(114.91);
  });
});

describe('estimateGradedValue', () => {
  it('keeps raw × 3 only for grade >= 9 when there are no graded prices at all', () => {
    const raw = table({ raw: 12 });
    expect(estimateGradedValue(raw, 10)!.value).toBe(36);
    expect(estimateGradedValue(raw, 9)!.method).toBe('raw-multiple');
    expect(estimateGradedValue(raw, 8)!.value).toBeLessThanOrEqual(12);
  });

  it('grade >= 9 with no matching comp uses the nearest known comp, never above the highest', () => {
    const e = estimateGradedValue(table({ raw: 50, bgs: { '10': 400 } }), 10)!;
    expect(e.method).toBe('nearest-comp');
    expect(e.value).toBeLessThanOrEqual(400);
    expect(e.value).toBeGreaterThanOrEqual(50);
  });

  it('grade < 9 with no matching comp is never above the cheapest higher-grade comp', () => {
    expect(estimateGradedValue(UMA_229, 8)!.value).toBeLessThanOrEqual(73);
  });

  it('low grades scale below raw', () => {
    const raw = table({ raw: 100 });
    expect(estimateGradedValue(raw, 7)!.value).toBeLessThan(100);
    expect(estimateGradedValue(raw, 1)!.value).toBeGreaterThanOrEqual(50);
  });
});

describe.each(ESTIMATORS)('%s estimator', (_name, estimate) => {
  it.each(FIXTURES)('is monotonic across grades 1-10 (%s)', (_label, prices) => {
    let prev = -Infinity;
    for (let g = 1; g <= 10; g++) {
      const v = estimate(prices, g);
      if (v === null) continue;
      expect(v, `grade ${g}`).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it.each(FIXTURES)('grade >= 9 is never below raw (%s)', (_label, prices) => {
    if (!prices.raw) return;
    for (const g of [9, 10]) expect(estimate(prices, g)!).toBeGreaterThanOrEqual(prices.raw);
  });

  it('matches the MTG customer cases', () => {
    expect(estimate(BOX_TOPPER, 8)!).toBeLessThanOrEqual(273.89);
    expect(estimate(BOX_TOPPER, 10)).toBeCloseTo(330.28, 2);
    expect(estimate(UMA_229, 10)!).toBeGreaterThanOrEqual(114.91);
  });
});

describe('sports estimateDcmValue', () => {
  it.each(FIXTURES)('is monotonic across grades 1-10 (%s)', (_label, prices) => {
    let prev = -Infinity;
    for (let g = 1; g <= 10; g++) {
      const r = estimateSportsDcmValue(prices, g);
      if (!r) continue;
      expect(r.estimate, `grade ${g}`).toBeGreaterThanOrEqual(prev);
      prev = r.estimate;
    }
  });

  it('grade 8 with only PSA 9.5/10 comps does not price off the higher comp', () => {
    expect(estimateSportsDcmValue(BOX_TOPPER, 8)!.estimate).toBeLessThanOrEqual(273.89);
  });

  it('grade 10 floors the premium at zero', () => {
    expect(estimateSportsDcmValue(UMA_229, 10)!.estimate).toBeGreaterThanOrEqual(114.91);
  });
});
