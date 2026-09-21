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
 *   the composition · a "Holder preview" tag · the holder name · the real
 *   physical label format · the `holderStyleSupport` note when the status is
 *   not `supported` · the holder's download (owner only, opening the EXISTING
 *   DownloadReportButton flow) · Label Studio · the shop links.
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
  HOLDER_FORMATS,
  HOLDER_SHOP_LINKS,
  holderStyleSupport,
  type CardHolderId,
} from '@/lib/cardDetail/holderSupport';
import type { CustomLabelConfig } from '@/lib/labelPresets';

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
}

export function HolderCards({
  labelStyle,
  activeConfig,
  renderComposition,
  renderDownload,
  customizeHref,
  variant = 'compact',
  cardWidth = 160,
}: HolderCardsProps) {
  return (
    <div className="cd-holder-cards">
      {CARD_HOLDERS.map((holder) => {
        const support = holderStyleSupport(holder, labelStyle, activeConfig);
        return (
          <section key={holder} className="cd-holder-card" aria-label={HOLDER_NAMES[holder]}>
            <WhenNear minHeight={Math.round(cardWidth * 1.75)}>
              {renderComposition(holder, cardWidth)}
            </WhenNear>

            {/* Never imply the card physically sits in this holder. */}
            <p className="cd-holder-tag">
              <span>Holder preview</span>
            </p>

            <h4 className="cd-holder-card-name">{HOLDER_NAMES[holder]}</h4>
            <p className="cd-caption">{HOLDER_FORMATS[holder]}</p>

            {support.note && (
              <p className="cd-support-note" data-status={support.status} role="note">
                {support.note}
              </p>
            )}

            <div className="dcm-actions cd-holder-card-actions">
              {renderDownload?.(holder)}
              {variant === 'detail' && customizeHref && (
                <a className="cd-quiet" href={customizeHref(holder)}>
                  Customize in Label Studio
                </a>
              )}
              {/* One entry on the compact card; the detail card names each
                  product, because One-Touch needs two (the holder and its
                  Avery 6871 stock) and two identical links read as a mistake. */}
              {(variant === 'detail'
                ? HOLDER_SHOP_LINKS[holder]
                : HOLDER_SHOP_LINKS[holder].slice(0, 1)
              ).map((link) => (
                <a
                  key={link.href}
                  className="cd-quiet"
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {variant === 'detail' ? link.label : 'Shop this holder & labels'}
                </a>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default HolderCards;
