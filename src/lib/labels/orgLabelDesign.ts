/**
 * Enterprise Label Designer — the org design document.
 *
 * ENTERPRISE ONLY. This document describes a store's house label layout and
 * is stored at organizations.storefront.slab.design. It is read through
 * resolveOrgLabelDesign() and nowhere else, and it only reaches a renderer
 * when the card being drawn belongs to the org (useOrgHouseStyle /
 * getBrandingForCard). Consumer cards, Label Studio and its CustomLabelConfig
 * never see it: every renderer treats an absent document as "draw exactly
 * what you drew before" — the isolation gate in
 * scripts/label-design-snapshot.ts enforces that byte-for-byte.
 *
 * Every field is a BOUNDED parameter (Tier 1 "guided" editor): the geometry
 * engine (heritageLayout.heritageGeometry) turns the document into rects, and
 * the text fitter / mark clamp still run per card, so no combination of
 * values can print over the serial or off the die-cut.
 *
 * The legacy keys under storefront.slab (label_style, pattern, colors,
 * color_source, logo_variant, logo_scale) remain the mirror of the document's
 * corresponding fields: settings writes keep both in sync, and the resolver
 * seeds a missing document from them, so nothing needs a backfill and every
 * existing reader of the legacy keys keeps working.
 */
import { BAND_PATTERNS, type BandPattern } from '@/lib/labelLab/bandGeometry'

export type BandPosition = 'left' | 'right' | 'top' | 'bottom'
export type LogoZone = 'bottom' | 'left' | 'right'
export type LogoVariant = 'color' | 'black' | 'white'
export type ChipTheme = 'black' | 'white'
export type BandColorSource = 'brand' | 'card' | 'custom'

export interface OrgLabelDesign {
  v: 1
  base: 'heritage' | 'modern'
  band: {
    position: BandPosition
    pattern: BandPattern
    colorSource: BandColorSource
    /** Up to 5 hex colours; only meaningful when colorSource === 'custom'. */
    colors: string[]
    /** Multiplier on the stock band width (90 mockup-px). */
    width: number
  }
  logo: {
    zone: LogoZone
    variant: LogoVariant
    /** Mark size multiplier; the renderer clamps per card. */
    scale: number
    /** -1..1 travel inside the zone: x for the bottom strip, y for the side columns. */
    offset: { x: number; y: number }
    /** Gold accent bars beside a bottom-zone mark. */
    accentRules: boolean
  }
  chip: {
    theme: ChipTheme
    scale: number
    /** Solid colour replacing the grade-10 foil; null keeps the foil. */
    grade10Color: string | null
  }
  text: {
    /** Multiplier on the maximum type sizes; the fitter still shrinks. */
    scale: number
  }
  border: {
    enabled: boolean
    color: string
    /** Stroke width, inches. */
    width: number
    /** Distance from the die-cut edge to the stroke's outer edge, inches. */
    inset: number
  }
  /**
   * Physical label slot. The layout is authored for the standard 2.8" x 0.8"
   * slab; other holders (Zion Mag Pro) print the same layout scaled to their
   * slot — exactly how the consumer Label Studio handles it.
   */
  size: {
    preset: LabelSizePreset
    widthIn: number
    heightIn: number
  }
}

export type LabelSizePreset = 'standard' | 'zion'

/** Slab label slots an org can print for. Same numbers as the consumer wizard's SLAB_SIZES. */
export const LABEL_SIZE_PRESETS: { id: LabelSizePreset; name: string; widthIn: number; heightIn: number; note: string }[] = [
  { id: 'standard', name: 'Standard slab', widthIn: 2.8, heightIn: 0.8, note: 'Most magnetic one-touch and standard slab holders.' },
  { id: 'zion', name: 'Zion Mag Pro', widthIn: 2.51, heightIn: 0.76, note: 'The smaller label slot in Zion Mag Pro holders.' },
]

/** Print dims for a design, or undefined for the standard slot (renderers treat undefined as stock). */
export function designDims(d: OrgLabelDesign | null | undefined): { widthIn: number; heightIn: number } | undefined {
  if (!d || d.size.preset === 'standard') return undefined
  return { widthIn: d.size.widthIn, heightIn: d.size.heightIn }
}

/** Width/height ratio the on-screen preview should stretch to; undefined = natural 3.5:1. */
export function designAspect(d: OrgLabelDesign | null | undefined): number | undefined {
  const dims = designDims(d)
  return dims ? dims.widthIn / dims.heightIn : undefined
}

/** Ranges the editor offers and the API clamps to. */
export const DESIGN_LIMITS = {
  bandWidth: { min: 0.6, max: 1.5, step: 0.05 },
  logoScaleBottom: { min: 0.7, max: 2, step: 0.05 },
  logoScaleSide: { min: 0.7, max: 1.5, step: 0.05 },
  logoOffset: { min: -1, max: 1, step: 0.05 },
  chipScale: { min: 0.8, max: 1.1, step: 0.02 },
  textScale: { min: 0.85, max: 1.15, step: 0.05 },
  borderWidth: { min: 0.01, max: 0.05, step: 0.005 },
  borderInset: { min: 0.04, max: 0.1, step: 0.005 },
} as const

