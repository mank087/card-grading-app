import { describe, it, expect } from 'vitest';
import {
  nextScrollAwayHidden,
  scrollAwayMovementCounts,
  SCROLL_AWAY_THRESHOLD_PX,
  SCROLL_AWAY_TOP_ZONE_PX,
} from './helpBotScrollAway';

describe('nextScrollAwayHidden', () => {
  it('hides while scrolling down', () => {
    expect(nextScrollAwayHidden(false, 400, 460)).toBe(true);
  });

  it('shows again on any real scroll up', () => {
    expect(nextScrollAwayHidden(true, 900, 880)).toBe(false);
  });

  it('ignores movements smaller than the threshold, keeping the current state', () => {
    const small = SCROLL_AWAY_THRESHOLD_PX - 1;
    expect(nextScrollAwayHidden(true, 500, 500 - small)).toBe(true);
    expect(nextScrollAwayHidden(false, 500, 500 + small)).toBe(false);
  });

  it('is always shown near the top of the page, even mid-scroll-down', () => {
    expect(nextScrollAwayHidden(true, 0, SCROLL_AWAY_TOP_ZONE_PX)).toBe(false);
    expect(nextScrollAwayHidden(false, 10, 60)).toBe(false);
  });

  it('treats a scroll lock jumping the page to 0 as "at the top", so the bubble shows', () => {
    expect(nextScrollAwayHidden(true, 1400, 0)).toBe(false);
  });
});

describe('scrollAwayMovementCounts', () => {
  it('only advances on movements at or past the threshold', () => {
    expect(scrollAwayMovementCounts(100, 100 + SCROLL_AWAY_THRESHOLD_PX)).toBe(true);
    expect(scrollAwayMovementCounts(100, 100 + SCROLL_AWAY_THRESHOLD_PX - 1)).toBe(false);
  });
});
