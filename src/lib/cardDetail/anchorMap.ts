/**
 * Legacy anchor compatibility for the V2 card detail page.
 *
 * The eight legacy clients scatter `id="tour-*"` anchors down one long
 * scrolling page. `OnboardingTour` targets them by id, `ReportSectionNav`
 * links them, QR codes and old shared report links point at them, and the
 * legacy page opens the containing `CollapsibleSection` when the tour asks.
 *
 * V2 replaces that scroll with five tab-like sections, so an anchor is no
 * longer guaranteed to be in the DOM when someone arrives at it. This map is
 * the compatibility contract: every legacy anchor names the V2 section that
 * OWNS it, so the page can activate that section first and scroll second.
 *
 * Source of the list: docs/CARD_DETAIL_V2_PHASE0_INVENTORY_2026-09-21.md §3,
 * re-verified against `src/app/pokemon/[id]/CardDetailClient.tsx` (both the
 * `id="tour-…"` and the `tourId="…"` forms). `tour-card-info` appears in both
 * forms, which is why the inventory counts sixteen anchors for fifteen ids.
 *
 * Adding an anchor here is not enough — the owning section must actually
 * render an element with that id. `anchorMap.test.ts` pins the map against
 * the tour's step list and the legacy nav; it cannot see the DOM, so the
 * rendering side is a review item.
 */

/** The five URL-addressable sections of the V2 page. */
export const CARD_DETAIL_SECTIONS = [
  'overview',
  'labels',
  'market',
  'grade',
  'reports',
] as const;

export type CardDetailSectionId = (typeof CARD_DETAIL_SECTIONS)[number];

/**
 * Where an anchor lives. `hero` means the anchor is in the always-visible
 * hero, above the section nav, so no section has to be activated for it.
 */
export type AnchorOwner = 'hero' | CardDetailSectionId;

export const LEGACY_ANCHOR_SECTIONS: Record<string, AnchorOwner> = {
  // Hero — rendered for every state, never hidden behind a tab.
  'tour-card-images': 'hero',
  'tour-visibility-toggle': 'hero',
  'tour-grade-score': 'hero',
  'tour-subgrades': 'hero',
  'tour-market-value': 'hero',
  'tour-insta-list': 'hero',

  // Overview — the card facts grid and its edit affordance.
  'tour-card-info': 'overview',
  'tour-edit-details': 'overview',

  // Market & portfolio.
  'tour-live-market-pricing': 'market',
  'tour-market-pricing': 'market',
  'tour-pro-estimates': 'market',

  // Grade details.
  'tour-condition-summary': 'grade',
  'tour-centering': 'grade',
  'tour-optic-score': 'grade',

  // Reports.
  'tour-download-buttons': 'reports',
};

/** Every legacy anchor id V2 must keep alive, in no particular order. */
export const LEGACY_ANCHOR_IDS = Object.keys(LEGACY_ANCHOR_SECTIONS);

export function isCardDetailSectionId(value: string): value is CardDetailSectionId {
  return (CARD_DETAIL_SECTIONS as readonly string[]).includes(value);
}

/** The section that owns an anchor, or null when the id is not a legacy anchor. */
export function sectionForAnchor(anchorId: string): AnchorOwner | null {
  return LEGACY_ANCHOR_SECTIONS[anchorId] ?? null;
}

export interface ResolvedHashTarget {
  /** The section to activate before scrolling, or null to leave the tab alone. */
  section: CardDetailSectionId | null;
  /** The element id to scroll to, or null when the hash only named a section. */
  anchorId: string | null;
}

/**
 * Turn a `location.hash` into "which tab, then which element".
 *
 * Three shapes are understood:
 *   `#grade`             a section — activate it, scroll nowhere in particular.
 *   `#tour-centering`    a legacy anchor — activate its owner, then scroll to it.
 *   anything else        not ours; leave the page alone.
 */
export function resolveHashTarget(hash: string | null | undefined): ResolvedHashTarget | null {
  if (!hash) return null;
  const id = hash.replace(/^#/, '').trim();
  if (!id) return null;

  if (isCardDetailSectionId(id)) {
    return { section: id, anchorId: null };
  }

  const owner = sectionForAnchor(id);
  if (!owner) return null;

  return { section: owner === 'hero' ? null : owner, anchorId: id };
}
