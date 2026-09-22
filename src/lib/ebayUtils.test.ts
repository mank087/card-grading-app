import { describe, it, expect } from 'vitest';
import {
  generateYugiohEbaySearchUrl,
  generateYugiohEbaySoldListingsUrl,
  generateOnePieceEbaySearchUrl,
} from './ebayUtils';

const card = { card_name: 'Kewl Tune Synchro', card_number: 'PHRE-EN039' } as any;

describe('Yu-Gi-Oh eBay builders', () => {
  it('searches the Yu-Gi-Oh category with a Yu-Gi-Oh keyword, not One Piece', () => {
    const url = generateYugiohEbaySearchUrl(card);
    expect(url).toContain('_sacat=31395');
    expect(url).toContain('Yu-Gi-Oh');
    expect(url).not.toContain('One+Piece');
    expect(url).not.toContain('261330');
  });

  it('sold listings use the same category and the sold filters', () => {
    const url = generateYugiohEbaySoldListingsUrl(card);
    expect(url).toContain('_sacat=31395');
    expect(url).toContain('LH_Sold=1');
    expect(url).toContain('LH_Complete=1');
  });

  it('leaves the One Piece builder alone', () => {
    expect(generateOnePieceEbaySearchUrl(card)).toContain('_sacat=261330');
  });
});
