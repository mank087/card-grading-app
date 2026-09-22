import { describe, it, expect } from 'vitest';
import { generateTCGPlayerSearchUrl, generateTCGPlayerSetSearchUrl } from './tcgplayerUtils';

const base = { card_name: 'Kewl Tune Synchro', card_number: 'PHRE-EN039', card_set: 'Phantom Revenge' } as any;

describe('TCGPlayer product lines', () => {
  it('sends Yu-Gi-Oh cards to the yugioh product line, not Pokemon', () => {
    const url = generateTCGPlayerSearchUrl({ ...base, category: 'Yu-Gi-Oh' });
    expect(url).toContain('/search/yugioh/product');
    expect(url).toContain('productLineName=yugioh');
    expect(url).not.toContain('pokemon');
  });

  it('sends One Piece cards to the One Piece product line', () => {
    const url = generateTCGPlayerSearchUrl({ ...base, category: 'One Piece' });
    expect(url).toContain('/search/one-piece-card-game/product');
    expect(url).toContain('productLineName=one-piece-card-game');
  });

  it('accepts the route-style category spellings too', () => {
    expect(generateTCGPlayerSearchUrl({ ...base, category: 'yugioh' })).toContain('/search/yugioh/');
    expect(generateTCGPlayerSearchUrl({ ...base, category: 'onepiece' })).toContain('/search/one-piece-card-game/');
  });

  it('keeps Pokemon on the Pokemon line and Magic on magic', () => {
    expect(generateTCGPlayerSearchUrl({ ...base, category: 'Pokemon' })).toContain('/search/pokemon/product');
    expect(generateTCGPlayerSearchUrl({ ...base, category: 'MTG' })).toContain('/search/magic/product');
  });

  it('has no set-search URL for One Piece or Yu-Gi-Oh, so callers fall back to the product search', () => {
    expect(generateTCGPlayerSetSearchUrl({ ...base, category: 'Yu-Gi-Oh' })).toBeNull();
    expect(generateTCGPlayerSetSearchUrl({ ...base, category: 'One Piece' })).toBeNull();
  });
});
