/**
 * The EFFECTIVE physical size of the label a holder's download actually
 * produces (review finding 3).
 *
 * `holderStyleSupport` answered "which design features survive this holder";
 * it said nothing about how big the printed label is, and `HOLDER_FORMATS`
 * printed a hard-coded 2.8″ × 0.8″ for the slab whatever the style. A saved
 * custom slot can carry its own `width`/`height` (Zion Mag Pro is 2.51″ ×
 * 0.76″), so the page could advertise a standard insert and hand the customer
 * a PDF at a different size.
 *
 * ── WHERE EACH NUMBER COMES FROM ──────────────────────────────────────────
 * The slab branch mirrors `DownloadReportButton.handleSlabDownload`
 * (DownloadReportButton.tsx:1341-1394) exactly, in its order:
 *
 *  1. `resolveHeritageSelection(labelStyle, config).active`
 *       -> `@/lib/labels/heritageSlabGenerator`, called with NO `dims`
 *          (1355-1374). The generator's `resolveDims(opts.dims ??
 *          designDims(opts.design))` therefore falls back to its own
 *          `STD_DIMS` — 2.8″ × 0.8″ — for a consumer card. A config-backed
 *          heritage slot's `config.width`/`config.height` are NOT read by that
 *          path, so a heritage design saved at a custom size still prints at
 *          the standard size. That is a real behaviour, reported as-is here
 *          rather than a size this module invents.
 *          (An ORG design document can move those dims through
 *          `designDims(opts.design)`; that is org-side, not config-side, and is
 *          outside what this resolver is given.)
 *  2. a saved `customLabelConfig`
 *       -> `downloadCustomSlabLabel` / `downloadFoldOverSlabLabel`, which size
 *          the page from `config.width * INCH` / `config.height * INCH`
 *          (customSlabLabelGenerator.ts:1014-1015, 1163-1164, 1298-1299).
 *  3. a built-in 'modern' / 'traditional' id
 *       -> `downloadSlabLabel(…)`, the standard 2.8″ × 0.8″ insert.
 *
 * The two compact holders never read a style's dimensions at all: their
 * handlers call the fixed Avery generators, so their size is the Avery stock.
 */

import { resolveHeritageSelection } from '@/lib/labels/labelStyleResolution';
import type { CustomLabelConfig } from '@/lib/labelPresets';
import type { CardHolderId, HolderSupportStatus } from './holderSupport';

/** The standard DCM slab insert. */
export const STANDARD_SLAB_WIDTH_IN = 2.8;
export const STANDARD_SLAB_HEIGHT_IN = 0.8;

export type LabelSizeSource =
  | 'standard-slab'
  | 'custom-config'
  | 'heritage-standard'
  | 'avery-6871'
  | 'avery-8167';

export interface EffectiveLabelSize {
  widthIn: number;
  heightIn: number;
  /** `2.8″ × 0.8″` — what the card should print. */
  formatted: string;
  /** Exactly the standard slab insert. */
  isStandard: boolean;
  /**
   * `supported`   — the size is the standard insert (or the holder's own Avery
   *                 stock, which is standard for that holder).
   * `adapted`     — the design prints smaller than the standard insert. It
   *                 physically fits inside a standard slab well, but the
   *                 preview above is drawn at standard proportions, so it is
   *                 illustrative rather than to scale.
   * `unsupported` — the design is LARGER than the standard insert in at least
   *                 one axis, so it cannot be seated in a standard slab well at
   *                 all. The page must not show it as a standard slab fit.
   */
  status: HolderSupportStatus;
  /** Plain sentence for the reader, or null when nothing needs saying. */
  note: string | null;
  source: LabelSizeSource;
}

type ConfigLike = Pick<
  CustomLabelConfig,
  'style' | 'heritagePattern' | 'heritageColorSource' | 'heritageBandColors' | 'heritageGradeColors'
> & { width?: number; height?: number };

/** `2.8` -> `2.8″`, `2.375` -> `2.375″`. Trailing zeros are dropped. */
function inches(value: number): string {
  return `${Number(value.toFixed(3))}″`;
}

