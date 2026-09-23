'use client';

/**
 * The three holder previews — "this card, in each holder, with your label".
 *
 * They hold NO selection state of their own. On a phone the SHELL's selected
 * holder (S3) decides which one card shows; on a desktop all three show and
 * each card is a self-contained preview plus its own actions. Front/back is
 * the mockup's own internal toggle (`LabelMockup` renders it whenever the
 * caller does not control `side`), which costs nothing extra.
 *
 * Each card carries, in order:
 *   the composition · an "Enlarge" text link under the mockup's own Front/Back
 *   toggle · the holder name · the real physical label format · the
 *   `holderStyleSupport` note when the status is not `supported` · the
 *   holder's download (owner only, opening the EXISTING DownloadReportButton
 *   flow) · the shop link · Label Studio (detail variant only).
 *
 * NO "Digital holder preview" TAG (owner review, 2026-09-22 item 11). The
 * section's own one-line lead-in already says where these pictures come from;
 * a badge on every card repeated it three times over.
 *
 * CHEAP BY CONSTRUCTION
 *  - a card's composition mounts only once it is near the viewport
 *    (IntersectionObserver), so the hero's first paint is never blocked and a
 *    reader who stays at the top never renders a Heritage Compact canvas;
 *  - the shell loads the composition module itself through `next/dynamic`;
 *  - the holder photos inside `LabelMockup` are already `loading="lazy"`.
 */

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  CARD_HOLDERS,
  HOLDER_NAMES,
  HOLDER_LABEL_STOCK,
  HOLDER_SHOP_LINKS,
  holderStyleSupport,
  type CardHolderId,
} from '@/lib/cardDetail/holderSupport';
import { resolveEffectiveLabelSize } from '@/lib/cardDetail/labelSize';
import type { CustomLabelConfig } from '@/lib/labelPresets';

/** The DOM id a holder's card carries, so the hero strip can jump to it. */
export const holderCardAnchorId = (holder: CardHolderId) => `cd-holder-${holder}`;

/** Mounts its children once they are within 300px of the viewport. */
function WhenNear({ children, minHeight }: { children: ReactNode; minHeight: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ minHeight }}>
      {near ? children : null}
    </div>
  );
}

/**
 * PHONES ONLY (Sept 23 mobile review, S3): the width ONE selected holder gets
 * — the whole row, less the card's own padding and border — so the single
 * preview is visibly larger than the stacked ones were. Null on a desktop,
 * where every card keeps the caller's `cardWidth` exactly as before.
 */
function usePhoneCardWidth(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el || typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 760px)');
    const read = () => {
      if (!mq.matches) {
        setWidth(null);
        return;
      }
      // The selected card is flush with the row on a phone (card-detail.css),
      // so the preview may use the row's full content width, capped so a
      // large phone does not get a preview taller than its screen.
      const next = Math.min(340, Math.floor(el.clientWidth));
      setWidth((prev) => (prev === next ? prev : next > 0 ? next : null));
    };
    read();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(read) : null;
    ro?.observe(el);
    mq.addEventListener?.('change', read);
    return () => {
      ro?.disconnect();
      mq.removeEventListener?.('change', read);
    };
  }, [enabled]);

  return { ref, width };
}

/**
 * The phone-only "Slab | Top loader | One-Touch" control (S3). A radio group:
 * one holder is chosen at a time and the choice persists across the Overview
 * band, the Labels tab and the hero's entry points, which the shell owns.
 * Roving tabindex; the arrow keys, Home and End move AND select, as a native
 * radio group does. Hidden by CSS above 760px.
 */
function HolderPicker({
  selected,
  onSelect,
}: {
  selected: CardHolderId;
  onSelect: (holder: CardHolderId) => void;
}) {
  const groupRef = useRef<HTMLDivElement>(null);

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = CARD_HOLDERS.indexOf(selected);
    let next = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % CARD_HOLDERS.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
      next = (index - 1 + CARD_HOLDERS.length) % CARD_HOLDERS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = CARD_HOLDERS.length - 1;
    else return;
    event.preventDefault();
    const holder = CARD_HOLDERS[next];
    onSelect(holder);
    groupRef.current
      ?.querySelector<HTMLButtonElement>(`[data-holder="${holder}"]`)
      ?.focus();
  };

  return (
    <div
      ref={groupRef}
      className="cd-holder-picker"
      role="radiogroup"
      aria-label="Holder to preview"
      onKeyDown={move}
    >
      {CARD_HOLDERS.map((holder) => (
        <button
          key={holder}
          type="button"
          role="radio"
          data-holder={holder}
          aria-checked={selected === holder}
          aria-controls={holderCardAnchorId(holder)}
          tabIndex={selected === holder ? 0 : -1}
          onClick={() => onSelect(holder)}
        >
          {HOLDER_SHORT_NAMES[holder]}
        </button>
      ))}
    </div>
  );
}

