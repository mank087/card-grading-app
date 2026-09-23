'use client';

/**
 * A titled dialog for the owner's management rows (Sept 23 review, O4): a
 * bottom sheet on a phone, a centred dialog on a wider screen.
 *
 * The same pattern as `holders/HolderEnlargeModal` — Escape closes, Tab is
 * trapped inside, focus goes to Close on open and back to the opener on close
 * — and the same backdrop, so the page has one dialog look. The page is held
 * still by the SHELL's `useScrollLock`: the caller reports `open` upward and
 * the shell counts it among its modals, which also stands the mobile action
 * bar down behind it.
 *
 * `keepMounted` keeps the children mounted (and the dialog `hidden`) while it
 * is closed. The binder picker needs that: it loads its own binders once, on
 * mount, and reports them to the row that opens it — unmounting it on close
 * would refetch on every open and leave the row unlabelled.
 */

import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';

export interface CardDetailSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  keepMounted?: boolean;
}

export function CardDetailSheet({
  open,
  title,
  onClose,
  children,
  keepMounted = false,
}: CardDetailSheetProps) {
  const titleId = `cd-sheet-${useId()}`;
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  // Read through a ref so a caller's inline `onClose` does not re-run the
  // effect below on every render — that would bounce focus back to Close
  // each time something inside the sheet re-rendered (a binder toggle).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const focusables = useCallback((): HTMLElement[] => {
    if (!dialogRef.current) return [];
    return Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null);
  }, []);

  useEffect(() => {
    if (!open) return;
    restoreTo.current = (document.activeElement as HTMLElement) ?? null;
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
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
      } else if (!dialogRef.current?.contains(document.activeElement)) {
        // Focus escaped (a click on the backdrop edge): bring it back in.
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      restoreTo.current?.focus?.();
    };
  }, [open, focusables]);

  if (!open && !keepMounted) return null;

  return (
    <div
      className="cd-enlarge-backdrop cd-sheet-backdrop"
      role="presentation"
      hidden={!open}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="cd-enlarge-dialog cd-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="cd-showcase-row">
          <h2 id={titleId} className="cd-sheet-title">
            {title}
          </h2>
          <button ref={closeRef} type="button" className="cd-quiet" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="cd-sheet-body">{children}</div>
      </div>
    </div>
  );
}

export default CardDetailSheet;
