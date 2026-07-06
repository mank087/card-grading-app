/**
 * Label Lab style specs — every background the production Label Studio can
 * produce, described in one renderable + evaluable shape.
 *
 * A LabStyleSpec is the contract between three consumers:
 *   - customSlabPdfBlock.tsx renders it as vector PDF
 *   - contrastWCAG.evaluateLabelBackground() scores it
 *   - the gauntlet sheet iterates a list of them
 *
 * Builders mirror the EXACT production semantics in
 * src/lib/customSlabLabelGenerator.ts drawCustomBackground() and
 * src/lib/labelPresets.ts CARD_COLOR_STYLES / applyLayoutToColors:
 * rainbow = horizontal 7-stop; card-extension = horizontal multi-stop +
 * bottom darkening fade; team-colors = soft split at 45/55%; geometric =
 * polygon regions + 10% darken overlay; default modern = 3-stop
 * start/end/start at the config angle.
 */

import { COLOR_PRESETS, CARD_COLOR_STYLES, applyLayoutToColors, resolveConfigTextPolarity, resolveGradeColor, resolveFontScale } from '@/lib/labelPresets'
import type { CardColorInput, CustomLabelConfig } from '@/lib/labelPresets'
import { evaluateLabelBackground, type BackgroundContrastReport } from './contrastWCAG'

// ------- Spec shape -------

export interface LabGradientStop {
  color: string
  /** 0..1 position along the gradient axis */
  offset: number
}

export interface LabStyleSpec {
  id: string
  name: string
  source: 'preset' | 'card-colors' | 'custom'
  background: {
    /** Multi-stop linear gradient. A solid color is one pair of identical stops. */
    stops: LabGradientStop[]
    /** Degrees; 0 = left-to-right, 90 = top-to-bottom (production canvas convention). */
    angleDeg: number
  }
  /** Production overlays that darken the background for depth/readability. */
  overlay?: { kind: 'bottom-fade'; opacity: number } | { kind: 'darken'; opacity: number } | { kind: 'modern-glow' }
  /** Geometric pattern: polygon regions REPLACE the gradient visually. */
  pattern?: { idx: number; colors: string[] }
  border?: { color: string; widthIn: number }
  /** What production would render the text in. */
  textColor: string
  accentColor: string
  /** Resolved grade-digit color (user override or polarity default). Absent
      on lab-only specs — consumers fall back to their historical pair. */
  gradeColor?: string
  /** Resolved typography scale (1 = historical sizes). */
  fontScale?: number
  /** Colors text actually sits on, for contrast eval. */
  contrastStops: string[]
  /** True when regions are hard-edged (split/geometric) — no interpolation. */
  contrastDiscrete: boolean
}

export function evaluateSpec(spec: LabStyleSpec, threshold = 7): BackgroundContrastReport {
  return evaluateLabelBackground({
    stops: spec.contrastStops,
    textHex: spec.textColor,
    discrete: spec.contrastDiscrete,
    threshold,
  })
}

// ------- Shared color math (mirrors labelPresets mixHex) -------

function mixHex(hex1: string, hex2: string, ratio: number): string {
  const parse = (h: string) => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h)
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0]
  }
  const c1 = parse(hex1)
  const c2 = parse(hex2)
  const mix = (i: number) => Math.round(c1[i] * (1 - ratio) + c2[i] * ratio).toString(16).padStart(2, '0')
  return `#${mix(0)}${mix(1)}${mix(2)}`
}

function evenStops(colors: string[]): LabGradientStop[] {
  if (colors.length === 1) return [{ color: colors[0], offset: 0 }, { color: colors[0], offset: 1 }]
  return colors.map((color, i) => ({ color, offset: i / (colors.length - 1) }))
}

/** Production's rainbow stops (drawCustomBackground). */
export const RAINBOW_STOPS: LabGradientStop[] = [
  { color: '#ff0000', offset: 0 },
  { color: '#ff8800', offset: 0.17 },
  { color: '#ffff00', offset: 0.33 },
  { color: '#00cc00', offset: 0.5 },
  { color: '#0066ff', offset: 0.67 },
  { color: '#8800ff', offset: 0.83 },
  { color: '#ff00ff', offset: 1 },
]

