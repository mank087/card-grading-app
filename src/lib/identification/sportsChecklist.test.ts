/**
 * The checklist is the only INDEPENDENT year signal in the sports path — the
 * year guard, the stat cross-check and the model's own transcription all trace
 * back to the same vision call. These cases are the two production misses that
 * motivated it plus the failure modes it must degrade quietly through.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const searchSportsCardPrices = vi.fn();
vi.mock('@/lib/priceCharting', () => ({
  searchSportsCardPrices: (...args: any[]) => searchSportsCardPrices(...args),
}));

import {
  resolveSportsChecklist,
  parseYearFromSetName,
  playerNamesAgree,
} from './sportsChecklist';

const priced = (productName: string, setName: string) => ({
  prices: { productName, setName, raw: null, psa: {}, bgs: {}, sgc: {}, estimatedDcm: null, productId: 'x', lastUpdated: '', salesVolume: null },
  matchConfidence: 'high',
  queryUsed: 'q',
});

describe('sportsChecklist', () => {
  let logs: any;
  beforeEach(() => {
    searchSportsCardPrices.mockReset();
    logs = vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => { logs.mockRestore(); delete process.env.SPORTS_CHECKLIST_ENABLED; });

  it('resolves the 1960 Mantle the model called 1957', async () => {
    searchSportsCardPrices.mockResolvedValue(priced('Mickey Mantle #350', 'Baseball Cards 1960 Topps'));
    const r = await resolveSportsChecklist({
      playerName: 'Mickey Mantle', setName: 'Topps', cardNumber: '350', modelYear: '1957',
    });
    expect(r.confidence).toBe('high');
    expect(r.year).toBe('1960');
    expect(r.playerAgrees).toBe(true);
    expect(r.productName).toBe('Mickey Mantle #350');
  });

  it('never sends the model year to the API — the year is what is under test', async () => {
    searchSportsCardPrices.mockResolvedValue(priced('Mickey Mantle #350', 'Baseball Cards 1960 Topps'));
    await resolveSportsChecklist({ playerName: 'Mickey Mantle', cardNumber: '350', modelYear: '1957' });
    expect(searchSportsCardPrices.mock.calls[0][0].year).toBeUndefined();
  });

  it('flags the Pilarcik miss: the checklist card is not the player the model named', async () => {
    searchSportsCardPrices.mockResolvedValue(priced('Al Pilarcik #7', 'Baseball Cards 1959 Topps'));
    const r = await resolveSportsChecklist({
      playerName: 'Cal Ripken Jr.', setName: 'Topps', cardNumber: '7',
    });
    expect(r.playerAgrees).toBe(false);
    expect(r.confidence).toBe('none');
    expect(r.note).toMatch(/Al Pilarcik/);
  });

  it('is medium when the player agrees but the number was not part of the match', async () => {
    searchSportsCardPrices.mockResolvedValue(priced('Mickey Mantle #150', 'Baseball Cards 1960 Topps'));
    const r = await resolveSportsChecklist({ playerName: 'Mickey Mantle', cardNumber: '350' });
    expect(r.confidence).toBe('medium');
    expect(r.year).toBe('1960');
  });

  it('does not let "#35" satisfy "#350"', async () => {
    searchSportsCardPrices.mockResolvedValue(priced('Mickey Mantle #350', 'Baseball Cards 1960 Topps'));
    const r = await resolveSportsChecklist({ playerName: 'Mickey Mantle', cardNumber: '35' });
    expect(r.confidence).toBe('medium');
  });

  it('returns none when the API throws', async () => {
    searchSportsCardPrices.mockRejectedValue(new Error('429 rate limited'));
    const r = await resolveSportsChecklist({ playerName: 'Mickey Mantle', cardNumber: '350' });
    expect(r.confidence).toBe('none');
    expect(r.year).toBeNull();
    expect(r.note).toMatch(/429/);
  });

  it('returns none when nothing matched', async () => {
    searchSportsCardPrices.mockResolvedValue({ prices: null, matchConfidence: 'none', queryUsed: 'q' });
    expect((await resolveSportsChecklist({ playerName: 'Nobody' })).confidence).toBe('none');
  });

  it('returns none when the set name carries no year', async () => {
    searchSportsCardPrices.mockResolvedValue(priced('Mickey Mantle #350', 'Baseball Cards Topps'));
    const r = await resolveSportsChecklist({ playerName: 'Mickey Mantle', cardNumber: '350' });
    expect(r.confidence).toBe('none');
    expect(r.playerAgrees).toBe(true);
  });

  it('is off with SPORTS_CHECKLIST_ENABLED=0 and never calls the API', async () => {
    process.env.SPORTS_CHECKLIST_ENABLED = '0';
    const r = await resolveSportsChecklist({ playerName: 'Mickey Mantle', cardNumber: '350' });
    expect(r.confidence).toBe('none');
    expect(searchSportsCardPrices).not.toHaveBeenCalled();
  });

  it('does not call the API without a player name', async () => {
    expect((await resolveSportsChecklist({ playerName: '' })).confidence).toBe('none');
    expect(searchSportsCardPrices).not.toHaveBeenCalled();
  });
});

describe('parseYearFromSetName', () => {
  it.each([
    ['Baseball Cards 1960 Topps', '1960'],
    ['Basketball Cards 1986 Fleer', '1986'],
    ['Football Cards 2023 Panini Prizm', '2023'],
    ['Baseball Cards Topps', null],
  ])('%s → %s', (set, year) => {
    expect(parseYearFromSetName(set)).toBe(year);
  });
});

describe('playerNamesAgree', () => {
  it.each([
    ['Mickey Mantle', 'Mickey Mantle #350', true],
    ['Ken Griffey Jr.', 'Ken Griffey Jr #1', true],
    ['C.J. Stroud', 'CJ Stroud #150 [Refractor]', true],
    ['Mantle', 'Mickey Mantle #350', true],
    ['Cal Ripken Jr.', 'Al Pilarcik #7', false],
    ['Mickey Mantle', 'Mickey Rivers #350', false],
  ])('%s vs %s → %s', (a, b, expected) => {
    expect(playerNamesAgree(a, b)).toBe(expected);
  });
});
