/**
 * LabelData -> SlabLabelData, in ONE place.
 *
 * Every label surface (card pages, the batch sheet modal, the wizard, the
 * label-export and label-preview bridges, the edit-label preview) used to
 * hand-build this object by copying a handful of fields across. Each copy was
 * its own chance to drop something, and they all dropped the same things: the
 * v9.23 `designation` (the "Altered - Unverified Autograph" notation, which is
 * a line of its own on the Classic label) and the structured identification
 * fields the Classic layout prefers over re-parsing `contextLine`.
 *
 * So: build the row here. Callers pass the surface-specific extras (the QR,
 * sub-scores, emblems, logos) and everything that comes from the card's
 * LabelData is forwarded explicitly, once.
 */
import type { LabelData } from '@/lib/labelDataGenerator'
import type { SlabLabelData } from '@/lib/slabLabelGenerator'

/**
 * The per-surface fields that do NOT come from LabelData: the QR data URL,
 * sub-scores, emblems, logos, and the English name a few surfaces show.
 * `undefined` values are ignored, so `{ englishName: card.featured || undefined }`
 * never blanks a value the adapter already resolved.
 */
export type SlabLabelExtras = Partial<SlabLabelData>

export function toSlabLabelData(labelData: LabelData, extras?: SlabLabelExtras): SlabLabelData {
  const data: SlabLabelData = {
    // Text the renderers draw.
    primaryName: labelData.primaryName,
    contextLine: labelData.contextLine || '',
    features: Array.isArray(labelData.features) ? labelData.features : [],
    featuresLine: labelData.featuresLine ?? null,
    serial: labelData.serial,

    // Grade block. gradeFormatted is the pre-formatted string ("10", "N/A");
    // renderers still decide the Authentic case from grade + isAlteredAuthentic.
    grade: labelData.grade,
    gradeFormatted: labelData.gradeFormatted,
    condition: labelData.condition,
    isAlteredAuthentic: labelData.isAlteredAuthentic,

    // Structured identification. Classic prefers these over parsing contextLine,
    // and designation is the fourth left-hand line.
    designation: labelData.designation ?? null,
    setName: labelData.setName ?? null,
    subset: labelData.subset ?? null,
    cardNumber: labelData.cardNumber ?? null,
    formattedCardNumber: labelData.formattedCardNumber ?? null,
    year: labelData.year ?? null,

    // Surface-specific; overridden by extras below.
    qrCodeDataUrl: '',
  }

  if (extras) {
    for (const [key, value] of Object.entries(extras)) {
      if (value !== undefined) (data as unknown as Record<string, unknown>)[key] = value
    }
  }

  return data
}

export default toSlabLabelData
