/**
 * Heritage label — mobile constants + helpers.
 *
 * Port of the web sources (src/lib/labelLab/heritageLayout.ts, bandGeometry.ts
 * BAND_PATTERNS, labelPresets.ts GRADE_CHIPS_PRINT / GRADE_10_FOIL_STOPS).
 * Mobile duplicates label code rather than importing the parent repo — keep
 * these values byte-identical to the web copies when either side changes.
 *
 * Pure TS, zero native deps — fully OTA-safe. Mobile does NOT render the
 * pattern geometry natively (no react-native-svg in the binary); the accurate
 * preview comes from the /label-preview WebView, and native surfaces
 * approximate the band with a vertical gradient of the same palette.
 */

/** DCM brand purples — band fallback when a card has no extracted colours. */
export const HERITAGE_BRAND_COLORS = ['#7c3aed', '#4c1d95', '#a855f7', '#2e1065', '#c4b5fd']

/** Band palette for a card: extracted palette > edge colours > primary/secondary > brand. */
export function resolveHeritageBandColors(cardColors: {
  palette?: string[] | null
  topEdgeColors?: string[] | null
  primary?: string | null
  secondary?: string | null
} | null | undefined): string[] {
  const cc = cardColors
  if (cc?.palette && cc.palette.length >= 2) return cc.palette.slice(0, 5)
  if (cc?.topEdgeColors && cc.topEdgeColors.length >= 2) return cc.topEdgeColors.slice(0, 5)
  if (cc?.primary) return [cc.primary, cc.secondary || cc.primary]
  return HERITAGE_BRAND_COLORS
}

/** Grade-10 foil ramp (rainbow), mirrors web GRADE_10_FOIL_STOPS. */
export const GRADE_10_FOIL_STOPS = [
  '#FF3B5C', '#FF9F0A', '#FFE81A', '#34D96C', '#3B9BFF', '#B45AF2',
]

/** Chip black + per-grade numeral inks, mirrors web GRADE_CHIPS_PRINT. */
export const HERITAGE_CHIP_BLACK = '#101014'
export const HERITAGE_GRADE_INKS: Record<number, { ink: string; label: string }> = {
  10: { ink: '#FFDA2B', label: 'GEM MINT' },
  9: { ink: '#D8DEE6', label: 'MINT' },
  8: { ink: '#60A5FA', label: 'NM-MINT' },
  7: { ink: '#4ADE80', label: 'NEAR MINT' },
  6: { ink: '#A3E635', label: 'EX-NM' },
  5: { ink: '#FDBA74', label: 'EXCELLENT' },
  4: { ink: '#FB923C', label: 'VG-EX' },
  3: { ink: '#F97316', label: 'VERY GOOD' },
  2: { ink: '#F87171', label: 'GOOD' },
  1: { ink: '#EF4444', label: 'POOR' },
}
export const HERITAGE_FALLBACK_INK = { ink: '#E5E7EB', label: 'AUTHENTIC' }

/** Heritage light theme (print-hardened values — what production renders). */
export const HERITAGE_THEME = {
  field: '#FFFFFF',
  ink: '#1F2937',
  inkSoft: '#4B5563',
  rule: '#101014',
  edge: '#141414',
}

/**
 * On-screen (non-hardened) theme values, mirrors web heritageTheme(false):
 * the ivory field + soft keyline the browser preview shows. Print output
 * still uses the hardened HERITAGE_THEME above.
 */
export const HERITAGE_SCREEN_FIELD = '#FAF8F4'
export const HERITAGE_SCREEN_EDGE = '#E5DECF'

/** Band pattern ids + display names, mirrors web BAND_PATTERNS. */
export const HERITAGE_PATTERNS: { id: string; name: string }[] = [
  { id: 'diamond', name: 'Diamond mosaic' },
  { id: 'mosaic', name: 'Mosaic tiles' },
  { id: 'gradient', name: 'Gradient' },
  { id: 'split', name: 'Split' },
  { id: 'stripes', name: 'Diagonal stripes' },
  { id: 'chevron', name: 'Chevron' },
  { id: 'lightning', name: 'Lightning bolt' },
  { id: 'shattered', name: 'Shattered glass' },
  { id: 'fractured', name: 'Fractured' },
  { id: 'scales', name: 'Scales' },
  { id: 'prism', name: 'Prism' },
]

export function resolveHeritagePattern(id: string | null | undefined): string {
  return HERITAGE_PATTERNS.some(p => p.id === id) ? (id as string) : 'diamond'
}
