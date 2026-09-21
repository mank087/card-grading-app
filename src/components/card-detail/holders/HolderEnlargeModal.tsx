'use client';

/**
 * One holder composition, large (review item G).
 *
 * The band's previews are small enough to be a thumbnail rather than a look at
 * the thing, so each card offers "Enlarge" and this opens the same
 * composition at a size worth inspecting. It renders the SAME node the card
 * does — the shell passes `renderComposition` — so nothing here can drift from
 * what the page shows.
 *
 * Keyboard: Escape closes, Tab is trapped inside, and focus returns to the
 * element that opened it.
 */

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { HOLDER_NAMES, type CardHolderId } from '@/lib/cardDetail/holderSupport';

export interface HolderEnlargeModalProps {
  holder: CardHolderId | null;
  onClose: () => void;
  renderComposition: (holder: CardHolderId, maxWidth: number) => ReactNode;
  /** The physical format this holder prints, shown under the composition. */
  formatLine?: string;
  note?: string | null;
}

const LARGE_WIDTH = 420;

export function HolderEnlargeModal({
  holder,
  onClose,
  renderComposition,
  formatLine,
  note,
}: HolderEnlargeModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  const focusables = useCallback((): HTMLElement[] => {
    if (!dialogRef.current) return [];
    return Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null);
  }, []);

  useEffect(() => {
    if (!holder) return;
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
  }, [holder, onClose, focusables]);

  if (!holder) return null;

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
        aria-labelledby="cd-enlarge-title"
      >
        <div className="cd-showcase-row">
          <h2 id="cd-enlarge-title" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
            {HOLDER_NAMES[holder]} — digital holder preview
          </h2>
          <button ref={closeRef} type="button" className="cd-quiet" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="cd-enlarge-stage">{renderComposition(holder, LARGE_WIDTH)}</div>

        {formatLine && <p className="cd-caption">{formatLine}</p>}
        {note && (
          <p className="cd-support-note" role="note">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}

export default HolderEnlargeModal;
