/**
 * The resolver is the single source of truth for every displayed value, and the
 * mobile app ships a copy of it. Both facts are tested here: the guard has to
 * apply on the DCM and eBay sources but not on Scryfall, and the two mobile
 * copies have to stay identical to the web ones or the app will show numbers
 * the website hides.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { resolveCardValue, getCardValue, isValueWithheld, type CardForPricing } from './resolveCardValue';

/** The Babe Ruth row: name only, matched to the most famous Ruth card. */
const thin = {
  category: 'Baseball',
  card_set: null,
  release_date: null,
  dcm_selected_product_id: null,
  identity_confirmed_revision: null,
};

describe('resolveCardValue', () => {
  it('still resolves an ordinary priced card', () => {
    const resolved = resolveCardValue({
      category: 'Pokemon',
      card_set: 'Base Set',
      release_date: '1999',
      dcm_price_estimate: 4200,
    });
    expect(resolved).toEqual({ value: 4200, source: 'dcm-estimate' });
  });

  it('withholds the DCM estimate on the three production cards', () => {
    expect(resolveCardValue({ ...thin, dcm_price_estimate: 2739573 })).toEqual({
      value: 0,
      source: 'withheld',
      withheldValue: 2739573,
      withheldReason: 'thin_identity',
    });
    expect(resolveCardValue({ ...thin, card_set: 'Topps Baseball', dcm_price_estimate: 778764 }).source)
      .toBe('withheld');
    expect(resolveCardValue({ ...thin, category: 'Star Wars', card_set: 'Unknown', dcm_price_estimate: 94854.17 }).source)
      .toBe('withheld');
  });

  it('withholds the legacy cached estimate too', () => {
    const resolved = resolveCardValue({ ...thin, dcm_cached_prices: { estimatedValue: 120000 } });
    expect(resolved.source).toBe('withheld');
    expect(resolved.withheldValue).toBe(120000);
  });

  it('withholds a name-only eBay median, which has the same flaw', () => {
    const resolved = resolveCardValue({ ...thin, ebay_price_median: 9000 });
    expect(resolved.source).toBe('withheld');
    expect(resolved.withheldValue).toBe(9000);
  });

  it('does not guard Scryfall, which is priced per printing', () => {
    const resolved = resolveCardValue({
      ...thin,
      category: 'MTG',
      scryfall_price_usd: 8000,
    });
    expect(resolved).toEqual({ value: 8000, source: 'scryfall' });

    const foil = resolveCardValue({ ...thin, category: 'MTG', is_foil: true, scryfall_price_usd_foil: 9500 });
    expect(foil).toEqual({ value: 9500, source: 'scryfall-foil' });
  });

  it('releases the value once the owner confirms or picks the product', () => {
    expect(resolveCardValue({ ...thin, dcm_price_estimate: 2739573, dcm_selected_product_id: '6910' }))
      .toEqual({ value: 2739573, source: 'dcm-estimate' });
    expect(resolveCardValue({ ...thin, dcm_price_estimate: 2739573, identity_confirmed_revision: 1 }))
      .toEqual({ value: 2739573, source: 'dcm-estimate' });
  });

  it('leaves a $300 thin card alone', () => {
    expect(resolveCardValue({ ...thin, dcm_price_estimate: 300 }))
      .toEqual({ value: 300, source: 'dcm-estimate' });
  });

  it('does not withhold a Pokemon card that has a set but no year', () => {
    expect(resolveCardValue({
      category: 'Pokemon',
      card_set: 'Base Set',
      release_date: null,
      dcm_price_estimate: 25000,
    })).toEqual({ value: 25000, source: 'dcm-estimate' });
  });

  it('does not withhold when the caller selected no identity fields', () => {
    expect(resolveCardValue({ dcm_price_estimate: 2739573 }))
      .toEqual({ value: 2739573, source: 'dcm-estimate' });
  });

  it('reports 0 through getCardValue so every total ignores a withheld card', () => {
    expect(getCardValue({ ...thin, dcm_price_estimate: 2739573 })).toBe(0);
    expect(isValueWithheld(resolveCardValue({ ...thin, dcm_price_estimate: 2739573 }))).toBe(true);
    expect(isValueWithheld(resolveCardValue({ dcm_price_estimate: 10 }))).toBe(false);
  });

  it('keeps a mixed portfolio total to the cards that can be shown', () => {
    const cards: CardForPricing[] = [
      { category: 'Pokemon', card_set: 'Base Set', release_date: '1999', dcm_price_estimate: 1000 },
      { ...thin, dcm_price_estimate: 2739573 },
      { ...thin, card_set: 'Topps Baseball', dcm_price_estimate: 778764 },
      { category: 'Baseball', card_set: '1960 Topps', release_date: '1960', dcm_price_estimate: 250.5 },
      { category: 'Baseball', card_set: '1960 Topps', release_date: '1960' },
    ];
    const total = cards.reduce((sum, card) => sum + getCardValue(card), 0);
    expect(total).toBe(1250.5);
    expect(cards.filter(c => getCardValue(c) > 0)).toHaveLength(2);
    expect(cards.filter(c => isValueWithheld(resolveCardValue(c)))).toHaveLength(2);
    // No total may ever go negative or NaN because of the guard.
    expect(Number.isFinite(total)).toBe(true);
    expect(total).toBeGreaterThanOrEqual(0);
  });
});

/**
 * The mobile app bundles its own copy of both files because metro does not
 * reach across the project boundary. A drift here means the app shows a value
 * the website withholds, which is the whole failure this guard exists to stop.
 */
describe('mobile copies', () => {
  const repoRoot = join(__dirname, '..', '..', '..');
  const read = (p: string) => readFileSync(join(repoRoot, p), 'utf8').replace(/\r\n/g, '\n');

  it.each([
    ['resolveCardValue.ts', 'src/lib/pricing/resolveCardValue.ts', 'dcm-mobile/lib/resolveCardValue.ts'],
    ['valueGuard.ts', 'src/lib/pricing/valueGuard.ts', 'dcm-mobile/lib/valueGuard.ts'],
  ])('%s is identical on web and mobile', (_name, web, mobile) => {
    expect(read(mobile)).toBe(read(web));
  });
});
