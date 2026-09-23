/**
 * Should the floating help bubble be out of the way, given a scroll movement?
 *
 * On a phone the bubble sat on top of whatever the reader was looking at
 * (review, Sept 23). It now steps aside while they scroll DOWN, comes back the
 * moment they scroll UP, and is always shown near the top of the page. The
 * "comes back when they stop" part is a timer in the component, not here.
 *
 * Pure so the rule can be tested without a browser. `lastY` is the position at
 * the last movement that counted; movements smaller than the threshold are
 * ignored (and accumulate), so a finger resting on the screen does not flicker it.
 */

export const SCROLL_AWAY_THRESHOLD_PX = 8;
/** Within this distance of the top the bubble is always shown. */
export const SCROLL_AWAY_TOP_ZONE_PX = 80;

export function nextScrollAwayHidden(prevHidden: boolean, lastY: number, y: number): boolean {
  if (y <= SCROLL_AWAY_TOP_ZONE_PX) return false;
  const dy = y - lastY;
  if (Math.abs(dy) < SCROLL_AWAY_THRESHOLD_PX) return prevHidden;
  return dy > 0;
}

/** Whether this movement counts, i.e. whether the caller should advance `lastY`. */
export function scrollAwayMovementCounts(lastY: number, y: number): boolean {
  return Math.abs(y - lastY) >= SCROLL_AWAY_THRESHOLD_PX;
}
