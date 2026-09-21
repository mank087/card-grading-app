'use client';

/**
 * The hero's left column: the card WITH its label, plus the label actions.
 *
 * Renamed from `CardHolderShowcase` on 2026-09-21. The hero deliberately does
 * NOT show a holder: it shows what the legacy page shows today — the owner's
 * label composed directly above the card photo in the slab-style frame
 * (`CardLabelPiece`, lifted from pokemon CardDetailClient 2884-3232). The
 * three holder previews live lower on the page, in the Overview band and the
 * Labels & holders tab, where a "Holder preview" tag belongs.
 *
 * WHAT IS HERE
 *   - the composed label + card piece, Front/Back switched together (front
 *     label over front photo, back label over back photo, as legacy);
 *   - Zoom of the ORIGINAL photos, unchanged — the zoom modal always opens
 *     `vm.images.*.url`, never the composition;
 *   - the existing `LabelStyleDropdown` with the same persistence as legacy;
 *   - the owner's "Edit card label" entry and a "Customize" link into Label
 *     Studio;
 *   - the existing general `DownloadReportButton` (labels + reports menus),
 *     passed in whole by the shell — this component generates nothing;
 *   - a shop link.
 *
 * It renders no holder chrome and holds no holder state.
 */

import type { ReactNode } from 'react';
import type { CardDetailViewModel } from '@/lib/cardDetail/viewModel';

export type CardSide = 'front' | 'back';

export interface CardLabelShowcaseProps {
  vm: CardDetailViewModel;
  side: CardSide;
  onSideChange: (side: CardSide) => void;
  /** Opens the shared ImageZoomModal the shell owns, on the ORIGINAL photo. */
  onZoom: (imageUrl: string, alt: string, title: string) => void;

  /**
   * The shared label-style control, built by the shell (`LabelPreviewControls`).
   * It PREVIEWS: changing it re-renders every label on this page and writes
   * nothing to the account. Saving a default is a separate action inside it,
   * and only an owner sees that.
   */
  styleControl: ReactNode;
  /** The "see it in a holder" entry strip, rendered under the showcase. */
  holderEntry?: ReactNode;

  /** The composed label + card piece for the selected side. */
  renderCardPiece: (context: { side: CardSide }) => ReactNode;

  /** The existing general DownloadReportButton, mounted by the adapter. */
  downloadAction: ReactNode;
  /** Owner-only "Edit Card Label" entry, wired to EditCardLabelModal. */
  onEditLabel?: () => void;
  isOwner: boolean;

  /** "Customize" entry into Label Studio, carrying style and return target. */
  customizeHref?: string;
  /** Caption under the download action. */
  formatNote?: string;
  shopHref?: string;
}

export function CardLabelShowcase({
  vm,
  side,
  onSideChange,
  onZoom,
  styleControl,
  holderEntry,
  renderCardPiece,
  downloadAction,
  onEditLabel,
  isOwner,
  customizeHref,
  formatNote,
  shopHref = '/shop',
}: CardLabelShowcaseProps) {
  const image = side === 'front' ? vm.images.front : vm.images.back;
  const sideLabel = side === 'front' ? 'Front' : 'Back';
  const alt = `${vm.identity.displayName} card ${side}`;

  return (
    <div id="tour-card-images" className="cd-showcase cd-hero-showcase">
      <p className="cd-eyebrow">Your card</p>

      <div className="cd-stage cd-stage--piece">{renderCardPiece({ side })}</div>

      {/* Legacy's caption under each slab (3038, 3231). */}
      <p className="cd-caption" style={{ textAlign: 'center', margin: 0 }}>
        Click the photo to zoom.
      </p>

      <div className="cd-showcase-row">
        <div className="cd-side-switch" role="group" aria-label="Choose which side to show">
          <button
            type="button"
            aria-pressed={side === 'front'}
            onClick={() => onSideChange('front')}
          >
            Front
          </button>
          <button
            type="button"
            aria-pressed={side === 'back'}
            onClick={() => onSideChange('back')}
            disabled={!vm.images.back.present}
            title={vm.images.back.present ? undefined : 'No back photo on file'}
          >
            Back
          </button>
        </div>
        {image.present && image.url && (
          <button
            type="button"
            className="cd-quiet"
            onClick={() => onZoom(image.url as string, alt, `Card ${sideLabel} — full size`)}
          >
            Zoom &amp; inspect
          </button>
        )}
      </div>

      <div className="cd-showcase-row">
        <div>{styleControl}</div>
        <div className="dcm-actions" style={{ gap: 8 }}>
          {isOwner && onEditLabel && (
            <button type="button" className="cd-quiet" onClick={onEditLabel}>
              Edit card label
            </button>
          )}
          {/* Label Studio is a signed-in surface; only offer it to an owner. */}
          {isOwner && customizeHref && (
            <a className="cd-quiet" href={customizeHref}>
              Customize
            </a>
          )}
        </div>
      </div>

      {isOwner && <div id="tour-holder-download">{downloadAction}</div>}

      <div className="cd-showcase-row">
        {/* Only the owner has a download menu on this page, so only the owner
            is told where it is. A visitor was being pointed at a control that
            was not rendered for them at all. */}
        <span className="cd-caption">
          {formatNote ??
            (isOwner
              ? 'Printable slab, toploader and One-Touch labels are in the download menu above.'
              : 'Slab, toploader and One-Touch label designs are shown further down the page.')}
        </span>
        <a
          className="dcm-button dcm-button--text"
          href={shopHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          Shop holders &amp; labels
        </a>
      </div>

      {holderEntry}
    </div>
  );
}

export default CardLabelShowcase;
