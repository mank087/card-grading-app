import { describe, it, expect } from 'vitest';
import { nextNavScrollLeft, NAV_SCROLL_PADDING } from './navScroll';

const row = (scrollLeft: number, clientWidth = 300, scrollWidth = 900) => ({
  scrollLeft,
  clientWidth,
  scrollWidth,
});

describe('nextNavScrollLeft', () => {
  it('does nothing when the row does not overflow', () => {
    expect(nextNavScrollLeft(row(0, 900, 900), { offsetLeft: 500, offsetWidth: 100 })).toBeNull();
  });

  it('does nothing when the item is already comfortably visible', () => {
    expect(nextNavScrollLeft(row(0), { offsetLeft: 40, offsetWidth: 100 })).toBeNull();
  });

  it('pulls an item off the right edge into view with padding', () => {
    // item ends at 700, view ends at 300 → scrollLeft = 700 + 16 - 300
    expect(nextNavScrollLeft(row(0), { offsetLeft: 600, offsetWidth: 100 })).toBe(
      700 + NAV_SCROLL_PADDING - 300,
    );
  });

  it('pulls an item off the left edge into view with padding', () => {
    expect(nextNavScrollLeft(row(400), { offsetLeft: 200, offsetWidth: 100 })).toBe(
      200 - NAV_SCROLL_PADDING,
    );
  });

  it('clamps to the scrollable range at both ends', () => {
    // The last item: 900 - 300 = 600 is the maximum scrollLeft.
    expect(nextNavScrollLeft(row(0), { offsetLeft: 800, offsetWidth: 100 })).toBe(600);
    // The first item cannot scroll past 0 even with the padding subtracted.
    expect(nextNavScrollLeft(row(300), { offsetLeft: 4, offsetWidth: 100 })).toBe(0);
  });

  it('ignores a sub-pixel correction', () => {
    expect(nextNavScrollLeft(row(0), { offsetLeft: 300.4, offsetWidth: 0 }, 0)).toBeNull();
  });
});
