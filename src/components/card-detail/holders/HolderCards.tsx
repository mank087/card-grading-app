'use client';

/**
 * The three holder previews — "this card, in each holder, with your label".
 *
 * Nothing in the hero depends on these, so they carry NO selection state:
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

import { useEffect, useRef, useState, type ReactNode } from 'react';
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
}: HolderCardsProps) {
  return (
    <div className="cd-holder-cards">
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
          >
            <WhenNear minHeight={Math.round(cardWidth * 1.75)}>
              {renderComposition(holder, cardWidth)}
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
  );
}

export default HolderCards;
