/**
 * Where the section nav's horizontal row should be scrolled to, as arithmetic.
 *
 * WHY THIS IS NOT `scrollIntoView` (review 2026-09-22, finding 1). The row used
 * `current.scrollIntoView({ inline: 'nearest', block: 'nearest' })` to bring the
 * active tab back into view on a phone. `block: 'nearest'` does NOT mean "do not
 * scroll the page": when the row itself is below the fold, the nearest scroll
 * position for the DOCUMENT is one that brings the row into view, so the browser
 * scrolls the whole page. Opening a card landed at scrollY 537 on desktop and
 * ~1300 on a phone — past the label and the top of the card — before the reader
 * had touched anything.
 *
 * So the row is scrolled by writing `row.scrollLeft` directly. A scroll
 * container's own `scrollLeft` cannot move the document, by construction. This
 * function is the whole decision, and it is pure so it can be tested without a
 * layout engine.
 *
 * Geometry note: `offsetLeft` is measured from the offset PARENT, which for a
 * button inside a positioned/scrolling nav row is the row itself — the same
 * frame `scrollLeft` is expressed in. The caller passes the numbers it read.
 */

export interface NavRowGeometry {
  /** `row.scrollLeft` */
  scrollLeft: number;
  /** `row.clientWidth` — the visible width, excluding overflow. */
  clientWidth: number;
  /** `row.scrollWidth` — the full width of the content. */
  scrollWidth: number;
}

export interface NavItemGeometry {
  /** `button.offsetLeft`, relative to the row. */
  offsetLeft: number;
  /** `button.offsetWidth` */
  offsetWidth: number;
}

/** Breathing room kept between the active tab and the edge it is pulled to. */
export const NAV_SCROLL_PADDING = 16;

/**
 * The row's new `scrollLeft`, or `null` when it should not move.
 *
 * Null is returned whenever the item is already fully visible (with its
 * padding), so a tab that is on screen never slides — the same intent the old
 * `inline: 'nearest'` had, without the document-scrolling side effect. Null is
 * also returned when the row does not overflow at all, which is the desktop
 * case: there is nothing to scroll and nothing to do.
 */
export function nextNavScrollLeft(
  row: NavRowGeometry,
  item: NavItemGeometry,
  padding: number = NAV_SCROLL_PADDING,
): number | null {
  const maxScroll = Math.max(0, row.scrollWidth - row.clientWidth);
  if (maxScroll <= 0) return null;

  const clamp = (value: number) => Math.max(0, Math.min(maxScroll, value));

  const itemStart = item.offsetLeft;
  const itemEnd = item.offsetLeft + item.offsetWidth;
  const viewStart = row.scrollLeft;
  const viewEnd = row.scrollLeft + row.clientWidth;

  let next = row.scrollLeft;
  if (itemStart - padding < viewStart) {
    // Off the left edge: pull it to the left edge, plus the padding.
    next = clamp(itemStart - padding);
  } else if (itemEnd + padding > viewEnd) {
    // Off the right edge: pull it to the right edge, plus the padding.
    next = clamp(itemEnd + padding - row.clientWidth);
  } else {
    return null;
  }

  // A sub-pixel difference is not worth a scroll write (and, under smooth
  // behaviour, not worth an animation frame).
  if (Math.abs(next - row.scrollLeft) < 1) return null;
  return next;
}

export default nextNavScrollLeft;
