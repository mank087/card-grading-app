import { describe, it, expect } from 'vitest';
import {
  RARITY_BUCKETS,
  isRarityBucket,
  categoryUsesRarityBuckets,
  pickRarity,
} from './rarityBuckets';

describe('isRarityBucket', () => {
  it('matches every bucket the grader can stamp', () => {
    for (const bucket of RARITY_BUCKETS) {
      expect(isRarityBucket(bucket), bucket).toBe(true);
    }
  });

  it('ignores case and surrounding space', () => {
    expect(isRarityBucket('  parallel / insert variant ')).toBe(true);
    expect(isRarityBucket('BASE / COMMON')).toBe(true);
  });

  it('does not match a real rarity name', () => {
    for (const rarity of ['Secret Rare', 'Illustration Rare', 'Mythic', 'Rare Holo', 'Parallel']) {
      expect(isRarityBucket(rarity), rarity).toBe(false);
    }
  });

  it('is safe on nothing', () => {
    expect(isRarityBucket(null)).toBe(false);
    expect(isRarityBucket(undefined)).toBe(false);
    expect(isRarityBucket('')).toBe(false);
    expect(isRarityBucket(7)).toBe(false);
  });
});

describe('categoryUsesRarityBuckets', () => {
  it('is sports and nothing else', () => {
    expect(categoryUsesRarityBuckets('sports')).toBe(true);
    expect(categoryUsesRarityBuckets('Sports')).toBe(true);
    // `cards.category` can hold the sport itself.
    for (const sport of ['Baseball', 'football', 'UFC', 'MMA', 'Hockey']) {
      expect(categoryUsesRarityBuckets(sport), sport).toBe(true);
    }
    for (const c of ['pokemon', 'mtg', 'lorcana', 'onepiece', 'yugioh', 'starwars', 'other', null]) {
      expect(categoryUsesRarityBuckets(c), String(c)).toBe(false);
    }
  });
});

describe('pickRarity', () => {
  it('falls past a bucket to the real rarity for a Pokemon card', () => {
    expect(pickRarity('pokemon', 'Parallel / Insert Variant', null, 'Secret Rare')).toBe(
      'Secret Rare',
    );
  });

  it('returns null rather than printing a bucket', () => {
    expect(pickRarity('pokemon', 'Parallel / Insert Variant', null, undefined)).toBeNull();
    expect(pickRarity('mtg', 'Unconfirmed')).toBeNull();
  });

  it('keeps the bucket for sports, where it is the description', () => {
    expect(pickRarity('sports', 'Parallel / Insert Variant', 'Secret Rare')).toBe(
      'Parallel / Insert Variant',
    );
  });

  it('takes the first real value in order', () => {
    expect(pickRarity('pokemon', null, '  Illustration Rare  ', 'Rare')).toBe('Illustration Rare');
  });
});
