import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ available: vi.fn(), family: vi.fn(), match: vi.fn(), live: vi.fn() }));
vi.mock('@/lib/sportsCardMatcher', () => ({ isSportsLocalDbAvailable: mocks.available, getLocalSportsFamily: mocks.family, matchSportsCardLocal: mocks.match }));
vi.mock('@/lib/priceCharting', () => ({ getAvailableParallels: mocks.live, isPriceChartingEnabled: () => true }));
import { loadReviewCandidates, serialDenominatorOf } from './reviewCandidates';

const prefill: any = { fields: [{ key: 'featured', value: 'Joe Mixon' }, { key: 'card_number', value: '214' }, { key: 'serial_numbering', value: '047/249' }] };
const row = (id: string, variant: string | null, serial: number | null, price: number | null) => ({ id, product_name: `Joe Mixon${variant ? ` [${variant}]` : ''} #214`, console_name: 'Football Cards 2017 Panini Certified', variant_text: variant, serial_denominator: serial, loose_price: price, graded_price: null, manual_only_price: null, new_price: null });

beforeEach(() => { vi.clearAllMocks(); mocks.available.mockResolvedValue(true); });

describe('picker candidates', () => {
  it('lists the whole local family, serial-numbered versions included, from the product the owner already picked', async () => {
    mocks.family.mockResolvedValue([row('1', null, null, 2.5), row('2', 'Autograph Jersey Mirror Red', 249, 40), row('3', 'Autograph Jersey Mirror Gold', 25, 120)]);
    const out = await loadReviewCandidates(prefill, { category: 'Football', dcm_selected_product_id: '2' });
    expect(mocks.family).toHaveBeenCalledWith('2');
    expect(out.candidates.map(c => [c.id, c.isBase, c.serialDenominator, c.rawPrice])).toEqual([['1', true, null, 2.5], ['2', false, 249, 40], ['3', false, 25, 120]]);
    expect(mocks.live).not.toHaveBeenCalled();
  });
  it('matches locally from the prefilled identity when no product is known yet', async () => {
    mocks.family.mockResolvedValue([]);
    mocks.match.mockResolvedValue({ product: null, family: [row('9', 'Mirror Red', 249, 10)] });
    const out = await loadReviewCandidates(prefill, { category: 'Football' });
    expect(mocks.match).toHaveBeenCalledWith(expect.objectContaining({ playerName: 'Joe Mixon', cardNumber: '214', serialNumbering: '047/249' }));
    expect(out.candidates).toHaveLength(1);
  });
  it('falls back to the live search when the local database has nothing, and survives its failure', async () => {
    mocks.available.mockResolvedValue(false);
    mocks.live.mockResolvedValue([{ id: 'x', name: 'Joe Mixon #214', setName: 'Certified', hasPrice: true }]);
    expect((await loadReviewCandidates(prefill, { category: 'Football' })).candidates).toHaveLength(1);
    mocks.live.mockRejectedValue(new Error('timeout'));
    expect(await loadReviewCandidates(prefill, { category: 'Football' })).toMatchObject({ candidates: [], error: true });
  });
  it('reads the print run out of a serial', () => {
    expect(serialDenominatorOf('047/249')).toBe(249);
    expect(serialDenominatorOf('1/1')).toBe(1);
    expect(serialDenominatorOf('')).toBeNull();
  });
});