// ------- Preset specs -------

/**
 * Build a spec for one of the static COLOR_PRESETS. Modern-style presets
 * get the production 3-stop start/end/start gradient at 135° + glow;
 * traditional gets the plain 2-stop.
 */
export function presetSpec(presetId: string): LabStyleSpec | null {
  const p = COLOR_PRESETS.find(c => c.id === presetId)
  if (!p || p.isCardColors || p.isCustom) return null

  if (p.isRainbow) {
    return {
      id: p.id,
      name: p.name,
      source: 'preset',
      background: { stops: RAINBOW_STOPS, angleDeg: 0 },
      textColor: '#ffffff', // production: card-color-class presets force white + outline
      accentColor: '#ffffff',
      contrastStops: RAINBOW_STOPS.map(s => s.color),
      contrastDiscrete: false,
    }
  }

  const isLight = p.id === 'traditional'
  return {
    id: p.id,
    name: p.name,
    source: 'preset',
    background: {
      stops: isLight
        ? evenStops([p.gradientStart, p.gradientEnd])
        : [
            { color: p.gradientStart, offset: 0 },
            { color: p.gradientEnd, offset: 0.5 },
            { color: p.gradientStart, offset: 1 },
          ],
      angleDeg: 135,
    },
    overlay: isLight ? undefined : { kind: 'modern-glow' },
    textColor: isLight ? '#1f2937' : '#ffffff',
    accentColor: isLight ? '#2563eb' : 'rgba(34,197,94,0.9)',
    contrastStops: [p.gradientStart, p.gradientEnd],
    contrastDiscrete: false,
  }
}

/** The static presets worth printing (excludes the two meta presets). */
export const PRESET_IDS = ['midnight', 'modern-dark', 'traditional', 'royal-blue', 'crimson', 'rainbow'] as const

// ------- Card-color style specs -------

/**
 * Build the five card-color styles from a card's extracted colors, exactly
 * as the Studio computes them (CARD_COLOR_STYLES.getColors) and exactly as
 * the canvas paints them (drawCustomBackground per-preset branches).
 */
export function cardColorSpecs(colors: CardColorInput & { palette?: string[] }): LabStyleSpec[] {
  const out: LabStyleSpec[] = []

  for (const style of CARD_COLOR_STYLES) {
    const r = style.getColors(colors)

    if (style.id === 'color-gradient') {
      out.push({
        id: style.id,
        name: style.name,
        source: 'card-colors',
        background: { stops: evenStops([r.gradientStart, r.gradientEnd]), angleDeg: 135 },
        textColor: r.textColor,
        accentColor: r.accentColor,
        contrastStops: [r.gradientStart, r.gradientEnd],
        contrastDiscrete: false,
      })
    } else if (style.id === 'card-extension') {
      const stops = r.topEdgeGradient && r.topEdgeGradient.length >= 3
        ? r.topEdgeGradient
        : [r.gradientStart, r.gradientEnd]
      out.push({
        id: style.id,
        name: style.name,
        source: 'card-colors',
        background: { stops: evenStops(stops), angleDeg: 0 },
        overlay: { kind: 'bottom-fade', opacity: 0.25 },
        textColor: r.textColor,
        accentColor: r.accentColor,
        // Bottom fade darkens up to 25% — text sits between the raw stop
        // and its darkened version, so evaluate the raw stops (worst case
        // for light text is the undarkened color).
        contrastStops: stops,
        contrastDiscrete: false,
      })
    } else if (style.id === 'neon-outline') {
      out.push({
        id: style.id,
        name: style.name,
        source: 'card-colors',
        background: { stops: evenStops([r.gradientStart, r.gradientEnd]), angleDeg: 135 },
        border: { color: r.accentColor, widthIn: 0.03 },
        textColor: r.textColor,
        accentColor: r.accentColor,
        contrastStops: [r.gradientStart, r.gradientEnd],
        contrastDiscrete: false,
      })
    } else if (style.id === 'geometric') {
      const patternColors = colors.palette && colors.palette.length >= 2
        ? colors.palette
        : [r.gradientStart, r.gradientEnd]
      out.push({
        id: style.id,
        name: `${style.name} (Shattered Glass)`,
        source: 'card-colors',
        background: { stops: evenStops([r.gradientStart, r.gradientEnd]), angleDeg: 135 },
        pattern: { idx: 0, colors: patternColors },
        overlay: { kind: 'darken', opacity: 0.1 },
        textColor: r.textColor,
        accentColor: r.accentColor,
        // Text can sit on ANY region color; hard edges mean no interpolation.
        contrastStops: patternColors.map(c => mixHex(c, '#000000', 0.1)),
        contrastDiscrete: true,
      })
    } else if (style.id === 'team-colors') {
      out.push({
        id: style.id,
        name: style.name,
        source: 'card-colors',
        background: {
          stops: [
            { color: r.gradientStart, offset: 0 },
            { color: r.gradientStart, offset: 0.45 },
            { color: r.gradientEnd, offset: 0.55 },
            { color: r.gradientEnd, offset: 1 },
          ],
          angleDeg: 0,
        },
        textColor: r.textColor,
        accentColor: r.accentColor,
        contrastStops: [r.gradientStart, r.gradientEnd],
        contrastDiscrete: true,
      })
    }
  }

  return out
}

