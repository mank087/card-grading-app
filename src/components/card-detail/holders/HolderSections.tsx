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
 * composition. Nothing here owns state: the selected holder (S3, phones) is
 * the shell's, passed through to `HolderCards`.
 */

import type { ReactNode } from 'react';
import type { CustomLabelConfig } from '@/lib/labelPresets';
import type { LabelStyleId } from '@/hooks/useCustomLabelStyle';
import type { CardHolderId } from '@/lib/cardDetail/holderSupport';
import HolderCards from './HolderCards';
import SectionTitle from '../SectionTitle';
import { HOLDER_BAND_ID } from './useGoToHolder';

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
  /**
   * The ONE selected holder (S3), owned by the shell and shared by the
   * Overview band, the Labels tab and the hero's entry points. A phone shows
   * only that holder; a desktop shows all three and ignores it for layout.
   */
  selectedHolder?: CardHolderId;
  onSelectHolder?: (holder: CardHolderId) => void;
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
      selectedHolder={props.selectedHolder}
      onSelectHolder={props.onSelectHolder}
    />
  );
}

export function OverviewHoldersBand(
  props: HolderSectionCommonProps & { onSeeAll: () => void },
) {
  return (
    // The anchor the hero's phone-width "Preview holders" link scrolls to and
    // focuses (S4, useGoToHolder). tabIndex -1 makes it focusable by script
    // only; it never joins the Tab order.
    <section
      id={HOLDER_BAND_ID}
      className="cd-panel cd-holders-band"
      style={{ marginTop: 20 }}
      tabIndex={-1}
      aria-labelledby={`${HOLDER_BAND_ID}-h`}
    >
      <div className="cd-showcase-row">
        <div>
          <p className="cd-eyebrow">Labels &amp; holders</p>
          <h3 id={`${HOLDER_BAND_ID}-h`} style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>
            See it in a holder.
          </h3>
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
    <div className="cd-section cd-labels-section">
      {/* On a phone the eyebrow and lead line are hidden and the one short
          heading "Labels & holders" shows instead (Phase 4, H), so the holder
          sits almost directly under the design controls. The visitor line
          stays.

          A visitor is not being offered a print: there is no download control
          for them anywhere on this tab, and a heading that says "print your
          label" with nothing to press is a dead end. One line says whose label
          it is instead (review 2026-09-22). */}
      <SectionTitle
        className="cd-labels-intro"
        eyebrow="Designed to go with your card"
        title={props.isOwner ? 'Pick a design. Print your label.' : 'Pick a design.'}
        phoneTitle="Labels & holders"
        lead="Each design below is shown in every holder we print for, at the size it prints."
      >
        {!props.isOwner && (
          <p className="cd-caption">Only the card&rsquo;s owner can download this label.</p>
        )}
      </SectionTitle>

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

      <section className="cd-panel cd-labels-holders" style={{ marginTop: 16 }}>
        <p className="cd-eyebrow">Every holder we print for</p>
        <h3 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 4px' }}>
          Your card in each holder.
        </h3>
        <p className="cd-caption cd-labels-holders-lead" style={{ marginBottom: 14 }}>
          Each one names the stock and the size it prints at, and says so when a holder cannot
          show the design exactly.
        </p>
        {cardsFor(props, 'detail', 260)}
      </section>
    </div>
  );
}
