'use client';

/**
 * The card WITH its label, as one composed piece — no holder.
 *
 * This is the hero presentation the owner already likes on the legacy page:
 * the metallic slab-style wrapper, the label on top, a thin separator, the
 * card photo below, and "click to zoom" underneath. Front shows the front
 * label over the front photo; back shows the back label over the back photo.
 *
 * EXTRACTED FROM `src/app/pokemon/[id]/CardDetailClient.tsx` as of 2026-09-21
 * (sports in brackets):
 *   front wrapper + separator + image   2884-3054  [2857-3020]
 *   back  wrapper + separator + image   3046-3232  [3012-3198]
 *   wrapper style branch                2887-2890  [2860-2863]
 *   separator style branch              3013-3022  [2986-2995]
 *
 * DELIBERATE DIFFERENCES from legacy, both forced by the V2 surface:
 *  1. Legacy's "Click to zoom" caption is `text-white/80`, because the legacy
 *     page sits on a dark background. V2's hero panel is light, so the caption
 *     uses the V2 `cd-caption` token instead — same words, readable contrast.
 *  2. Legacy renders front and back side by side in a two-column grid. V2 has
 *     one hero column, so the existing Front/Back toggle picks which one is
 *     shown. Both labels and both photos are otherwise identical to legacy.
 */

import Image from 'next/image';
import { getSlabWrapperStyle } from '@/lib/labelPresets';
import type { LabelColorOverrides } from '@/lib/labelPresets';
import { isTraditionalSelection } from '@/lib/labels/labelStyleResolution';
import LabelArtwork, { type LabelArtworkProps } from './LabelArtwork';

export interface CardLabelPieceProps extends LabelArtworkProps {
  imageUrl: string | null;
  imageAlt: string;
  /** Legacy makes the whole photo a zoom target (3016-3027). */
  onZoom?: () => void;
  priority?: boolean;
}

export function CardLabelPiece({
  imageUrl,
  imageAlt,
  onZoom,
  priority,
  ...artwork
}: CardLabelPieceProps) {
  const isTraditionalLabel = isTraditionalSelection(artwork.labelStyle, artwork.activeConfig);

  // Legacy 2887-2890 — the metallic slab frame, or the purple traditional one.
  const wrapperStyle = !isTraditionalLabel
    ? getSlabWrapperStyle(artwork.colorOverrides as LabelColorOverrides | undefined)
    : {
        background:
          'linear-gradient(145deg, #9333ea 0%, #6b21a8 25%, #a855f7 50%, #7c3aed 75%, #581c87 100%)',
        boxShadow:
          '0 4px 15px rgba(147, 51, 234, 0.4), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.2)',
      };

  // Legacy 3013-3022.
  const separatorStyle = !isTraditionalLabel
    ? {
        background:
          'linear-gradient(90deg, rgba(139, 92, 246, 0.3) 0%, rgba(139, 92, 246, 0.6) 50%, rgba(139, 92, 246, 0.3) 100%)',
      }
    : {
        background: 'linear-gradient(90deg, #9333ea 0%, #a855f7 50%, #9333ea 100%)',
      };

  return (
    <div className="cd-label-piece rounded-xl p-1 overflow-hidden" style={wrapperStyle}>
      <div className={`${!isTraditionalLabel ? '' : 'bg-white'} rounded-lg overflow-hidden`}>
        <LabelArtwork {...artwork} />

        <div className="h-1" style={separatorStyle} />

        {imageUrl ? (
          onZoom ? (
            <button
              type="button"
              className="cd-label-piece-photo"
              onClick={onZoom}
              aria-label={`Zoom ${imageAlt}`}
            >
              <Image
                src={imageUrl}
                alt={imageAlt}
                width={400}
                height={560}
                priority={priority}
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </button>
          ) : (
            <Image
              src={imageUrl}
              alt={imageAlt}
              width={400}
              height={560}
              priority={priority}
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
          )
        ) : (
          <p className="cd-missing-image" style={{ background: '#fff' }}>
            <strong>No {artwork.side} photo on file</strong>
            <span>
              This card was graded without a {artwork.side} image, or the photo did not finish
              uploading.
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

export default CardLabelPiece;
