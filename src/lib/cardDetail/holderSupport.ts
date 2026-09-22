/**
 * Holder x label-style compatibility (plan gap G2).
 *
 * The three holders do NOT all print the same artwork, and the page must say
 * so rather than showing a preview the printer will not reproduce. Nothing
 * here is a guess: each rule is read off the download path that actually runs.
 *
 * ── SLAB (2.8" x 0.8" insert) ─────────────────────────────────────────────
 * `DownloadReportButton.handleSlabDownload` (DownloadReportButton.tsx:1321)
 * branches on `resolveHeritageSelection` and then on `customLabelConfig`:
 *   heritage            -> heritageSlabGenerator, carrying pattern, bandColors
 *                          AND gradeColors (1355-1358)
 *   saved custom config -> downloadCustomSlabLabel / downloadFoldOverSlabLabel
 *                          (1383, 1379)
 *   built-in            -> downloadSlabLabel(…, 'traditional' | 'modern')
 *                          (1385, 1381)
 * Every style therefore has its own slab generator: the slab is `supported`
 * across the board.
 *
 * ── COMPACT HOLDERS (Avery 6871 One-Touch, Avery 8167 toploader) ──────────
 * `buildCompactHeritageSheet` (DownloadReportButton.tsx:929-953) is the ONLY
 * style-aware compact path, and it asks `resolveCompactHeritage`, which by
 * construction drops everything but pattern + band palette:
 *   "The One-Touch (Avery 6871) and Toploader (Avery 8167) panels have no room
 *    for the designer's per-grade chip colours or layout moves — pattern and
 *    band palette are the whole of it."  (labelStyleResolution.ts:56-66)
 * When it returns null — i.e. for EVERY non-heritage style — the handlers fall
 * straight through to the one fixed generator
 * (`generateAveryLabel` / `generateAvery8167Label` / `generateFoldOverLabel8167`,
 * DownloadReportButton.tsx:1006-1110, 1121-1199, 1209-1270), which take only
 * `getCardLabelData(card)`, a QR and a logo.
 *
 * ── WHAT THAT FIXED GENERATOR ACTUALLY DRAWS (owner review, 2026-09-22) ───
 * It is not a fallback — it IS the DCM standard compact label: a white field
 * with a purple border, the purple "Dynamic Collectibles Management" bar at
 * the fold, the DCM mark, the card name / set line / features / serial, and
 * the purple grade with its rule and condition
 * (averyLabelGenerator.ts:45-58, 152-330; avery8167LabelGenerator.ts).
 * `LabelMockup`'s One-Touch and Toploader previews draw the same thing
 * (LabelMockup.tsx:612-630, 712-740), so preview and print agree.
 *
 * The owner's decision is that MODERN AND TRADITIONAL SHARE THAT ONE COMPACT
 * DESIGN. They are therefore `supported` on the compact holders — nothing the
 * reader chose is being dropped, so there is nothing to warn about. Heritage
 * keeps its own compact panels, and only a SAVED CUSTOM SLOT (its own colours,
 * or its own physical dimensions) is genuinely adapted here.
 *
 * Nothing is ever silently substituted: an `adapted` status must be shown to
 * the reader, and `note` is the sentence to show.
 */

import { resolveHeritageSelection } from '@/lib/labels/labelStyleResolution';
import type { CustomLabelConfig } from '@/lib/labelPresets';

/**
 * The three physical holders the page previews. Declared here, beside the
 * compatibility rules, so no component owns the vocabulary.
 */
export type CardHolderId = 'slab' | 'toploader' | 'onetouch';

export const CARD_HOLDERS: readonly CardHolderId[] = ['slab', 'toploader', 'onetouch'];

export type HolderSupportStatus = 'supported' | 'adapted' | 'unsupported';

export interface HolderSupport {
  status: HolderSupportStatus;
  /** A short plain sentence for the reader, or null when nothing is lost. */
  note: string | null;
}

type ConfigLike = Pick<
  CustomLabelConfig,
  'style' | 'heritagePattern' | 'heritageColorSource' | 'heritageBandColors' | 'heritageGradeColors'
> & { width?: number; height?: number };

const STANDARD_W = 2.8;
const STANDARD_H = 0.8;

/** A saved slot with non-standard physical dimensions (e.g. Zion Mag Pro). */
function isNonStandardSize(config?: ConfigLike | null): boolean {
  if (!config) return false;
  const w = config.width ?? STANDARD_W;
  const h = config.height ?? STANDARD_H;
  return Math.abs(w - STANDARD_W) > 0.001 || Math.abs(h - STANDARD_H) > 0.001;
}

/**
 * Only a SAVED CUSTOM design loses anything on the compact sheets: the Avery
 * label is the standard DCM compact design, which Modern and Traditional both
 * print, so a custom slot's own colours stay behind on the slab insert.
 */