// ------- Custom designer spec -------

export interface LabCustomConfig {
  colors: string[]          // 1-5 user colors
  layoutId: string          // one of LAYOUT_STYLES ids or 'simple'
  angleDeg: number          // 0-360
  geometricPattern?: number // 0-4
  borderEnabled: boolean
  borderColor: string
  borderWidthIn: number
}

/**
 * Build a render spec from a PRODUCTION CustomLabelConfig — the persisted
 * shape from the Label Studio (saved styles, mobile customConfig params).
 * Mirrors customSlabLabelGenerator.drawCustomBackground() branch-for-branch
 * and resolves text polarity with the user's textColorMode honored.
 *
 * Used by the production vector slab path; the Label Lab's interactive
 * designer keeps building specs via customSpec() above.
 */
export function specFromCustomConfig(config: CustomLabelConfig): LabStyleSpec {
  const polarity = resolveConfigTextPolarity(config)
  const lightText = polarity === 'light'
  const base = {
    id: `cfg-${config.colorPreset}`,
    name: config.colorPreset,
    source: 'custom' as const,
    textColor: lightText ? '#ffffff' : '#1f2937',
    accentColor: lightText ? 'rgba(34,197,94,0.9)' : '#2563eb',
    // July 2026: user grade color + font scale ride the spec into the vector
    // renderer. lightTheme for the grade = dark-text polarity (light bg).
    gradeColor: resolveGradeColor(config, !lightText),
    fontScale: resolveFontScale(config),
    border: config.borderEnabled && config.borderWidth
      ? { color: config.borderColor, widthIn: config.borderWidth }
      : undefined,
  }
  const angle = config.gradientAngle ?? 135

  if (config.colorPreset === 'rainbow') {
    return {
      ...base,
      background: { stops: RAINBOW_STOPS, angleDeg: 0 },
      contrastStops: RAINBOW_STOPS.map(s => s.color),
      contrastDiscrete: false,
    }
  }
  if (config.colorPreset === 'card-extension') {
    const stops = config.topEdgeGradient && config.topEdgeGradient.length >= 3
      ? config.topEdgeGradient
      : [config.gradientStart, config.gradientEnd]
    return {
      ...base,
      background: { stops: evenStops(stops), angleDeg: 0 },
      overlay: { kind: 'bottom-fade', opacity: 0.25 },
      contrastStops: stops,
      contrastDiscrete: false,
    }
  }
  if (config.colorPreset === 'team-colors') {
    return {
      ...base,
      background: {
        stops: [
          { color: config.gradientStart, offset: 0 },
          { color: config.gradientStart, offset: 0.45 },
          { color: config.gradientEnd, offset: 0.55 },
          { color: config.gradientEnd, offset: 1 },
        ],
        angleDeg: 0,
      },
      contrastStops: [config.gradientStart, config.gradientEnd],
      contrastDiscrete: true,
    }
  }
  if (config.colorPreset === 'geometric') {
    const colors = config.customColors && config.customColors.length >= 2
      ? config.customColors
      : [config.gradientStart, config.gradientEnd]
    return {
      ...base,
      background: { stops: evenStops([config.gradientStart, config.gradientEnd]), angleDeg: angle },
      pattern: { idx: config.geometricPattern ?? 0, colors },
      overlay: { kind: 'darken', opacity: 0.1 },
      contrastStops: colors.map(c => mixHex(c, '#000000', 0.1)),
      contrastDiscrete: true,
    }
  }
  if (config.colorPreset === 'color-gradient' || config.colorPreset === 'neon-outline') {
    return {
      ...base,
      background: { stops: evenStops([config.gradientStart, config.gradientEnd]), angleDeg: angle },
      contrastStops: [config.gradientStart, config.gradientEnd],
      contrastDiscrete: false,
    }
  }
  // Plain presets / simple custom: modern = production 3-stop
  // start/end/start + glow; traditional = flat 2-stop.
  const isModernStyle = config.style === 'modern' && config.colorPreset !== 'traditional'
  return {
    ...base,
    background: {
      stops: isModernStyle
        ? [
            { color: config.gradientStart, offset: 0 },
            { color: config.gradientEnd, offset: 0.5 },
            { color: config.gradientStart, offset: 1 },
          ]
        : evenStops([config.gradientStart, config.gradientEnd]),
      angleDeg: angle,
    },
    overlay: isModernStyle ? { kind: 'modern-glow' } : undefined,
    contrastStops: [config.gradientStart, config.gradientEnd],
    contrastDiscrete: false,
  }
}

