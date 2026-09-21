'use client';

/**
 * The two places the holder cards appear.
 *
 *  - `OverviewHoldersBand` — a band in the Overview tab, below the "Why this
 *    grade" block and above the card facts. Compact cards.
 *  - `LabelsHoldersSection` — the whole body of the Labels & holders tab: the
 *    style picker, then the three holders in fuller form (format, support
 *    note, download, Label Studio, named supplies).
 *
 * They live here rather than inline in `CardDetailShell` so the shell keeps to
 * composition. Nothing here owns state.
 */

import type { ReactNode } from 'react';
import type { CustomLabelConfig } from '@/lib/labelPresets';
import type { LabelStyleId } from '@/hooks/useCustomLabelStyle';
import type { CardHolderId } from '@/lib/cardDetail/holderSupport';
import HolderCards from './HolderCards';

/** Everything both sections need, assembled once by the shell. */
export interface HolderSectionCommonProps {
  labelStyle: LabelStyleId;
  activeConfig: CustomLabelConfig | null;
  isOwner: boolean;
  labelStudioHref: (holder?: CardHolderId) => string;
  renderHolderDownload?: (holder: CardHolderId) => ReactNode;
  /** Injected by the shell so this file never imports next/dynamic itself. */
  renderComposition: (holder: CardHolderId, maxWidth: number) => ReactNode;
  /** Opens the shell's enlarge modal on one holder. */
  onEnlarge: (holder: CardHolderId) => void;
}

function cardsFor(
  props: HolderSectionCommonProps,
  variant: 'compact' | 'detail',
  cardWidth: number,
) {
  return (
    <HolderCards
      labelStyle={props.labelStyle}
      activeConfig={props.activeConfig}
      renderComposition={props.renderComposition}
      renderDownload={
        props.isOwner && props.renderHolderDownload
          ? (which) => props.renderHolderDownload!(which)
          : undefined
      }
      customizeHref={(which) => props.labelStudioHref(which)}
      variant={variant}
      cardWidth={cardWidth}
      onEnlarge={props.onEnlarge}
    />
  );
}

export function OverviewHoldersBand(
  props: HolderSectionCommonProps & { onSeeAll: () => void },
) {
  return (
    <section className="cd-panel" style={{ marginTop: 20 }}>
      <div className="cd-showcase-row">
        <div>
          <p className="cd-eyebrow">Labels &amp; holders</p>
          <h3 style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>See it in a holder.</h3>
        </div>
        <button type="button" className="cd-quiet" onClick={props.onSeeAll}>
          All label options
        </button>
      </div>
      <p className="cd-caption" style={{ marginTop: 8 }}>
        Built from this card&rsquo;s photos and the label design shown above. Enlarge any of them
        for a closer look.
      </p>
      {cardsFor(props, 'compact', 230)}
    </section>
  );
}

export function LabelsHoldersSection(
  props: HolderSectionCommonProps & {
    /** The shared preview selector, rendered by the shell. */
    styleControl: ReactNode;
    onEditLabelText: () => void;
    viewerSignedIn: boolean;
  },
) {
  return (
    <div className="cd-section">
      <div className="cd-section-title">
        <p className="cd-eyebrow">Designed to go with your card</p>
        <h2>Pick a design. Print your label.</h2>
        <p>Each holder below shows what it can actually reproduce, and at what size.</p>
      </div>

      {/* One panel: the design chooser and what it applies to. The selector
          previews; saving a default is its own explicit action inside it. */}
      <section className="cd-panel">
        {props.styleControl}
        <div className="dcm-actions" style={{ marginTop: 16 }}>
          {props.isOwner && (
            <button type="button" className="cd-quiet" onClick={props.onEditLabelText}>
              Edit this card&rsquo;s label text
            </button>
          )}
          {/* Label Studio preselects by SERIAL, not by card id (gap G3);
              holder / style / return are the new optional params. */}
          {props.viewerSignedIn && (
            <a className="cd-quiet" href={props.labelStudioHref()}>
              Customize in Label Studio
            </a>
          )}
        </div>
      </section>

      <section className="cd-panel" style={{ marginTop: 16 }}>
        <p className="cd-eyebrow">Digital holder previews</p>
        <h3 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 4px' }}>
          Your card in each holder.
        </h3>
        <p className="cd-caption" style={{ marginBottom: 14 }}>
          Each one names the stock and the size it prints at, and says so when a holder cannot
          reproduce the design exactly.
        </p>
        {cardsFor(props, 'detail', 260)}
      </section>
    </div>
  );
}
