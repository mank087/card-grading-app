import { describe, expect, it } from 'vitest';
import { cachedCardInfo } from './cachedCardInfo';

describe('cachedCardInfo', () => {
  const graderRead = { card_name: 'Lenny Grant', player_or_character: 'Lenny Grant', set_name: 'Garbage Pail Kids', rarity_or_variant: 'Base' };

  it('returns the stored column over the grader blob, key by key', () => {
    const stored = { card_name: 'Adam Bomb', player_or_character: 'Adam Bomb', set_name: 'Garbage Pail Kids Series 1' };
    expect(cachedCardInfo(graderRead, stored)).toEqual({ ...stored, rarity_or_variant: 'Base' });
  });

  it('keeps a value the owner cleared', () => {
    expect(cachedCardInfo(graderRead, { set_name: null }).set_name).toBeNull();
  });

  it('falls back to the blob when nothing is stored', () => {
    expect(cachedCardInfo(graderRead, null)).toEqual(graderRead);
  });

  it('returns the stored column when the blob has no card_info', () => {
    expect(cachedCardInfo(null, { card_name: 'Adam Bomb' })).toEqual({ card_name: 'Adam Bomb' });
    expect(cachedCardInfo(undefined, null)).toBeNull();
  });
});