const BAND_POSITIONS: BandPosition[] = ['left', 'right', 'top', 'bottom']
const LOGO_ZONES: LogoZone[] = ['bottom', 'left', 'right']
const LOGO_VARIANTS: LogoVariant[] = ['color', 'black', 'white']
const CHIP_THEMES: ChipTheme[] = ['black', 'white']
const HEX_RE = /^#[0-9a-fA-F]{6}$/

/** The stock DCM Heritage layout — what every org renders until it edits. */
export function defaultOrgLabelDesign(): OrgLabelDesign {
  return {
    v: 1,
    base: 'heritage',
    band: { position: 'left', pattern: 'diamond', colorSource: 'brand', colors: [], width: 1 },
    logo: { zone: 'bottom', variant: 'color', scale: 1, offset: { x: 0, y: 0 }, accentRules: true },
    chip: { theme: 'black', scale: 1, grade10Color: null },
    text: { scale: 1 },
    border: { enabled: false, color: '#1C1B18', width: 0.02, inset: 0.05 },
    size: { preset: 'standard', widthIn: 2.8, heightIn: 0.8 },
  }
}

/** Legacy storefront.slab keys (still written, still read by older surfaces). */
export interface LegacySlabKeys {
  label_style?: string
  pattern?: string
  colors?: unknown
  color_source?: string
  logo_variant?: string
  logo_scale?: unknown
}

const num = (v: unknown, fallback: number, lo: number, hi: number, decimals = 2): number => {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return fallback
  const k = Math.pow(10, decimals)
  return Math.min(hi, Math.max(lo, Math.round(n * k) / k))
}
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  (typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback)
const hexList = (v: unknown, max = 5): string[] =>
  Array.isArray(v) ? v.filter((c): c is string => typeof c === 'string' && HEX_RE.test(c)).slice(0, max) : []

/**
 * Seed a document from the legacy slab keys alone (org that has never opened
 * the designer). Mirrors exactly how those keys are interpreted today.
 */
export function designFromLegacySlab(slab: LegacySlabKeys | null | undefined): OrgLabelDesign {
  const d = defaultOrgLabelDesign()
  if (!slab) return d
  d.base = slab.label_style === 'modern' ? 'modern' : 'heritage'
  d.band.pattern = oneOf(slab.pattern, BAND_PATTERNS.map(p => p.id), 'diamond')
  const colors = hexList(slab.colors)
  d.band.colors = colors
  // Legacy semantics: any explicit colours = custom; otherwise brand/card.
  d.band.colorSource = colors.length > 0 ? 'custom' : slab.color_source === 'card' ? 'card' : 'brand'
  d.logo.variant = oneOf(slab.logo_variant, LOGO_VARIANTS, 'color')
  d.logo.scale = num(slab.logo_scale, 1, DESIGN_LIMITS.logoScaleBottom.min, DESIGN_LIMITS.logoScaleBottom.max)
  return d
}

/**
 * Validate + clamp an incoming document (API write) or a stored one (read).
 * Unknown keys are dropped; every number lands inside DESIGN_LIMITS; enums
 * fall back to the default. `legacy` seeds fields the raw document omits.
 */
