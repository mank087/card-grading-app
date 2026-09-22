'use client';

/**
 * One listing photo, full size (review 2026-09-22, polish).
 *
 * The same dialog pattern as `holders/HolderEnlargeModal` — Escape closes, Tab
 * is trapped inside, focus returns to whatever opened it — over an <img> rather
 * than a rendered composition. It is a separate component rather than a prop on
 * that one because the holder dialog's contract is "a holder and a renderer",
 * and widening it to "or maybe an image" would make both callers read worse.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useScrollLock } from '../useScrollLock';

export interface ListingImageDialogProps {
  /** The object URL to show. Null closes the dialog. */
  src: string | null;
  label: string;
  onClose: () => void;
}

export function ListingImageDialog({ src, label, onClose }: ListingImageDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  // This dialog's open state is its caller's (`InstaListImages`), not the
  // shell's, so it locks the page for itself. See useScrollLock — the lock is
  // reference counted, so opening this over anything else is safe.
  useScrollLock(src !== null);

  const focusables = useCallback((): HTMLElement[] => {
    if (!dialogRef.current) return [];
    return Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null);
  }, []);

  useEffect(() => {
    if (!src) return;
    restoreTo.current = (document.activeElement as HTMLElement) ?? null;
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      restoreTo.current?.focus?.();
    };
  }, [src, onClose, focusables]);

  if (!src) return null;

  return (
    <div
      className="cd-enlarge-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="cd-enlarge-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cd-listing-image-title"
      >
        <div className="cd-showcase-row">
          <h2 id="cd-listing-image-title" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
            {label}
          </h2>
          <button ref={closeRef} type="button" className="cd-quiet" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="cd-enlarge-stage">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="cd-listing-image-full" src={src} alt={`${label} listing photo`} />
        </div>

        <p className="cd-caption">This is the photo as the listing uploads it.</p>
      </div>
    </div>
  );
}

export default ListingImageDialog;
