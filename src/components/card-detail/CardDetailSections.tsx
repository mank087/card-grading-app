'use client';

/**
 * The six URL-addressable sections and the nav that switches between them.
 *
 * ── WHAT IS MOUNTED ───────────────────────────────────────────────────────
 * Inactive sections are unmounted, with ONE exception: Market stays mounted
 * and is hidden while inactive. The category price lookup lives there, and on
 * the legacy page it sits inside a CollapsibleSection that hides with a CSS
 * class, so it fetches and SAVES a fresh price on every page view. The hero
 * value and the portfolio both depend on that happening whether or not the
 * visitor ever opens the tab. Unmounting Market would quietly stop it.
 *
 * ── THE TOUR ─────────────────────────────────────────────────────────────
 * When a tour step targets an anchor in a section that is not open,
 * `revealAnchor` switches section inside `flushSync`, so the DOM is already
 * updated when the tour calls `document.getElementById` on the next line. The
 * element is found at once with a real bounding box — including Market's
 * anchors, which would otherwise be found hidden with a zero-size rect.
 *
 * ── URL BEHAVIOUR ────────────────────────────────────────────────────────
 * The active section lives in `location.hash` and is written with
 * `history.replaceState`, so switching tabs does not push history entries that
 * the back button has to walk. A `hashchange` listener handles everything that
 * changes the hash from outside — back/forward across entries made elsewhere,
 * a `#tour-centering` link in an old shared report, a QR destination — by
 * activating the owning section (anchorMap.ts) and then scrolling.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import {
  resolveHashTarget,
  sectionForAnchorAt,
  sectionForViewer,
  visibleCardDetailSections,
  type CardDetailSectionId,
} from '@/lib/cardDetail/anchorMap';
import { nextNavScrollLeft } from '@/lib/cardDetail/navScroll';

const SECTION_LABELS: Record<CardDetailSectionId, string> = {
  overview: 'Overview',
  labels: 'Labels & holders',
  market: 'Market & portfolio',
  grade: 'Grade details',
  reports: 'Reports',
  instalist: 'InstaList',
};

/**
 * Phone-only tab wording. The nav's content is 650px wide in a 390px viewport,
 * so the two longest labels are shortened below 760px — visually only. The
 * button's `aria-label` stays the full `SECTION_LABELS` wording, so nothing a
 * screen reader or a test queries by accessible name changes, and desktop
 * keeps the full words (mobile-web audit, item B3).
 */
const SECTION_LABELS_SHORT: Partial<Record<CardDetailSectionId, string>> = {
  labels: 'Labels',
  market: 'Market',
};

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Below the page's 760px breakpoint, read at the moment of use. On a phone the
 * hero's card, grade, value and InstaList panels belong to Overview (S1), so a
 * hero anchor must activate Overview first; on a desktop nothing changes.
 */
function isNarrowViewport(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(max-width: 760px)').matches;
}

/** Scroll after React has had two frames to mount the newly active section. */
function scrollToWhenReady(elementId: string) {
  if (typeof window === 'undefined') return;
  const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.getElementById(elementId)?.scrollIntoView({ behavior, block: 'start' });
    });
  });
}

export interface SectionRouting {
  active: CardDetailSectionId;
  /** User-driven: activate a section, optionally scrolling to an anchor in it. */
  selectSection: (id: CardDetailSectionId, anchorId?: string) => void;
  /**
   * Activate whichever section owns this anchor, without touching the URL.
   * Passed to `OnboardingTour`'s `onBeforeStep`.
   */
  revealAnchor: (anchorId: string) => void;
}

/**
 * `isOwner` gates the owner-only sections (InstaList). It is not a security
 * boundary — it decides what the nav offers and where `#instalist` lands for a
 * visitor, which `sectionForViewer` answers in one place.
 */