const COMPACT_CUSTOM_NOTE =
  'This sheet prints the standard DCM compact label. The colours you saved stay on the slab insert.';

const COMPACT_HERITAGE_NOTE =
  'Heritage prints here with its pattern and band colours. The per-grade chip colours you chose stay on the slab insert.';

const COMPACT_SIZE_NOTE =
  'This holder uses its own Avery label size, so your custom slab dimensions do not apply to it.';

/**
 * What a holder can actually honour for the active label style.
 *
 * @param holder      which holder the reader is looking at
 * @param labelStyle  the account/org style id ('heritage', 'modern',
 *                    'traditional', 'custom-N')
 * @param activeConfig the saved custom config behind a 'custom-N' id, if any
 */
export function holderStyleSupport(
  holder: CardHolderId,
  labelStyle: string | null | undefined,
  activeConfig?: ConfigLike | null,
): HolderSupport {
  const heritage = resolveHeritageSelection(labelStyle, activeConfig);

  if (holder === 'slab') {
    // Every style has its own slab generator; nothing is dropped.
    return { status: 'supported', note: null };
  }

  // toploader / onetouch — the compact Avery formats.
  if (heritage.active) {
    const losesGradeColors = !!heritage.gradeColors;
    if (losesGradeColors) {
      return { status: 'adapted', note: COMPACT_HERITAGE_NOTE };
    }
    return { status: 'supported', note: null };
  }

  // Built-in Modern / Traditional / Classic: the compact sheet IS their design.
  // No saved config means nothing of the reader's own was set aside.
  if (!activeConfig) {
    return { status: 'supported', note: null };
  }

  const notes = [COMPACT_CUSTOM_NOTE];
  if (isNonStandardSize(activeConfig)) notes.push(COMPACT_SIZE_NOTE);
  return { status: 'adapted', note: notes.join(' ') };
}

/**
 * The NAME of the stock a holder's primary download prints on, without a size.
 *
 * The size is no longer a constant: a saved custom slot can carry its own
 * dimensions, so it comes from `resolveEffectiveLabelSize` (lib/cardDetail/
 * labelSize.ts) and the card prints "<stock> · <size>".
 */
export const HOLDER_LABEL_STOCK: Record<CardHolderId, string> = {
  slab: 'Slab insert',
  toploader: 'Avery 8167',
  onetouch: 'Avery 6871 fold-over',
};

/**
 * Physical stock a holder's primary download actually produces.
 *
 * SUPERSEDED for the slab by `resolveEffectiveLabelSize`, which reads the real
 * dimensions out of the active config instead of assuming the standard insert.
 * Kept because the size is right for the two fixed Avery formats and the
 * strings are still a useful one-line description.
 */
export const HOLDER_FORMATS: Record<CardHolderId, string> = {
  // labelPresets.ts:774-792 — LABEL_TYPES 'slab-modern' / 'slab-traditional'.
  slab: '2.8″ × 0.8″ slab insert',
  // labelPresets.ts:803-811 — LABEL_TYPES 'toploader' (Avery 8167).
  toploader: 'Avery 8167 · 1.75″ × 0.5″',
  // labelPresets.ts:793-802 — LABEL_TYPES 'onetouch' (Avery 6871), which folds
  // over the top edge: 2.375″ × 1.25″ sheet, 2.375″ × 0.625″ visible per face.
  onetouch: 'Avery 6871 · 2.375″ × 1.25″ fold-over',
};

export const HOLDER_DOWNLOAD_LABELS: Record<CardHolderId, string> = {
  slab: 'Download slab label',
  toploader: 'Download top loader label',
  onetouch: 'Download One-Touch label',
};

export const HOLDER_NAMES: Record<CardHolderId, string> = {
  slab: 'Graded slab',
  toploader: 'Top loader',
  onetouch: 'One-Touch',
};

/**
 * Shop anchors. Ids come from `src/lib/shopProducts.ts` PRODUCTS and the shop
 * page renders `<article id={product.id}>` (src/app/shop/page.tsx:20), so
 * `/shop#<id>` already lands on the card.
 */
export const HOLDER_SHOP_LINKS: Record<CardHolderId, Array<{ label: string; href: string }>> = {
  // The shop's "02 / Card holders" section (src/app/shop/page.tsx:15) is the
  // slabs-and-cases area: magnetic slabs, traditional graded slabs, Zion MagPro.
  slab: [{ label: 'See Recommended Slabs and Cases', href: '/shop#holders' }],
  // The label stock lives in "03 / Printing & trimming", which now also
  // answers to `#labels` (an alias anchor added to the shop page for this).
  toploader: [{ label: 'Shop Labels', href: '/shop#labels' }],
  onetouch: [{ label: 'Shop Labels', href: '/shop#labels' }],
};
