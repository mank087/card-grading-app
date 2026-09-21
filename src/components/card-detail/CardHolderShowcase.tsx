'use client';

/**
 * The hero's left column: the card itself, plus the label/print actions that
 * hang off it.
 *
 * ── PHASE 1 SCOPE ────────────────────────────────────────────────────────
 * What is here now: the front/back photos with a side toggle and zoom, the
 * existing `LabelStyleDropdown`, the existing `DownloadReportButton` (passed
 * in whole by the shell — this component generates nothing), the owner's
 * "Edit Card Label" entry, and a shop link.
 *
 * What is NOT here, by instruction: the slab / top loader / One-Touch holder
 * switcher and the composed holder artwork. That is PHASE 2, and it is the
 * biggest piece of new engineering in the project (plan gap G1: `LabelMockup`
 * honours `labelImages` only for the One-Touch and Toploader mockups, so a
 * Heritage or saved-custom slab cannot be composited today).
 *
 * ── THE PHASE 2 SEAM ─────────────────────────────────────────────────────
 * Phase 2 drops in without restructuring this file or the shell:
 *
 *   `holder` / `onHolderChange`  — when both are supplied the switcher renders
 *                                  above the stage. Phase 1 passes neither, so
 *                                  no switcher appears.
 *   `renderHolder`               — replaces the plain image stage with the
 *                                  composed holder for the selected side. It
 *                                  receives the side and the holder so the
 *                                  composition owns its own layout.
 *   `holderFormatNote` / `shopHref` — the "active format / dimensions" line and
 *                                  its contextual shop link, which Phase 2
 *                                  makes holder-specific.
 *
 * Nothing above the seam knows about holders, which is why Phase 2 is a change
 * to this component's callers rather than to its callers' layout.
 */

import type { ReactNode } from 'react';
import Image from 'next/image';
import type { SavedCustomStyle } from '@/lib/labelPresets';
import type { LabelStyleId } from '@/hooks/useCustomLabelStyle';
import { LabelStyleDropdown } from '@/components/labels/LabelStyleDropdown';
import type { CardDetailViewModel } from '@/lib/cardDetail/viewModel';

/** Phase 2 holder ids. Declared now so the seam is typed, not stringly. */
export type CardHolderId = 'slab' | 'toploader' | 'onetouch';

export type CardSide = 'front' | 'back';

export interface CardHolderShowcaseProps {
  vm: CardDetailViewModel;
  side: CardSide;
  onSideChange: (side: CardSide) => void;
  /** Opens the shared ImageZoomModal the shell owns. */
  onZoom: (imageUrl: string, alt: string, title: string) => void;

  /* Label style — the SAME props and persistence semantics as legacy:
     `useCustomLabelStyleWithOrg(card.org_id)` in the shell's caller, whose
     `switchStyle` writes the account-wide preference. Previewing a style on
     this page changes the account style exactly as it does today; per-card
     persistence is explicitly out of scope. */
  labelStyle: LabelStyleId;
  customStyles: SavedCustomStyle[];
  onSwitchStyle: (id: LabelStyleId) => void;

  /** The existing DownloadReportButton, mounted by the adapter. Owner-only. */
  downloadAction: ReactNode;
  /** Owner-only "Edit Card Label" entry, wired to EditCardLabelModal. */
  onEditLabel?: () => void;
  isOwner: boolean;

  /* ── Phase 2 seam (all optional; Phase 1 passes none of them) ── */
  holder?: CardHolderId;
  onHolderChange?: (holder: CardHolderId) => void;
  renderHolder?: (context: { side: CardSide; holder: CardHolderId }) => ReactNode;
  holderFormatNote?: string;
  shopHref?: string;
}

const HOLDER_LABELS: Record<CardHolderId, string> = {
  slab: 'Graded slab',
  toploader: 'Top loader',
  onetouch: 'One-Touch',
};

export function CardHolderShowcase({
  vm,
  side,
  onSideChange,
  onZoom,
  labelStyle,
  customStyles,
  onSwitchStyle,
  downloadAction,
  onEditLabel,
  isOwner,
  holder,
  onHolderChange,
  renderHolder,
  holderFormatNote,
  shopHref = '/shop',
}: CardHolderShowcaseProps) {
  const image = side === 'front' ? vm.images.front : vm.images.back;
  const sideLabel = side === 'front' ? 'Front' : 'Back';
  const alt = `${vm.identity.displayName} card ${side}`;
  const showSwitcher = !!holder && !!onHolderChange;

  return (
    <div id="tour-card-images" className="cd-showcase cd-hero-showcase">
      <p className="cd-eyebrow">Your card</p>

      {showSwitcher && (
        <div className="cd-side-switch" role="group" aria-label="Choose a holder">
          {(Object.keys(HOLDER_LABELS) as CardHolderId[]).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={holder === id}
              onClick={() => onHolderChange?.(id)}
            >
              {HOLDER_LABELS[id]}
            </button>
          ))}
        </div>
      )}

      <div className="cd-stage">
        {renderHolder && holder ? (
          renderHolder({ side, holder })
        ) : image.present && image.url ? (
          <button
            type="button"
            className="cd-stage-button"
            onClick={() => onZoom(image.url as string, alt, `Card ${sideLabel} — full size`)}
            aria-label={`Zoom the card ${side} image`}
          >
            <Image
              src={image.url}
              alt={alt}
              width={400}
              height={560}
              priority={side === 'front'}
              style={{ width: '100%', height: 'auto' }}
            />
          </button>
        ) : (
          // Intentional missing-image state. The prototype had no back image
          // and production rows can be missing either side; say so rather than
          // rendering a broken <img> or an empty box.
          <p className="cd-missing-image">
            <strong>No {side} photo on file</strong>
            <span>
              This card was graded without a {side} image, or the photo did not finish
              uploading.
            </span>
          </p>
        )}
      </div>

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

      {/* Same component, same props and same persistence as the legacy header. */}
      <div className="cd-showcase-row">
        <div>
          <p className="cd-eyebrow" style={{ marginBottom: 6 }}>
            Label design
          </p>
          <LabelStyleDropdown
            labelStyle={labelStyle}
            customStyles={customStyles}
            onSwitch={onSwitchStyle}
          />
        </div>
        {isOwner && onEditLabel && (
          <button type="button" className="cd-quiet" onClick={onEditLabel}>
            Edit card label
          </button>
        )}
      </div>

      {isOwner && downloadAction}

      <div className="cd-showcase-row">
        <span className="cd-caption">
          {holderFormatNote ?? 'Printable slab, toploader and One-Touch labels are in the download menu.'}
        </span>
        <a className="dcm-button dcm-button--text" href={shopHref} target="_blank" rel="noopener noreferrer">
          Shop holders &amp; labels
        </a>
      </div>
    </div>
  );
}

export default CardHolderShowcase;
