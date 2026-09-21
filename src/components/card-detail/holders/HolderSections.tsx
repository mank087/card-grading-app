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
import { LabelStyleDropdown } from '@/components/labels/LabelStyleDropdown';
import type { SavedCustomStyle, CustomLabelConfig } from '@/lib/labelPresets';
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
        Previews built from your own photos and your saved label design &mdash; not a claim about
        where the card is kept.
      </p>
      {cardsFor(props, 'compact', 160)}
    </section>
  );
}

export function LabelsHoldersSection(
  props: HolderSectionCommonProps & {
    customStyles: SavedCustomStyle[];
    onSwitchStyle: (id: LabelStyleId) => void;
    onEditLabelText: () => void;
  },
) {
  return (
    <div className="cd-section">
      <div className="cd-section-title">
        <p className="cd-eyebrow">Designed to go with your card</p>
        <h2>Pick a design. Print your label.</h2>
        <p>
          Your saved style follows the card everywhere it is printed. Each holder below shows what
          it can actually reproduce.
        </p>
      </div>

      <section className="cd-panel">
        <p className="cd-eyebrow">Label design</p>
        <LabelStyleDropdown
          labelStyle={props.labelStyle}
          customStyles={props.customStyles}
          onSwitch={props.onSwitchStyle}
        />
        <p className="cd-caption" style={{ marginTop: 12 }}>
          Switching here updates your account&rsquo;s label style, exactly as the current page
          does. It does not claim this card sits in any particular holder.
        </p>
        <div className="dcm-actions" style={{ marginTop: 16 }}>
          {props.isOwner && (
            <button type="button" className="cd-quiet" onClick={props.onEditLabelText}>
              Edit this card&rsquo;s label text
            </button>
          )}
          {/* Label Studio preselects by SERIAL, not by card id (gap G3);
              holder / style / return are the new optional params. */}
          <a className="cd-quiet" href={props.labelStudioHref()}>
            Customize in Label Studio
          </a>
        </div>
      </section>

      <section className="cd-panel" style={{ marginTop: 16 }}>
        <p className="cd-eyebrow">Holder previews</p>
        <h3 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 4px' }}>
          Your card in each holder.
        </h3>
        <p className="cd-caption" style={{ marginBottom: 14 }}>
          Compositions of your own photos and label. Each one names the print format it produces,
          and says so when a holder cannot reproduce your design exactly.
        </p>
        {cardsFor(props, 'detail', 190)}
      </section>
    </div>
  );
}