function format(widthIn: number, heightIn: number): string {
  return `${inches(widthIn)} × ${inches(heightIn)}`;
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.001;

/** The Avery stock each compact holder's generator prints on. */
const COMPACT_SIZES: Partial<Record<CardHolderId, { w: number; h: number; source: LabelSizeSource }>> = {
  // generateAvery8167Label — Avery 8167, 1.75″ × 0.5″.
  toploader: { w: 1.75, h: 0.5, source: 'avery-8167' },
  // generateAveryLabel / generateFoldOverLabel8167 — Avery 6871, a 2.375″ ×
  // 1.25″ sheet folded over the holder's top edge.
  onetouch: { w: 2.375, h: 1.25, source: 'avery-6871' },
};

/**
 * What size the holder's download will actually produce for this style.
 *
 * @param holder       which holder card the reader is looking at
 * @param labelStyle   'heritage' | 'modern' | 'traditional' | 'custom-N'
 * @param activeConfig the saved config behind a 'custom-N' id, if any
 */
export function resolveEffectiveLabelSize(
  holder: CardHolderId,
  labelStyle: string | null | undefined,
  activeConfig?: ConfigLike | null,
): EffectiveLabelSize {
  const compact = COMPACT_SIZES[holder];
  if (compact) {
    return {
      widthIn: compact.w,
      heightIn: compact.h,
      formatted: format(compact.w, compact.h),
      isStandard: true,
      status: 'supported',
      note: null,
      source: compact.source,
    };
  }

  const standard: Omit<EffectiveLabelSize, 'source'> = {
    widthIn: STANDARD_SLAB_WIDTH_IN,
    heightIn: STANDARD_SLAB_HEIGHT_IN,
    formatted: format(STANDARD_SLAB_WIDTH_IN, STANDARD_SLAB_HEIGHT_IN),
    isStandard: true,
    status: 'supported',
    note: null,
  };

  // 1. Heritage wins outright, and its export is called without dims.
  if (resolveHeritageSelection(labelStyle, activeConfig).active) {
    const savedW = activeConfig?.width;
    const savedH = activeConfig?.height;
    const savedIsNonStandard =
      typeof savedW === 'number' &&
      typeof savedH === 'number' &&
      !(near(savedW, STANDARD_SLAB_WIDTH_IN) && near(savedH, STANDARD_SLAB_HEIGHT_IN));
    return {
      ...standard,
      source: 'heritage-standard',
      // Say so rather than silently printing a different size than the design
      // was saved at: the reader chose those dimensions in the designer.
      note: savedIsNonStandard
        ? `This design was saved at ${format(savedW as number, savedH as number)}, but the Heritage slab export prints the standard ${standard.formatted} insert. Its dimensions are not applied here.`
        : null,
    };
  }

  // 2. A saved custom config sizes its own page.
  const w = activeConfig?.width;
  const h = activeConfig?.height;
  if (activeConfig && typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0) {
    if (near(w, STANDARD_SLAB_WIDTH_IN) && near(h, STANDARD_SLAB_HEIGHT_IN)) {
      return { ...standard, source: 'custom-config' };
    }
    // Larger than the standard well in either axis: it cannot be seated in a
    // standard slab. Smaller: it fits, but the preview is not to scale.
    const tooBig = w > STANDARD_SLAB_WIDTH_IN + 0.001 || h > STANDARD_SLAB_HEIGHT_IN + 0.001;
    return {
      widthIn: w,
      heightIn: h,
      formatted: format(w, h),
      isStandard: false,
      status: tooBig ? 'unsupported' : 'adapted',
      note: tooBig
        ? `This design prints at ${format(w, h)}, which is larger than the standard ${standard.formatted} slab insert — it will not fit a standard slab. The preview above is drawn at standard proportions and is illustrative only.`
        : `This design prints at ${format(w, h)}, not the standard ${standard.formatted} insert. It fits inside a standard slab, but the preview above is drawn at standard proportions and is illustrative only.`,
      source: 'custom-config',
    };
  }

  // 3. Built-in modern / traditional.
  return { ...standard, source: 'standard-slab' };
}