export function normalizeOrgLabelDesign(raw: unknown, legacy?: LegacySlabKeys | null): OrgLabelDesign {
  const base = designFromLegacySlab(legacy)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base
  const r = raw as Record<string, unknown>
  const band = (r.band && typeof r.band === 'object' ? r.band : {}) as Record<string, unknown>
  const logo = (r.logo && typeof r.logo === 'object' ? r.logo : {}) as Record<string, unknown>
  const offset = (logo.offset && typeof logo.offset === 'object' ? logo.offset : {}) as Record<string, unknown>
  const chip = (r.chip && typeof r.chip === 'object' ? r.chip : {}) as Record<string, unknown>
  const text = (r.text && typeof r.text === 'object' ? r.text : {}) as Record<string, unknown>
  const border = (r.border && typeof r.border === 'object' ? r.border : {}) as Record<string, unknown>
  const size = (r.size && typeof r.size === 'object' ? r.size : {}) as Record<string, unknown>
  // Presets only — the dims are always the preset's, never free numbers.
  const sizePreset = LABEL_SIZE_PRESETS.find(p => p.id === size.preset) ?? LABEL_SIZE_PRESETS.find(p => p.id === base.size.preset)!

  const zone = oneOf(logo.zone, LOGO_ZONES, base.logo.zone)
  const scaleLimit = zone === 'bottom' ? DESIGN_LIMITS.logoScaleBottom : DESIGN_LIMITS.logoScaleSide
  const colors = band.colors !== undefined ? hexList(band.colors) : base.band.colors
  const colorSource = oneOf(band.colorSource, ['brand', 'card', 'custom'] as const, base.band.colorSource)

  return {
    v: 1,
    base: oneOf(r.base, ['heritage', 'modern'] as const, base.base),
    band: {
      position: oneOf(band.position, BAND_POSITIONS, base.band.position),
      pattern: oneOf(band.pattern, BAND_PATTERNS.map(p => p.id), base.band.pattern),
      colorSource: colorSource === 'custom' && colors.length === 0 ? 'brand' : colorSource,
      colors: colorSource === 'custom' ? colors : [],
      width: num(band.width, base.band.width, DESIGN_LIMITS.bandWidth.min, DESIGN_LIMITS.bandWidth.max),
    },
    logo: {
      zone,
      variant: oneOf(logo.variant, LOGO_VARIANTS, base.logo.variant),
      scale: num(logo.scale, Math.min(base.logo.scale, scaleLimit.max), scaleLimit.min, scaleLimit.max),
      offset: {
        x: num(offset.x, base.logo.offset.x, DESIGN_LIMITS.logoOffset.min, DESIGN_LIMITS.logoOffset.max),
        y: num(offset.y, base.logo.offset.y, DESIGN_LIMITS.logoOffset.min, DESIGN_LIMITS.logoOffset.max),
      },
      accentRules: typeof logo.accentRules === 'boolean' ? logo.accentRules : base.logo.accentRules,
    },
    chip: {
      theme: oneOf(chip.theme, CHIP_THEMES, base.chip.theme),
      scale: num(chip.scale, base.chip.scale, DESIGN_LIMITS.chipScale.min, DESIGN_LIMITS.chipScale.max),
      grade10Color: typeof chip.grade10Color === 'string' && HEX_RE.test(chip.grade10Color) ? chip.grade10Color : null,
    },
    text: {
      scale: num(text.scale, base.text.scale, DESIGN_LIMITS.textScale.min, DESIGN_LIMITS.textScale.max),
    },
    border: {
      enabled: typeof border.enabled === 'boolean' ? border.enabled : base.border.enabled,
      color: typeof border.color === 'string' && HEX_RE.test(border.color) ? border.color : base.border.color,
      width: num(border.width, base.border.width, DESIGN_LIMITS.borderWidth.min, DESIGN_LIMITS.borderWidth.max, 3),
      inset: num(border.inset, base.border.inset, DESIGN_LIMITS.borderInset.min, DESIGN_LIMITS.borderInset.max, 3),
    },
    size: { preset: sizePreset.id, widthIn: sizePreset.widthIn, heightIn: sizePreset.heightIn },
  }
}

/**
 * The org's effective design: the stored document when present, else one
 * seeded from the legacy keys. This is the ONLY reader of storefront.slab.design.
 */
export function resolveOrgLabelDesign(storefront: { slab?: (LegacySlabKeys & { design?: unknown }) | null } | null | undefined): OrgLabelDesign {
  const slab = storefront?.slab ?? null
  return normalizeOrgLabelDesign(slab?.design ?? null, slab)
}

/** The legacy slab keys a document implies — written alongside it so older readers stay correct. */
export interface LegacySlabValues {
  label_style: 'heritage' | 'modern'
  pattern: BandPattern
  colors: string[]
  color_source: 'brand' | 'card'
  logo_variant: LogoVariant
  logo_scale: number
}

export function designToLegacySlab(d: OrgLabelDesign): LegacySlabValues {
  return {
    label_style: d.base,
    pattern: d.band.pattern,
    colors: d.band.colorSource === 'custom' ? d.band.colors : [],
    color_source: d.band.colorSource === 'card' ? 'card' : 'brand',
    logo_variant: d.logo.variant,
    logo_scale: d.logo.scale,
  }
}

/**
 * True when the document changes NOTHING about the stock Heritage geometry
 * beyond what the legacy keys already expressed (pattern/colours/logo scale &
 * variant). Renderers use this to stay on their historical code path, which
 * is what keeps the isolation gate green for every org that never opened the
 * designer.
 */
export function isStockLayout(d: OrgLabelDesign | null | undefined): boolean {
  if (!d) return true
  return (
    d.band.position === 'left' &&
    d.band.width === 1 &&
    d.logo.zone === 'bottom' &&
    d.logo.offset.x === 0 &&
    d.logo.accentRules === true &&
    d.chip.theme === 'black' &&
    d.chip.scale === 1 &&
    d.chip.grade10Color === null &&
    d.text.scale === 1 &&
    d.border.enabled === false
  )
}

/** Deep-equal enough for undo stacks and dirty checks. */
export function designEquals(a: OrgLabelDesign, b: OrgLabelDesign): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
