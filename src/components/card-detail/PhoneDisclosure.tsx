'use client';

/**
 * A `<details>` that is CLOSED by default on a phone and simply not there on a
 * desktop (Sept 23 mobile review, Phase 4: Market "Prices by grade", the
 * mail-away estimates, and "More card details").
 *
 * DESKTOP (> 760px): always open, and card-detail.css hides the `<summary>`
 * and takes every margin, padding and border off the element, so the content
 * lays out exactly as it did before the wrapper existed. There is nothing to
 * toggle and nothing extra in the Tab order.
 *
 * PHONE (≤ 760px): starts closed; the summary is a full-width row.
 *
 * CHILDREN STAY MOUNTED WHEN CLOSED. A closed `<details>` only hides its
 * content; React keeps the subtree, effects and all. That is load-bearing for
 * Market: the category price lookup inside "Prices by grade" still fetches
 * and SAVES a fresh price on every page view, exactly as it did when it sat
 * behind the hidden Market tab.
 *
 * The open state follows the viewport when the viewport crosses the
 * breakpoint, and otherwise follows the reader (`onToggle`). It is read from
 * `matchMedia` in the initialiser rather than from `useNarrowViewport`, whose
 * first render always answers "wide" — that would flash the content open for
 * a frame on every phone.
 */

import { useEffect, useState, type ReactNode } from 'react';

const PHONE_QUERY = '(max-width: 760px)';

function isPhone(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(PHONE_QUERY).matches;
}

export interface PhoneDisclosureProps {
  /** The summary row's words, shown on a phone only. */
  summary: ReactNode;
  className?: string;
  children: ReactNode;
}

export function PhoneDisclosure({ summary, className, children }: PhoneDisclosureProps) {
  const [open, setOpen] = useState(() => !isPhone());

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(PHONE_QUERY);
    const sync = () => setOpen(!mq.matches);
    if (mq.addEventListener) {
      mq.addEventListener('change', sync);
      return () => mq.removeEventListener('change', sync);
    }
    mq.addListener(sync);
    return () => mq.removeListener(sync);
  }, []);

  return (
    <details
      className={className ? `cd-disclosure ${className}` : 'cd-disclosure'}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      {/* The chevron is a span, not `::after`: Market's 44px touch-target rule
          (`#market summary::after`) already owns that pseudo-element. */}
      <summary className="cd-disclosure-summary">
        <span>{summary}</span>
        <span className="cd-disclosure-chevron" aria-hidden="true" />
      </summary>
      {children}
    </details>
  );
}

export default PhoneDisclosure;
