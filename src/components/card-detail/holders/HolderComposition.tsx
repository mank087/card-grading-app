'use client';

/**
 * This card, in the chosen holder, with the owner's real label.
 *
 * The holder photo and every slot coordinate live in `LabelMockup` — this
 * component supplies only the artwork, through the two additive props added
 * for Phase 2 (`slabLabel`) and the one that already existed (`labelImages`).
 * There is therefore still exactly one source of truth for where a label sits
 * on a holder, shared with Label Studio and the Label Wizard.
 *
 *   slab                 -> LabelMockup 'slab-modern', with `slabLabel` set to
 *                           <LabelArtwork>, which is the owner's actual label
 *                           (Heritage / Modern / Classic / custom).
 *   toploader, onetouch  -> the compact Avery mockups. These print a DIFFERENT
 *                           physical label (Avery 8167 / 6871 fold-over), so
 *                           the slab artwork is never stretched into them:
 *                           Heritage supplies its own compact canvases via
 *                           `useHolderCompactImages`, and every other style
 *                           falls through to the mockup's built-in compact
 *                           design, which is what those generators print.
 *                           `holderStyleSupport` says so in words.
 *
 * It is NEVER implied that the card physically sits in the holder: the caller
 * renders a "Holder preview" tag beside this.
 */

import { useMemo } from 'react';
import { LABEL_TYPES } from '@/lib/labelPresets';
import LabelMockup from '@/components/labels/LabelMockup';
import type { CustomLabelConfig, LabelColorOverrides } from '@/lib/labelPresets';
import type { LabelData } from '@/lib/labelDataGenerator';
import type { CardHolderId } from '@/lib/cardDetail/holderSupport';
import LabelArtwork, { type LabelArtworkOrgLogos } from './LabelArtwork';
import { useHolderCompactImages, type CompactFormat } from './useHolderCompactImages';

export interface HolderCompositionProps {
  holder: CardHolderId;
  /**
   * Front/back. OMIT IT and `LabelMockup` keeps its own internal state and
   * renders its own Front/Back toggle — which is what the holder cards want,
   * because a per-card flip then costs nothing.
   */
  side?: 'front' | 'back';
  /** The raw row — the compact Heritage inputs read it, as the sheets do. */
  card: unknown;
  frontUrl: string | null;
  backUrl: string | null;
  cardName: string;
  labelData: LabelData;
  labelStyle: string | null | undefined;
  activeConfig: CustomLabelConfig | null;
  colorOverrides?: LabelColorOverrides;
  heritageBandColors: string[];
  orgLogos?: LabelArtworkOrgLogos | null;
  subScores?: { centering: number; corners: number; edges: number; surface: number } | null;
  emblems?: {
    showFounderEmblem?: boolean;
    showVipEmblem?: boolean;
    showCardLoversEmblem?: boolean;
  };
  verifyUrl: string;
  /** Composition width. The mockups cap themselves at 200px by default. */
  maxWidth?: number;
}

const LABEL_TYPE_FOR_HOLDER: Record<CardHolderId, string> = {
  slab: 'slab-modern',
  toploader: 'toploader',
  onetouch: 'onetouch',
};

const COMPACT_FORMAT: Partial<Record<CardHolderId, CompactFormat>> = {
  toploader: 'toploader',
  onetouch: 'onetouch',
};

export function HolderComposition({
  holder,
  side,
  card,
  frontUrl,
  backUrl,
  cardName,
  labelData,
  labelStyle,
  activeConfig,
  colorOverrides,
  heritageBandColors,
  orgLogos,
  subScores,
  emblems,
  verifyUrl,
  maxWidth,
}: HolderCompositionProps) {
  const labelType = LABEL_TYPES.find((t) => t.id === LABEL_TYPE_FOR_HOLDER[holder])!;
  const isSlab = holder === 'slab';

  const compactImages = useHolderCompactImages(
    COMPACT_FORMAT[holder] ?? 'toploader',
    isSlab
      ? null
      : {
          card,
          labelStyle,
          activeConfig,
          verifyUrl,
          emblems,
          orgDesign: orgLogos?.design ?? null,
        },
  );

  const artworkProps = {
    labelData,
    labelStyle,
    activeConfig,
    colorOverrides,
    heritageBandColors,
    orgLogos,
    subScores,
    emblems,
    verifyUrl,
  } as const;

  // Both faces are mounted so flipping does not re-run the Heritage QR effect
  // or re-measure ScaleToFit; only the chosen one is handed to the mockup.
  const slabLabel = useMemo(
    () =>
      isSlab
        ? {
            front: <LabelArtwork side="front" {...artworkProps} />,
            back: <LabelArtwork side="back" {...artworkProps} />,
          }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isSlab,
      labelData,
      labelStyle,
      activeConfig,
      colorOverrides,
      heritageBandColors,
      orgLogos,
      subScores,
      emblems,
      verifyUrl,
    ],
  );

  return (
    <div className="cd-holder-composition">
      <LabelMockup
        card={{ front_url: frontUrl, back_url: backUrl, card_name: cardName }}
        labelType={labelType}
        side={side}
        maxWidth={maxWidth}
        slabLabel={slabLabel}
        labelImages={compactImages}
        labelProps={{
          displayName: labelData.primaryName,
          setLineText: labelData.contextLine || 'Card Details',
          features: labelData.features,
          serial: labelData.serial,
          grade: labelData.grade,
          condition: labelData.condition,
          isAlteredAuthentic: labelData.isAlteredAuthentic,
        }}
        backLabelProps={{
          serial: labelData.serial,
          grade: labelData.grade,
          condition: labelData.condition,
          qrCodeUrl: verifyUrl,
          subScores: subScores ?? undefined,
          isAlteredAuthentic: labelData.isAlteredAuthentic,
          showFounderEmblem: emblems?.showFounderEmblem,
          showVipEmblem: emblems?.showVipEmblem,
          showCardLoversEmblem: emblems?.showCardLoversEmblem,
        }}
      />
    </div>
  );
}

export default HolderComposition;
