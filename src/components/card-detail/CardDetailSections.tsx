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
  sectionForAnchor,
  sectionForViewer,
  visibleCardDetailSections,
  type CardDetailSectionId,
} from '@/lib/cardDetail/anchorMap';

const SECTION_LABELS: Record<CardDetailSectionId, string> = {
  overview: 'Overview',
  labels: 'Labels & holders',
  market: 'Market & portfolio',
  grade: 'Grade details',
  reports: 'Reports',
  instalist: 'InstaList',
};

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
    const target = resolveHashTarget(window.location.hash);
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
    const owner = sectionForAnchor(anchorId);
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
   * `inline: 'nearest'` so an item that is already visible does not slide, and
   * `block: 'nearest'` so this never scrolls the PAGE — only the row.
   */
  useEffect(() => {
    const row = listRef.current;
    if (!row) return;
    const current = row.querySelector<HTMLElement>('[aria-current="page"]');
    if (!current) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    current.scrollIntoView({
      behavior: reduce ? 'auto' : 'smooth',
      inline: 'nearest',
      block: 'nearest',
    });
  }, [active]);

  return (
    <nav ref={listRef} className="cd-section-nav" aria-label="Card detail sections">
      {visibleCardDetailSections(isOwner).map((id) => (
        <button
          key={id}
          type="button"
          // Plain buttons, so they are in the tab order and respond to Enter
          // and Space without a roving-tabindex implementation to get wrong.
          aria-current={active === id ? 'page' : undefined}
          onClick={() => onSelect(id)}
        >
          {SECTION_LABELS[id]}
        </button>
      ))}
    </nav>
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
        <div id={active} aria-label={SECTION_LABELS[active]}>
          {unmountedWhenInactive[active]}
        </div>
      )}
      {/* Always mounted so the price lookup runs on every view; see the header. */}
      <div id="market" aria-label={SECTION_LABELS.market} hidden={active !== 'market'}>
        {market}
      </div>
    </>
  );
}

export default CardDetailSections;
