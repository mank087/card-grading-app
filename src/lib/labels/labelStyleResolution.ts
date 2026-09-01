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

/**
 * Is the ACTIVE selection the traditional (light) label design?
 *
 * The old `labelStyle !== 'traditional'` binary on card pages got this wrong
 * for saved custom slots: a custom-N config with style 'traditional' rendered
 * the Modern label and slab chrome. The rule is: heritage wins outright, then
 * a config-backed selection is whatever its config says, then the built-in id.
 */
export function isTraditionalSelection(
  labelStyle: string | null | undefined,
  activeConfig?: Pick<
    CustomLabelConfig,
    'style' | 'heritagePattern' | 'heritageColorSource' | 'heritageBandColors' | 'heritageGradeColors'
  > | null,
): boolean {
  if (resolveHeritageSelection(labelStyle, activeConfig).active) return false
  if (activeConfig) return activeConfig.style === 'traditional'
  return labelStyle === 'traditional'
}

/**
 * The subset of a Heritage selection the COMPACT holders can honour.
 *
 * The One-Touch (Avery 6871) and Toploader (Avery 8167) panels have no room
 * for the designer's per-grade chip colours or layout moves — pattern and band
 * palette are the whole of it. Returns null when the selection is not
 * Heritage, so callers can write `const h = resolveCompactHeritage(...)` and
 * branch on it directly.
 *
 * `bandColors: null` means "sample each card's own artwork" — pass it straight
 * through to buildHeritageCompactInputs, which falls back per card.
 */
export interface CompactHeritageSelection {
  pattern: BandPattern
  bandColors: string[] | null
}

export function resolveCompactHeritage(
  labelStyle: string | null | undefined,
  activeConfig?: Pick<
    CustomLabelConfig,
    'style' | 'heritagePattern' | 'heritageColorSource' | 'heritageBandColors' | 'heritageGradeColors'
  > | null,
): CompactHeritageSelection | null {
  const sel = resolveHeritageSelection(labelStyle, activeConfig)
  if (!sel.active) return null
  return { pattern: sel.pattern, bandColors: sel.bandColors }
}

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
