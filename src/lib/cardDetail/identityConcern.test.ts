import { describe, it, expect } from 'vitest';
import { readIdentityConcern, identityConcernCopy } from './identityConcern';

describe('readIdentityConcern', () => {
  it.each([
    ['low', 'low'],
    ['medium', 'medium'],
  ])('flags a %s-confidence match', (raw, expected) => {
    expect(readIdentityConcern({ pokemon_api_confidence: raw })).toBe(expected);
  });

  it.each(['high', 'verified', '', null, undefined, 42])('does not flag %s', (raw) => {
    expect(readIdentityConcern({ pokemon_api_confidence: raw })).toBeNull();
  });

  it('is null for a card with no signal at all (every non-Pokemon category today)', () => {
    expect(readIdentityConcern({ category: 'Sports' })).toBeNull();
    expect(readIdentityConcern(null)).toBeNull();
  });
});

describe('identityConcernCopy', () => {
  it('says "may be incorrect" only for a low-confidence match', () => {
    expect(identityConcernCopy('low').title).toBe('Card identification may be incorrect');
    expect(identityConcernCopy('medium').title).toBe('Card identification uncertain');
  });
});
