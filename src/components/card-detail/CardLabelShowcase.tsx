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
 *
 * PHONES (≤760px, Sept 23 review S4). Beside the card a phone keeps ONLY
 * Front/Back, "Zoom & inspect", the design selector and one "Preview holders"
 * link. The zoom caption, "Edit card label", "Customize", the shop row and the
 * visitor sign-in line are hidden there by CSS (`cd-s4-hide`, card-detail.css)
 * — the Labels & holders tab carries Edit and Customize together beside its
 * own design control. Desktop is unchanged.
 *
 * THE DOWNLOAD MENU STAYS MOUNTED ON PHONES. The mobile bar's "Download label"
 * opens THIS instance (`openLabelsSignal`), and its bottom sheet is
 * `position: fixed` INSIDE `#tour-holder-download`. Hiding that wrapper would
 * take the sheet with it, so only the menu's visible TRIGGERS are hidden
 * (`.cd-hero-download`, card-detail.css); the sheet still renders.
 */

import { useState, type ReactNode } from 'react';
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
  /** Owner-only: turn the shown side's photo 90° clockwise for display (Oct 2026). */
  onRotate?: (side: CardSide) => Promise<void>;
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
  onRotate,
  isOwner,
  customizeHref,
  formatNote,
  shopHref = '/shop',
}: CardLabelShowcaseProps) {
  const [rotating, setRotating] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const image = side === 'front' ? vm.images.front : vm.images.back;
  const sideLabel = side === 'front' ? 'Front' : 'Back';
  const alt = `${vm.identity.displayName} card ${side}`;

  return (
    <div id="tour-card-images" className="cd-showcase cd-hero-showcase">
      <p className="cd-eyebrow">Your card</p>

      <div className="cd-stage cd-stage--piece">{renderCardPiece({ side })}</div>

      {/* Legacy's caption under each slab (3038, 3231). */}
      <p className="cd-caption cd-s4-hide" style={{ textAlign: 'center', margin: 0 }}>
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
        {isOwner && onRotate && image.present && (
          <button
            type="button"
            className="cd-quiet"
            disabled={rotating}
            aria-label={`Rotate the ${side} photo 90 degrees clockwise`}
            title="Rotate this photo (shows everywhere the card appears)"
            onClick={async () => {
              setRotating(true);
              setRotateError(null);
              try { await onRotate(side); }
              catch (e: any) { setRotateError(e?.message || 'Could not turn the photo.'); }
              finally { setRotating(false); }
            }}
          >
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px', marginRight: 4 }}>
              <path d="M4 10a6 6 0 0 1 10.2-4.3L16 7.5" /><path d="M16 3.5v4h-4" /><path d="M16 10a6 6 0 0 1-10.2 4.3L4 12.5" /><path d="M4 16.5v-4h4" />
            </svg>
            {rotating ? 'Turning…' : 'Rotate'}
          </button>
        )}
      </div>
      {rotateError && <p className="cd-caption" role="alert" style={{ textAlign: 'center', margin: 0 }}>{rotateError}</p>}

      <div className="cd-showcase-row">
        <div>{styleControl}</div>
        <div className="dcm-actions cd-s4-hide" style={{ gap: 8 }}>
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

      {isOwner && (
        <div id="tour-holder-download" className="cd-hero-download">
          {downloadAction}
        </div>
      )}

      <div className="cd-showcase-row cd-s4-hide">
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
