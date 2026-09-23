'use client';

/**
 * The hero's "see it in a holder" navigation, extracted from `CardDetailShell`
 * (Phase 2 of the Sept 23 mobile review) so the shell stays composition only.
 *
 * Both functions open the Overview section first, then scroll once React has
 * mounted the band:
 *   - `goToHolder`     — to one holder's card, marked briefly on arrival so the
 *                        reader's eye lands on it (desktop's three buttons);
 *   - `goToHolderBand` — to the band itself (the single phone link, S4).
 *
 * A timer, not requestAnimationFrame: rAF is throttled to a standstill in a
 * background tab, and this must still land when the reader comes back to one.
 * 60ms is enough for React to have mounted the band. The highlight is a CSS
 * animation and smooth scrolling is dropped under reduced motion.
 */

import { useCallback } from 'react';
import type { CardHolderId } from '@/lib/cardDetail/holderSupport';
import { holderCardAnchorId } from './HolderCards';

/** The Overview band's own anchor (see `OverviewHoldersBand`). */
export const HOLDER_BAND_ID = 'cd-holders-band';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

export function useGoToHolder(openOverview: () => void) {
  const goToHolder = useCallback(
    (holder: CardHolderId) => {
      openOverview();
      const anchorId = holderCardAnchorId(holder);
      const reduce = prefersReducedMotion();
      window.setTimeout(() => {
        const el = document.getElementById(anchorId);
        if (!el) return;
        el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
        el.focus({ preventScroll: true });
        el.setAttribute('data-arrived', 'true');
        window.setTimeout(() => el.removeAttribute('data-arrived'), 1600);
      }, 60);
    },
    [openOverview],
  );

  const goToHolderBand = useCallback(() => {
    openOverview();
    const reduce = prefersReducedMotion();
    window.setTimeout(() => {
      const el = document.getElementById(HOLDER_BAND_ID);
      if (!el) return;
      // `block: 'start'` + the page's `scroll-margin-top` lands the band's
      // heading just under the sticky section nav.
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      el.focus({ preventScroll: true });
    }, 60);
  }, [openOverview]);

  return { goToHolder, goToHolderBand };
}

export default useGoToHolder;
