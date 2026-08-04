/**
 * Which label design does a style selection actually mean?
 *
 * Heritage can be active two ways:
 *  1. `label_style === 'heritage'` — the built-in, selectable in every style
 *     dropdown. Pattern defaults to 'diamond'; band colours are per-card.
 *  2. A saved custom slot (`custom-N`) whose config has `style: 'heritage'` —
 *     created in the Studio designer. The config carries the chosen pattern.
 *
 * Every consumer (card pages, batch modal, downloads, image composites) must
 * ask THIS helper instead of re-implementing the `!== 'traditional'` binary
 * that treats anything unknown as Modern.
 */
import type { CustomLabelConfig } from '@/lib/labelPresets'
import { BAND_PATTERNS, type BandPattern } from '@/lib/labelLab/bandGeometry'
import { HERITAGE_BRAND_COLORS } from '@/lib/labelLab/heritageLayout'

export interface HeritageSelection {
  active: boolean
  pattern: BandPattern
  /**
   * Non-null when the selection pins the band to a fixed palette (the DCM
   * brand purples, via config.heritageColorSource === 'brand'). Null means
   * "sample the card": callers fall through to
   * resolveHeritageBandColors(card.card_colors).
   */
  bandColors: string[] | null
  /** Per-grade chip colour overrides from the config, or null. */
  gradeColors: Record<string, string> | null
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/

export function resolveHeritageSelection(
  labelStyle: string | null | undefined,
  activeConfig?: Pick<
    CustomLabelConfig,
    'style' | 'heritagePattern' | 'heritageColorSource' | 'heritageBandColors' | 'heritageGradeColors'
  > | null,
): HeritageSelection {
  const fromBuiltIn = labelStyle === 'heritage'
  const fromConfig = activeConfig?.style === 'heritage'
  const rawPattern = fromConfig ? activeConfig?.heritagePattern : undefined
  const pattern = (BAND_PATTERNS.some(p => p.id === rawPattern) ? rawPattern : 'diamond') as BandPattern
  // Hand-edited palette wins over the source toggle; both only apply to
  // config-backed selections (the built-in id always samples the card).
  const custom = fromConfig ? activeConfig?.heritageBandColors?.filter(c => HEX_RE.test(c)) : undefined
  const bandColors =
    custom && custom.length >= 2 ? custom
    : fromConfig && activeConfig?.heritageColorSource === 'brand' ? HERITAGE_BRAND_COLORS
    : null
  const gradeColors = fromConfig && activeConfig?.heritageGradeColors
    ? Object.fromEntries(Object.entries(activeConfig.heritageGradeColors).filter(([, v]) => HEX_RE.test(v)))
    : null
  return {
    active: fromBuiltIn || fromConfig,
    pattern,
    bandColors,
    gradeColors: gradeColors && Object.keys(gradeColors).length ? gradeColors : null,
  }
}
