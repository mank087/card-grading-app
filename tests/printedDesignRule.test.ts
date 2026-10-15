import { describe, expect, it } from 'vitest';
import { loadGradingPrompt, type CardType } from '../src/lib/promptLoader_v5';

// v9.33: printed design (aged art, marble/wood/speckle, foil sparkle, glare, sticker peel-cuts,
// in-ink specks) read as surface/edge/corner damage was the largest cause of Oct 2026 grade
// disputes. The rule lives ONCE in the master rubric, so every category's prompt must carry it.
const CATEGORIES: CardType[] = ['sports', 'pokemon', 'mtg', 'lorcana', 'onepiece', 'yugioh', 'other'];
const load = (cardType: CardType) => {
  const result = loadGradingPrompt(cardType);
  expect(result.success).toBe(true);
  return result.prompt!.replace(/\r\n/g, '\n');
};

describe('PRINTED DESIGN IS NOT DAMAGE rule (v9.33)', () => {
  it.each(CATEGORIES)('reaches the %s grading prompt exactly once', (cardType) => {
    const prompt = load(cardType);
    expect(prompt.split('PRINTED DESIGN IS NOT DAMAGE (v9.33').length - 1).toBe(1);
    // The parts that decide a dispute: whitening is exposed stock at the cut edge, a stain has its
    // own outline, and the scratch guide's "catches light = scratch" line points at the exception.
    expect(prompt).toContain('Edge/corner whitening is exposed stock AT the physical cut');
    expect(prompt).toContain('a stain with its own outline');
    expect(prompt).toContain('Exception: holo\nsparkle and printed or die-cut lines');
  });

  it('names sticker peel-cuts only in the Other delta', () => {
    expect(load('other')).toContain('die-cut peel lines around the sticker art are factory cuts');
    expect(load('sports')).not.toContain('die-cut peel lines around the sticker art');
  });
});
