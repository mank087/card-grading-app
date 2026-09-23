/**
 * Legacy anchor compatibility for the V2 card detail page.
 *
 * The eight legacy clients scatter `id="tour-*"` anchors down one long
 * scrolling page. `OnboardingTour` targets them by id, `ReportSectionNav`
 * links them, QR codes and old shared report links point at them, and the
 * legacy page opens the containing `CollapsibleSection` when the tour asks.
 *
 * V2 replaces that scroll with six tab-like sections, so an anchor is no
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

/** The six URL-addressable sections of the V2 page. */
export const CARD_DETAIL_SECTIONS = [
  'overview',
  'labels',
  'market',
  'grade',
  'reports',
  'instalist',
] as const;

export type CardDetailSectionId = (typeof CARD_DETAIL_SECTIONS)[number];

/**
 * Sections only the card's owner may see.
 *
 * InstaList is the pre-listing workbench: the owner's photos, their asking
 * price and the description that will go out under their name. A visitor must
 * not see it in the nav, and a visitor arriving on `#instalist` — from a shared
 * link, a stale bookmark, a back button — lands on Overview instead of an empty
 * tab. This is a PRESENTATION rule; the data behind it is owner-gated by the
 * same client-side ownership check the rest of the page uses (open audit gap
 * G6), and nothing here is a substitute for the API's own auth.
 */
export const OWNER_ONLY_SECTIONS: readonly CardDetailSectionId[] = ['instalist'];

export function isOwnerOnlySection(id: CardDetailSectionId): boolean {
  return OWNER_ONLY_SECTIONS.includes(id);
}

/** The sections this viewer may reach, in nav order. */
export function visibleCardDetailSections(isOwner: boolean): CardDetailSectionId[] {
  return CARD_DETAIL_SECTIONS.filter((id) => isOwner || !isOwnerOnlySection(id));
}

/** The section a viewer actually gets: an owner-only one falls back to Overview. */
export function sectionForViewer(id: CardDetailSectionId, isOwner: boolean): CardDetailSectionId {
  return isOwner || !isOwnerOnlySection(id) ? id : 'overview';
}

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
  // STAYS on the hero even though there is now an InstaList SECTION: the tour
  // step points at the hero panel, which is what an owner sees first and what
  // the mobile bar acts on. Moving it would make the step open a tab.
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

/**
 * Anchors V2 introduces that have no legacy counterpart.
 *
 * The grade section splits its findings into four evidence blocks so the hero
 * subgrade buttons can land on the matching one. Centering already had a
 * legacy anchor (`tour-centering`); the other three are new and live here so
 * `LEGACY_ANCHOR_IDS` stays exactly the fifteen ids the Phase 0 inventory
 * pinned. They still resolve from the hash, so a link to
 * `#cd-evidence-corners` opens Grade details and scrolls, same as a legacy one.
 */
export const V2_ANCHOR_SECTIONS: Record<string, AnchorOwner> = {
  'cd-evidence-corners': 'grade',
  'cd-evidence-edges': 'grade',
  'cd-evidence-surface': 'grade',
};

export const V2_ANCHOR_IDS = Object.keys(V2_ANCHOR_SECTIONS);

export function isCardDetailSectionId(value: string): value is CardDetailSectionId {
  return (CARD_DETAIL_SECTIONS as readonly string[]).includes(value);
}

/** The section that owns an anchor, or null when V2 does not know the id. */
export function sectionForAnchor(anchorId: string): AnchorOwner | null {
  return LEGACY_ANCHOR_SECTIONS[anchorId] ?? V2_ANCHOR_SECTIONS[anchorId] ?? null;
}

/**
 * PHONES ONLY (Sept 23 mobile review, S1). Below 760px the hero's card
 * showcase, grade, value and InstaList panels belong to Overview: on any other
 * tab they are parked out of view. These hero anchors live inside those
 * panels, so on a phone they are reached by activating Overview first.
 *
 * `tour-visibility-toggle` is deliberately absent: it lives in the breadcrumb,
 * which stays on screen on every tab.
 */
export const PHONE_OVERVIEW_HERO_ANCHORS: readonly string[] = [
  'tour-card-images',
  'tour-grade-score',
  'tour-subgrades',
  'tour-market-value',
  'tour-insta-list',
];

/**
 * `sectionForAnchor`, for the viewport the page is actually at. On a phone a
 * hero anchor inside the Overview-only part of the hero answers 'overview';
 * everything else (and every anchor on a desktop) answers exactly what
 * `sectionForAnchor` does.
 */
export function sectionForAnchorAt(anchorId: string, narrow: boolean): AnchorOwner | null {
  const owner = sectionForAnchor(anchorId);
  if (narrow && owner === 'hero' && PHONE_OVERVIEW_HERO_ANCHORS.includes(anchorId)) {
    return 'overview';
  }
  return owner;
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
export function resolveHashTarget(
  hash: string | null | undefined,
  /** True below 760px, where most hero anchors belong to Overview (S1). */
  narrow = false,
): ResolvedHashTarget | null {
  if (!hash) return null;
  const id = hash.replace(/^#/, '').trim();
  if (!id) return null;

  if (isCardDetailSectionId(id)) {
    return { section: id, anchorId: null };
  }

  const owner = sectionForAnchorAt(id, narrow);
  if (!owner) return null;

  return { section: owner === 'hero' ? null : owner, anchorId: id };
}