export function useCardDetailSectionRouting(isOwner: boolean): SectionRouting {
  const [active, setActive] = useState<CardDetailSectionId>('overview');

  const applyHash = useCallback(() => {
    const target = resolveHashTarget(window.location.hash, isNarrowViewport());
    if (!target) return;
    // A visitor on `#instalist` gets Overview, and is not scrolled to a tab
    // that is not there.
    if (target.section) setActive(sectionForViewer(target.section, isOwner));
    if (target.anchorId) scrollToWhenReady(target.anchorId);
  }, [isOwner]);

  // On load and on every hash change, including back/forward.
  useEffect(() => {
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, [applyHash]);

  const selectSection = useCallback((rawId: CardDetailSectionId, anchorId?: string) => {
    const id = sectionForViewer(rawId, isOwner);
    setActive(id);
    const hash = `#${anchorId ?? id}`;
    try {
      window.history.replaceState(null, '', hash);
    } catch {
      /* replaceState can throw in sandboxed frames; the tab still switches. */
    }
    scrollToWhenReady(anchorId ?? id);
  }, [isOwner]);

  const revealAnchor = useCallback((anchorId: string) => {
    // On a phone a hero anchor answers 'overview' (S1); on a desktop 'hero'.
    const owner = sectionForAnchorAt(anchorId, isNarrowViewport());
    // Synchronous on purpose: the tour reads the DOM immediately after this.
    if (owner && owner !== 'hero') flushSync(() => setActive(sectionForViewer(owner, isOwner)));
  }, [isOwner]);

  return { active, selectSection, revealAnchor };
}

export interface CardDetailSectionNavProps {
  active: CardDetailSectionId;
  onSelect: (id: CardDetailSectionId) => void;
  /** Owner-only sections are absent from a visitor's nav entirely. */
  isOwner: boolean;
}

export function CardDetailSectionNav({ active, onSelect, isOwner }: CardDetailSectionNavProps) {
  const listRef = useRef<HTMLElement>(null);

  /**
   * The row scrolls horizontally on a phone, so the active item can sit off
   * the right edge after a jump from somewhere else on the page (a hero
   * subgrade, a hash link, the tour). Bring it back into view whenever the
   * active section changes.
   *
   * NOT `scrollIntoView` (review 2026-09-22, finding 1). `block: 'nearest'`
   * does not mean "do not move the page": when the row is below the fold, the
   * nearest document position is one that brings the row into view, so the
   * browser scrolled the whole page — opening a card landed at scrollY 537 on
   * desktop and ~1300 on a phone, past the label and the top of the card,
   * before the reader had touched anything.
   *
   * Instead the row's OWN `scrollLeft` is written, from arithmetic on the
   * active button's `offsetLeft`/`offsetWidth` (lib/cardDetail/navScroll.ts).
   * Writing a scroll container's `scrollLeft` cannot move the document.
   *
   * And it is skipped entirely on the FIRST run: on arrival the row has never
   * been scrolled, so there is nothing to correct — every reason this effect
   * exists is a LATER change of section.
   */
  /**
   * Whether there is more of the row off the left and off the right, which the
   * wrapper turns into an edge fade. Without it the row simply ends mid-word
   * with no hint that four more tabs exist — and iOS paints no scrollbar at
   * all, so there is nothing else to notice (mobile-web audit, item B3).
   *
   * Recomputed on the row's own `scroll`, on resize, and whenever the active
   * section changes (the effect below moves `scrollLeft`).
   */
  const [overflow, setOverflow] = useState({ start: false, end: false });
  const measureOverflow = useCallback(() => {
    const row = listRef.current;
    if (!row) return;
    // 1px of slack: fractional layout widths make an unscrollable row report a
    // scrollWidth a hair over its clientWidth, which would fade it forever.
    const max = row.scrollWidth - row.clientWidth;
    setOverflow((prev) => {
      const next = { start: row.scrollLeft > 1, end: max > 1 && row.scrollLeft < max - 1 };
      return prev.start === next.start && prev.end === next.end ? prev : next;
    });
  }, []);

  useEffect(() => {
    const row = listRef.current;
    if (!row) return;
    measureOverflow();
    row.addEventListener('scroll', measureOverflow, { passive: true });
    window.addEventListener('resize', measureOverflow);
    return () => {
      row.removeEventListener('scroll', measureOverflow);
      window.removeEventListener('resize', measureOverflow);
    };
  }, [measureOverflow]);

  const hasSettled = useRef(false);
  useEffect(() => {
    if (!hasSettled.current) {
      hasSettled.current = true;
      return;
    }
    const row = listRef.current;
    if (!row) return;
    const current = row.querySelector<HTMLElement>('[aria-current="page"]');
    if (!current) return;

    const next = nextNavScrollLeft(
      { scrollLeft: row.scrollLeft, clientWidth: row.clientWidth, scrollWidth: row.scrollWidth },
      { offsetLeft: current.offsetLeft, offsetWidth: current.offsetWidth },
    );
    if (next === null) {
      measureOverflow();
      return;
    }

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (typeof row.scrollTo === 'function') {
      row.scrollTo({ left: next, behavior: reduce ? 'auto' : 'smooth' });
    } else {
      row.scrollLeft = next;
    }
    measureOverflow();
  }, [active, measureOverflow]);

  return (
    /*
     * The wrapper — not the nav — carries the sticky position, the background
     * and the edge-to-edge bleed on mobile. It has to: the fade is an absolute
     * pseudo-element pinned to the edges, and a pseudo-element on the nav
     * itself would scroll away with the tabs. The nav stays the scroll
     * container, so `navScroll.ts` and the effect above are unchanged.
     */
    <div
      className="cd-section-nav-wrap"
      data-overflow-start={overflow.start || undefined}
      data-overflow-end={overflow.end || undefined}
    >
      <nav ref={listRef} className="cd-section-nav" aria-label="Card detail sections">
        {visibleCardDetailSections(isOwner).map((id) => (
          <button
            key={id}
            type="button"
            // Plain buttons, so they are in the tab order and respond to Enter
            // and Space without a roving-tabindex implementation to get wrong.
            aria-current={active === id ? 'page' : undefined}
            aria-label={SECTION_LABELS[id]}
            onClick={() => onSelect(id)}
          >
            <span className="cd-nav-label-full">{SECTION_LABELS[id]}</span>
            {SECTION_LABELS_SHORT[id] && (
              <span className="cd-nav-label-short" aria-hidden="true">
                {SECTION_LABELS_SHORT[id]}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

export interface CardDetailSectionsProps {
  active: CardDetailSectionId;
  overview: ReactNode;
  labels: ReactNode;
  market: ReactNode;
  grade: ReactNode;
  reports: ReactNode;
  /** Owner-only; null for a visitor, who can never make it active anyway. */
  instalist: ReactNode;
}

export function CardDetailSections({
  active,
  overview,
  labels,
  market,
  grade,
  reports,
  instalist,
}: CardDetailSectionsProps) {
  // InstaList joins the unmounted-when-inactive set deliberately: its five
  // listing photos are canvas renders holding object URLs, and keeping them
  // alive behind another tab would pin that memory for the whole visit. The
  // draft itself is held by the shell, so nothing the owner typed is lost.
  const unmountedWhenInactive: Record<Exclude<CardDetailSectionId, 'market'>, ReactNode> = {
    overview,
    labels,
    grade,
    reports,
    instalist,
  };

  return (
    <>
      {active !== 'market' && (
        <div id={active} className="cd-section-host" aria-label={SECTION_LABELS[active]}>
          {unmountedWhenInactive[active]}
        </div>
      )}
      {/* Always mounted so the price lookup runs on every view; see the header. */}
      <div
        id="market"
        className="cd-section-host"
        aria-label={SECTION_LABELS.market}
        hidden={active !== 'market'}
      >
        {market}
      </div>
    </>
  );
}

export default CardDetailSections;