/** The segmented control's wording — the owner's "Slab | Top loader | One-Touch". */
const HOLDER_SHORT_NAMES: Record<CardHolderId, string> = {
  slab: 'Slab',
  toploader: 'Top loader',
  onetouch: 'One-Touch',
};

export interface HolderCardsProps {
  labelStyle: string | null | undefined;
  activeConfig: CustomLabelConfig | null;
  /** The composition for one holder, supplied by the shell. */
  renderComposition: (holder: CardHolderId, maxWidth: number) => ReactNode;
  /** Owner-only holder download trigger. Omitted for a visitor. */
  renderDownload?: (holder: CardHolderId) => ReactNode;
  /** A Label Studio link for this holder; only shown in the detail variant. */
  customizeHref?: (holder: CardHolderId) => string;
  /** "detail" names each shop product and adds the Label Studio entry. */
  variant?: 'compact' | 'detail';
  cardWidth?: number;
  /** Opens this holder's composition in the shell's enlarge modal. */
  onEnlarge?: (holder: CardHolderId) => void;
  /**
   * PHONES ONLY (S3). The holder the shell has selected, and the setter. With
   * both, a phone shows the "Slab | Top loader | One-Touch" control and ONLY
   * the selected card, larger. A desktop renders all three side by side and
   * ignores the selection for layout. Absent: every width is unchanged.
   */
  selectedHolder?: CardHolderId;
  onSelectHolder?: (holder: CardHolderId) => void;
}

export function HolderCards({
  labelStyle,
  activeConfig,
  renderComposition,
  renderDownload,
  customizeHref,
  variant = 'compact',
  cardWidth = 160,
  onEnlarge,
  selectedHolder,
  onSelectHolder,
}: HolderCardsProps) {
  const single = selectedHolder !== undefined && onSelectHolder !== undefined;
  const phone = usePhoneCardWidth(single);
  const width = phone.width ?? cardWidth;

  return (
    <>
      {selectedHolder !== undefined && onSelectHolder && (
        <HolderPicker selected={selectedHolder} onSelect={onSelectHolder} />
      )}
      <div
        ref={phone.ref}
        className="cd-holder-cards"
        data-single={single ? 'true' : undefined}
      >
        {CARD_HOLDERS.map((holder) => {
          const support = holderStyleSupport(holder, labelStyle, activeConfig);
          // The size the holder's download ACTUALLY produces for this style —
          // not a fixed 2.8" x 0.8" for every slab. See lib/cardDetail/labelSize.
          const size = resolveEffectiveLabelSize(holder, labelStyle, activeConfig);
          return (
            <section
              key={holder}
              id={holderCardAnchorId(holder)}
              className="cd-holder-card"
              aria-label={HOLDER_NAMES[holder]}
              tabIndex={-1}
              data-selected={single && selectedHolder === holder ? 'true' : undefined}
            >
              <WhenNear minHeight={Math.round(width * 1.75)}>
                {renderComposition(holder, width)}
              </WhenNear>

              {/* Directly under the mockup's own Front/Back toggle, and a text
                  link rather than a button: enlarging is a second look, not an
                  action that competes with download and shop. */}
              {onEnlarge && (
                <button
                  type="button"
                  className="cd-enlarge-link"
                  onClick={() => onEnlarge(holder)}
                >
                  Enlarge
                </button>
              )}

              <div className="cd-holder-card-body">
                <h4 className="cd-holder-card-name">{HOLDER_NAMES[holder]}</h4>
                <p className="cd-caption">
                  {HOLDER_LABEL_STOCK[holder]} &middot; {size.formatted}
                </p>

                {size.note && (
                  <p className="cd-support-note" data-status={size.status} role="note">
                    {size.note}
                  </p>
                )}

                {support.note && (
                  <p className="cd-support-note" data-status={support.status} role="note">
                    {support.note}
                  </p>
                )}
              </div>

              <div className="dcm-actions cd-holder-card-actions">
                {renderDownload?.(holder)}
                {/* One shop entry per holder, with the wording the owner asked
                    for, in BOTH the Overview band and the Labels & holders tab. */}
                {HOLDER_SHOP_LINKS[holder].map((link) => (
                  <a
                    key={link.href}
                    className="cd-holder-shop-link"
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {link.label}
                  </a>
                ))}
                {variant === 'detail' && customizeHref && (
                  <a className="cd-quiet cd-holder-customize" href={customizeHref(holder)}>
                    Customize in Label Studio
                  </a>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

export default HolderCards;