/**
 * Build a spec from lab custom-designer state, routed through the SAME
 * applyLayoutToColors the Studio uses so layout semantics can't drift.
 */
export function customSpec(cfg: LabCustomConfig): LabStyleSpec {
  const partial = applyLayoutToColors(cfg.layoutId, cfg.colors)
  const start = partial.gradientStart || cfg.colors[0] || '#1a1625'
  const end = partial.gradientEnd || cfg.colors[1] || cfg.colors[0] || '#2d1f47'
  const preset = partial.colorPreset || 'custom'

  const base: Omit<LabStyleSpec, 'background' | 'contrastStops' | 'contrastDiscrete'> = {
    id: `custom-${preset}`,
    name: `Custom — ${preset}`,
    source: 'custom',
    textColor: '#ffffff', // production: card-color-class presets force white text
    accentColor: '#ffffff',
    border: cfg.borderEnabled || partial.borderEnabled
      ? {
          color: partial.borderColor || cfg.borderColor,
          widthIn: partial.borderWidth || cfg.borderWidthIn || 0.03,
        }
      : undefined,
  }

  if (preset === 'card-extension') {
    const stops = partial.topEdgeGradient && partial.topEdgeGradient.length >= 3
      ? partial.topEdgeGradient
      : [start, end]
    return {
      ...base,
      background: { stops: evenStops(stops), angleDeg: 0 },
      overlay: { kind: 'bottom-fade', opacity: 0.25 },
      contrastStops: stops,
      contrastDiscrete: false,
    }
  }
  if (preset === 'team-colors') {
    return {
      ...base,
      background: {
        stops: [
          { color: start, offset: 0 },
          { color: start, offset: 0.45 },
          { color: end, offset: 0.55 },
          { color: end, offset: 1 },
        ],
        angleDeg: 0,
      },
      contrastStops: [start, end],
      contrastDiscrete: true,
    }
  }
  if (preset === 'geometric') {
    const patternColors = cfg.colors.length >= 2 ? cfg.colors : [start, end]
    return {
      ...base,
      background: { stops: evenStops([start, end]), angleDeg: cfg.angleDeg },
      pattern: { idx: cfg.geometricPattern ?? 0, colors: patternColors },
      overlay: { kind: 'darken', opacity: 0.1 },
      contrastStops: patternColors.map(c => mixHex(c, '#000000', 0.1)),
      contrastDiscrete: true,
    }
  }
  // color-gradient / neon-outline / simple gradient
  return {
    ...base,
    background: { stops: evenStops([start, end]), angleDeg: cfg.angleDeg },
    contrastStops: [start, end],
    contrastDiscrete: false,
  }
}