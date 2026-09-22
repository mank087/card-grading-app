import { describe, it, expect } from 'vitest';
import { listingImageKey } from './listingImageKey';

const base = {
  cardId: 'card-1',
  cardType: 'pokemon',
  labelStyle: 'heritage',
  customLabelConfig: null,
  showFounderEmblem: false,
};

describe('listingImageKey', () => {
  it('is stable for the same inputs', () => {
    expect(listingImageKey({ ...base })).toBe(listingImageKey({ ...base }));
  });

  it('separates cards, styles, types and the emblem', () => {
    const key = listingImageKey(base);
    expect(listingImageKey({ ...base, cardId: 'card-2' })).not.toBe(key);
    expect(listingImageKey({ ...base, labelStyle: 'modern' })).not.toBe(key);
    expect(listingImageKey({ ...base, cardType: 'mtg' })).not.toBe(key);
    expect(listingImageKey({ ...base, showFounderEmblem: true })).not.toBe(key);
  });

  it('separates two custom designs and ignores key order', () => {
    const a = { preset: 'slab', width: 2.8, height: 0.8 } as never;
    const b = { height: 0.8, width: 2.8, preset: 'slab' } as never;
    const c = { preset: 'slab', width: 3.0, height: 0.8 } as never;
    expect(listingImageKey({ ...base, customLabelConfig: a })).toBe(
      listingImageKey({ ...base, customLabelConfig: b }),
    );
    expect(listingImageKey({ ...base, customLabelConfig: c })).not.toBe(
      listingImageKey({ ...base, customLabelConfig: a }),
    );
    expect(listingImageKey({ ...base, customLabelConfig: a })).not.toBe(listingImageKey(base));
  });

  it('never returns an empty key for a card with no id', () => {
    expect(listingImageKey({ ...base, cardId: null })).toContain('no-card');
  });
});
