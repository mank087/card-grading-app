'use client';

/**
 * Hold the page still while a dialog is open (mobile-web audit, item A3).
 *
 * Every dialog on this page is a `div[role="dialog"][aria-modal="true"]`, not
 * a native `<dialog>`, so the browser gives it none of the modal behaviour the
 * element would bring: the page behind it keeps scrolling. Measured on the
 * holder enlarge dialog — `window.scrollBy(0, 300)` moved the document
 * underneath the open dialog, and closing it left the reader somewhere else.
 *
 * WHY NOT `overflow: hidden` ON THE BODY. iOS Safari ignores it. The only form
 * that holds there is taking the body OUT of flow — `position: fixed` with
 * `top: -scrollY` — which freezes the document at exactly the offset it was
 * at. The cost is that the browser then reports `scrollY` as 0, so the offset
 * has to be remembered and written back by hand on unlock; that restore is the
 * whole reason this is a module with state rather than two lines in a
 * `useEffect`.
 *
 * NESTING. Two dialogs can be open at once (the download sheet over a
 * confirm), and the second must not restore the scroll position when it
 * closes while the first is still up. So the lock is REFERENCE COUNTED at
 * module scope: the first locker records the offset and freezes, the last
 * unlocker thaws and restores. Anything in between only moves the count.
 */

import { useEffect, useState } from 'react';

let lockCount = 0;
/** The document offset at the moment of the FIRST lock. */
let lockedScrollY = 0;
/** The inline styles the first lock overwrote, so unlock puts them back. */
let saved: {
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  overflowY: string;
} | null = null;

function applyLock() {
  const body = document.body;
  lockedScrollY = window.scrollY || window.pageYOffset || 0;
  saved = {
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    overflowY: body.style.overflowY,
  };
  body.style.position = 'fixed';
  body.style.top = `-${lockedScrollY}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
  // Keeps the scrollbar gutter on a desktop page that had one, so taking the
  // body out of flow does not shift the layout sideways by its width.
  body.style.overflowY = 'scroll';
}

function releaseLock() {
  const body = document.body;
  if (saved) {
    body.style.position = saved.position;
    body.style.top = saved.top;
    body.style.left = saved.left;
    body.style.right = saved.right;
    body.style.width = saved.width;
    body.style.overflowY = saved.overflowY;
    saved = null;
  }
  // `auto`, never `smooth`: this is a restore, not a journey. A smooth scroll
  // here animates the page back from 0 in full view of the reader.
  window.scrollTo({ top: lockedScrollY, left: 0, behavior: 'auto' });
}

/**
 * Lock the page for as long as `locked` is true. Safe to call from several
 * components at once; safe to call with a constant `false`.
 */
export function useScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    if (typeof document === 'undefined') return;

    lockCount += 1;
    if (lockCount === 1) applyLock();

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) releaseLock();
    };
  }, [locked]);
}

/**
 * True below the page's mobile breakpoint. Used to decide whether a surface
 * that is a BOTTOM SHEET on a phone and an ANCHORED MENU on a desktop should
 * lock the page: the sheet is `position: fixed` and immune to the body being
 * taken out of flow, while an anchored menu is laid out against the document
 * and must not have the ground moved under it.
 *
 * `false` on the server and on the first client render, so the markup matches
 * and nothing locks before the media query has been read.
 */
export function useNarrowViewport(maxWidth = 760): boolean {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const read = () => setNarrow(mq.matches);
    read();
    // `addListener` is the Safari < 14 spelling; both are kept because this
    // runs on the exact browsers the audit is about.
    if (mq.addEventListener) {
      mq.addEventListener('change', read);
      return () => mq.removeEventListener('change', read);
    }
    mq.addListener(read);
    return () => mq.removeListener(read);
  }, [maxWidth]);

  return narrow;
}

export default useScrollLock;
