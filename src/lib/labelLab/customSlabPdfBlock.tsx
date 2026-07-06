/**
 * Custom-style vector slab block — renders any LabStyleSpec (preset,
 * card-color style, or custom designer config) as a vector PDF label,
 * using the IDENTICAL content row as the Modern/Traditional replicas.
 *
 * Background semantics ported 1:1 from production canvas
 * (customSlabLabelGenerator.ts drawCustomBackground):
 *   - multi-stop linear gradient at arbitrary angle
 *   - card-extension bottom fade (black 0 -> 0.25 vertical)
 *   - geometric patterns 0-4 as SVG polygons + 10% darken overlay
 *   - team-colors soft split (handled upstream as 4-stop gradient)
 *   - border drawn inset from the label edge (neon outline et al)
 *
 * RGBA RULE: no rgba() strings anywhere inside <Svg> (fills, strokes,
 * stops) and none in View borderColor — react-pdf's parser corrupts the
 * paint (renders green). Use hex + *Opacity props. See
 * scripts/test-gradient-isolation.tsx.
 */

import React from 'react'
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Svg,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Rect,
  Path,
  Line,
} from '@react-pdf/renderer'
import {
  SlabFrontContentRow,
  SLAB_LABEL_W_PT,
  SLAB_LABEL_H_PT,
  type SlabLabelInputs,
  type SlabTextPalette,
} from './slabLabelPdfDoc'
import type { LabStyleSpec } from './labStyleSpecs'
import { parseHex, relativeLuminanceWCAG } from './contrastWCAG'

const W = SLAB_LABEL_W_PT // 201.6
const H = SLAB_LABEL_H_PT // 57.6
const INCH = 72

// ============================================================================
// Palette derivation
// ============================================================================

/** True when the spec's text color is light (white-ish). */
export function specHasLightText(spec: LabStyleSpec): boolean {
  const rgb = parseHex(spec.textColor)
  return rgb ? relativeLuminanceWCAG(rgb) >= 0.5 : true
}

/**
 * Derive the content-row palette from a spec's chosen text color. The
 * dark-text branch uses the production traditional/custom-light set
 * (purple grade + divider, gray body) so vector output matches the canvas
 * renderer for light backgrounds.
 */
export function paletteFromSpec(spec: LabStyleSpec): SlabTextPalette {
  // July 2026: spec.gradeColor carries the user's grade-color choice (already
  // resolved/validated by specFromCustomConfig); absent on lab-only specs.
  return specHasLightText(spec)
    ? {
        name: spec.textColor,
        muted: 'rgba(255,255,255,0.72)',
        accent: spec.accentColor || '#ffffff',
        grade: spec.gradeColor || spec.textColor,
        condition: 'rgba(255,255,255,0.85)',
        gradeDivider: null,
        logo: 'white',
      }
    : {
        name: spec.textColor,
        muted: '#4b5563',
        accent: spec.accentColor || '#2563eb',
        grade: spec.gradeColor || '#7c3aed',
        condition: '#6b46c1',
        gradeDivider: '#7c3aed',
        logo: 'color',
      }
}

// ============================================================================
// Block
// ============================================================================

export function CustomSlabLabelBlock({
  inputs,
  spec,
  idSuffix,
  bleedPt = 0,
}: {
  inputs: Omit<SlabLabelInputs, 'theme'>
  spec: LabStyleSpec
  idSuffix: string
  /** When set, the background paints bleedPt past the label rect on every
      side (print docs). The parent must not clip. */
  bleedPt?: number
}) {
  return (
    <>
      <SpecBackground
        spec={spec}
        idSuffix={idSuffix}
        w={W + bleedPt * 2}
        h={H + bleedPt * 2}
        offsetX={bleedPt}
        offsetY={bleedPt}
      />
      <SpecBorder spec={spec} />
      <SlabFrontContentRow inputs={inputs} palette={paletteFromSpec(spec)} fontScale={spec.fontScale || 1} />
    </>
  )
}

// ============================================================================
// Background renderer
// ============================================================================

/** Convert a production gradient angle (0° = to-right, 90° = to-bottom) to SVG percent coords. */
function angleToCoords(angleDeg: number): { x1: string; y1: string; x2: string; y2: string } {
  const a = (angleDeg * Math.PI) / 180
  const dx = Math.cos(a)
  const dy = Math.sin(a)
  const pct = (n: number) => `${Math.round(n * 100) / 100}%`
  return {
    x1: pct(50 - dx * 50),
    y1: pct(50 - dy * 50),
    x2: pct(50 + dx * 50),
    y2: pct(50 + dy * 50),
  }
}

export function SpecBackground({
  spec,
  idSuffix,
  w = W,
  h = H,
  offsetX = 0,
  offsetY = 0,
}: {
  spec: LabStyleSpec
  idSuffix: string
  /** Painted size — pass label + 2×bleed for print docs (production paints
      the background across the bleed ring). */
  w?: number
  h?: number
  /** Shift left/up relative to the parent label rect (the bleed amount). */
  offsetX?: number
  offsetY?: number
}) {
  const coords = angleToCoords(spec.background.angleDeg)
  const gradId = `lab-spec-${idSuffix}`
  const fadeId = `lab-fade-${idSuffix}`

  return (
    <Svg
      style={{ position: 'absolute', top: -offsetY, left: -offsetX, width: w, height: h }}
      viewBox={`0 0 ${w} ${h}`}
    >
      <Defs>
        <SvgLinearGradient id={gradId} x1={coords.x1} y1={coords.y1} x2={coords.x2} y2={coords.y2}>
          {spec.background.stops.map((s, i) => (
            <Stop key={i} offset={`${Math.round(s.offset * 1000) / 10}%`} stopColor={s.color} />
          ))}
        </SvgLinearGradient>
        {spec.overlay?.kind === 'bottom-fade' ? (
          <SvgLinearGradient id={fadeId} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#000000" stopOpacity={0} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={spec.overlay.opacity} />
          </SvgLinearGradient>
        ) : null}
      </Defs>

      {/* Base: gradient (or pattern polygons drawn over it) */}
      <Rect x={0} y={0} width={w} height={h} fill={`url(#${gradId})`} />
      {spec.pattern ? <GeometricPattern idx={spec.pattern.idx} colors={spec.pattern.colors} w={w} h={h} /> : null}

      {/* Overlays */}
      {spec.overlay?.kind === 'bottom-fade' ? (
        <Rect x={0} y={0} width={w} height={h} fill={`url(#${fadeId})`} />
      ) : null}
      {spec.overlay?.kind === 'darken' ? (
        <Rect x={0} y={0} width={w} height={h} fill="#000000" fillOpacity={spec.overlay.opacity} />
      ) : null}
      {spec.overlay?.kind === 'modern-glow' ? (
        <Rect x={0} y={0} width={w} height={h} fill="#8b5cf6" fillOpacity={0.1} />
      ) : null}
    </Svg>
  )
}

/**
 * Border drawn at LABEL coordinates (inside the cut line, like production's
 * drawBorder) — separate from SpecBackground so the background can expand
 * into the bleed while the border stays fully inside the trimmed label.
 */
export function SpecBorder({ spec }: { spec: LabStyleSpec }) {
  if (!spec.border) return null
  const borderPt = Math.max(0.5, spec.border.widthIn * INCH)
  return (
    <Svg
      style={{ position: 'absolute', top: 0, left: 0, width: W, height: H }}
      viewBox={`0 0 ${W} ${H}`}
    >
      <Rect
        x={borderPt / 2}
        y={borderPt / 2}
        width={W - borderPt}
        height={H - borderPt}
        fill="none"
        stroke={spec.border.color}
        strokeWidth={borderPt}
      />
    </Svg>
  )
}

// ============================================================================
// Geometric patterns — 1:1 ports of customSlabLabelGenerator.ts polygons
// ============================================================================

type Poly = { d: string; fill: string }
type Divider = { d: string }

function pathOf(points: [number, number][], close = true): string {
  const [first, ...rest] = points
  return (
    `M ${first[0].toFixed(2)} ${first[1].toFixed(2)} ` +
    rest.map(p => `L ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ') +
    (close ? ' Z' : '')
  )
}

function buildPattern(idx: number, colors: string[], W: number, H: number): { polys: Poly[]; dividers: Divider[] } {
  const pick = (i: number) => colors[((i % colors.length) + colors.length) % colors.length]
  const polys: Poly[] = []
  const dividers: Divider[] = []

  if (idx === 0) {
    // Shattered Glass: triangular shards radiating from a focal point
    const cx = W * 0.35
    const cy = H * 0.4
    const edge: [number, number][] = [
      [0, 0], [W * 0.33, 0], [W * 0.66, 0], [W, 0],
      [W, H * 0.5], [W, H],
      [W * 0.66, H], [W * 0.33, H], [0, H],
      [0, H * 0.5],
    ]
    for (let i = 0; i < edge.length; i++) {
      const a = edge[i]
      const b = edge[(i + 1) % edge.length]
      const d = pathOf([[cx, cy], a, b])
      polys.push({ d, fill: pick(i) })
      dividers.push({ d })
    }
  } else if (idx === 1) {
    // Diagonal Stripes: 7 bands at ~30°
    const n = 7
    const bandW = W / n
    const skew = H * Math.tan((30 * Math.PI) / 180)
    for (let i = -1; i <= n; i++) {
      const x0 = i * bandW
      polys.push({
        d: pathOf([
          [x0 - skew, 0],
          [x0 + bandW - skew, 0],
          [x0 + bandW, H],
          [x0, H],
        ]),
        fill: pick(i + 1),
      })
    }
    for (let i = 0; i <= n; i++) {
      const x0 = i * bandW
      dividers.push({ d: pathOf([[x0 - skew, 0], [x0, H]], false) })
    }
  } else if (idx === 2) {
    // Fractured: 5 unique-color regions split by 3 angled + 1 horizontal divider
    const c5: string[] = []
    for (let ci = 0; ci < 5; ci++) {
      const c = colors[ci % colors.length]
      if (c5.includes(c)) {
        const r = parseInt(c.slice(1, 3), 16)
        const g = parseInt(c.slice(3, 5), 16)
        const b = parseInt(c.slice(5, 7), 16)
        const adj = ci % 2 === 0 ? 30 : -30
        c5.push('#' + [r, g, b].map(v => Math.max(0, Math.min(255, v + adj)).toString(16).padStart(2, '0')).join(''))
      } else {
        c5.push(c)
      }
    }
    const d1x = W * 0.12
    const d2x = W * 0.38
    const d3x = W * 0.62
    const hY = H * 0.45
    polys.push({ d: pathOf([[0, 0], [d1x, 0], [d1x + W * 0.08, H], [0, H]]), fill: c5[0] })
    polys.push({ d: pathOf([[d1x, 0], [d2x, 0], [d2x + W * 0.05, H], [d1x + W * 0.08, H]]), fill: c5[1] })
    polys.push({ d: pathOf([[d2x, 0], [d3x, 0], [d3x - W * 0.03, H], [d2x + W * 0.05, H]]), fill: c5[2] })
    polys.push({ d: pathOf([[d3x, 0], [W, 0], [W, hY], [d3x - W * 0.01, hY]]), fill: c5[3] })
    polys.push({ d: pathOf([[d3x - W * 0.01, hY], [W, hY], [W, H], [d3x - W * 0.03, H]]), fill: c5[4] })
    dividers.push({ d: pathOf([[d1x, 0], [d1x + W * 0.08, H]], false) })
    dividers.push({ d: pathOf([[d2x, 0], [d2x + W * 0.05, H]], false) })
    dividers.push({ d: pathOf([[d3x, 0], [d3x - W * 0.03, H]], false) })
    dividers.push({ d: pathOf([[d3x - W * 0.01, hY], [W, hY]], false) })
  } else if (idx === 3) {
    // Mosaic Grid: 5x2 tiles
    const cols = 5
    const rows = 2
    const tw = W / cols
    const th = H / rows
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        polys.push({
          d: pathOf([[c * tw, r * th], [(c + 1) * tw, r * th], [(c + 1) * tw, (r + 1) * th], [c * tw, (r + 1) * th]]),
          fill: pick(r * cols + c),
        })
      }
    }
    for (let c = 1; c < cols; c++) dividers.push({ d: pathOf([[c * tw, 0], [c * tw, H]], false) })
    for (let r = 1; r < rows; r++) dividers.push({ d: pathOf([[0, r * th], [W, r * th]], false) })
  } else {
    // Lightning Bolt zigzag
    const zig: [number, number][] = [
      [W * 0.3, 0],
      [W * 0.55, H * 0.3],
      [W * 0.35, H * 0.45],
      [W * 0.65, H * 0.7],
      [W * 0.5, H],
    ]
    polys.push({ d: pathOf([[0, 0], zig[0], ...zig, [0, H]]), fill: pick(0) })
    polys.push({ d: pathOf([[W, 0], zig[0], ...zig, [W, H]]), fill: pick(1) })
    if (colors.length >= 3) {
      const off = W * 0.08
      const shifted: [number, number][] = zig.map(([x, y]) => [x - off, y])
      polys.push({ d: pathOf([...shifted, zig[zig.length - 1], ...[...zig].reverse()]), fill: pick(2) })
    }
    dividers.push({ d: pathOf(zig, false) })
  }

  return { polys, dividers }
}

function GeometricPattern({ idx, colors, w = W, h = H }: { idx: number; colors: string[]; w?: number; h?: number }) {
  // Production: strokeStyle rgba(0,0,0,0.9), lineWidth 2.5 * (min(W,H)/400)
  const strokeW = 2.5 * (Math.min(w, h) / 400)
  const { polys, dividers } = buildPattern(idx, colors, w, h)
  return (
    <>
      {polys.map((p, i) => (
        <Path key={`p-${i}`} d={p.d} fill={p.fill} />
      ))}
      {dividers.map((d, i) => (
        <Path key={`d-${i}`} d={d.d} fill="none" stroke="#000000" strokeOpacity={0.9} strokeWidth={strokeW} />
      ))}
    </>
  )
}

// ============================================================================
// Back block — spec-driven replica of the production back label
// (QR + emblems | centered grade | right-aligned subgrades)
// ============================================================================

// Production back geometry at 300 DPI px -> pt (x 0.24)
const BK_PADDING = 18 * 0.24            // 4.32
const BK_QR_SIZE = H * 0.72             // 41.47
const BK_QR_X = BK_PADDING + 12 * 0.24  // 7.2
const BK_GRADE_PT = 88 * 0.24           // 21.12
const BK_COND_PT = 24 * 0.24            // 5.76
const BK_SUB_PT = 26 * 0.24             // 6.24
const BK_SUB_LH = 36 * 0.24             // 8.64
const BK_SUB_RIGHT_INSET = (18 + 30) * 0.24 // padding + cut-line inset = 11.52
const BADGE_SYMBOL = 28 * 0.24          // 6.72
const BADGE_TEXT = 16 * 0.24            // 3.84
const BADGE_SPACING = 36 * 0.24         // 8.64

// SVG glyphs for badge symbols — the WinAnsi base-14 fonts cannot encode
// the canvas renderer's unicode glyphs, so we draw shapes.
const STAR_D = 'M12 2 L14.9 8.6 L22 9.3 L16.7 14 L18.2 21 L12 17.3 L5.8 21 L7.3 14 L2 9.3 L9.1 8.6 Z'
const HEART_D = 'M12 21 C5 14 2 10.5 2 7.5 C2 4.5 4.5 3 7 3 C9 3 11 4.5 12 6 C13 4.5 15 3 17 3 C19.5 3 22 4.5 22 7.5 C22 10.5 19 14 12 21 Z'
const DIAMOND_D = 'M12 2 L22 12 L12 22 L2 12 Z'

function BadgeColumn({
  glyphD,
  label,
  symbolColor,
  textColor,
}: {
  glyphD: string
  label: string
  symbolColor: string
  textColor: string
}) {
  const rotH = 26 // vertical room for the rotated label
  return (
    <View style={{ width: BADGE_SPACING, alignItems: 'center', justifyContent: 'center' }}>
      <Svg style={{ width: BADGE_SYMBOL, height: BADGE_SYMBOL }} viewBox="0 0 24 24">
        <Path d={glyphD} fill={symbolColor} />
      </Svg>
      <View style={{ width: BADGE_TEXT + 2, height: rotH, alignItems: 'center', justifyContent: 'center', marginTop: 1.5 }}>
        <Text
          style={{
            fontFamily: 'Helvetica-Bold',
            fontSize: BADGE_TEXT,
            color: textColor,
            width: rotH,
            textAlign: 'center',
            transform: 'rotate(-90deg)',
          }}
        >
          {label}
        </Text>
      </View>
    </View>
  )
}

export interface SlabBackInputs {
  grade: string
  condition: string
  qrCodeDataUrl?: string | null
  subgrades?: {
    centering?: number | null
    corners?: number | null
    edges?: number | null
    surface?: number | null
  }
  showFounderEmblem?: boolean
  showVipEmblem?: boolean
  showCardLoversEmblem?: boolean
}

/**
 * Spec-driven back label at exact label size. Parent must be a View sized
 * SLAB_LABEL_W_PT x SLAB_LABEL_H_PT. Three absolute layers mirror the
 * canvas renderer: left QR + emblem strip, full-width centered grade,
 * right-aligned subgrades.
 */
export function CustomSlabBackBlock({
  inputs,
  spec,
  idSuffix,
  bleedPt = 0,
}: {
  inputs: SlabBackInputs
  spec: LabStyleSpec
  idSuffix: string
  bleedPt?: number
}) {
  const lightText = specHasLightText(spec)
  const gradeColor = spec.gradeColor || (lightText ? '#FFFFFF' : '#7c3aed')
  const condColor = lightText ? 'rgba(255,255,255,0.8)' : '#6b46c1'
  const subColor = lightText ? 'rgba(255,255,255,0.95)' : '#4b5563'
  const condPt = fitBackCondition(inputs.condition)
  const qrFrameFill = spec.background.stops[0]?.color || '#1a1625'

  return (
    <>
      <SpecBackground
        spec={spec}
        idSuffix={idSuffix}
        w={W + bleedPt * 2}
        h={H + bleedPt * 2}
        offsetX={bleedPt}
        offsetY={bleedPt}
      />
      <SpecBorder spec={spec} />

      {/* Layer 1: QR + emblems (left) */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: W,
          height: H,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <View style={{ width: BK_QR_X }} />
        {/* QR frame: dark themes get the purple glow frame, light themes a flat white pad */}
        <View
          style={{
            padding: lightText ? 0.72 : 1.92,
            backgroundColor: lightText ? qrFrameFill : '#FFFFFF',
            borderWidth: lightText ? 0.5 : 0,
            borderColor: '#8b5cf6',
          }}
        >
          <View style={{ padding: lightText ? 0.72 : 0.48, backgroundColor: '#FFFFFF' }}>
            {inputs.qrCodeDataUrl ? (
              <Image src={inputs.qrCodeDataUrl} style={{ width: BK_QR_SIZE, height: BK_QR_SIZE }} />
            ) : (
              <View style={{ width: BK_QR_SIZE, height: BK_QR_SIZE, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 4, color: '#9ca3af' }}>QR</Text>
              </View>
            )}
          </View>
        </View>
        <View style={{ width: lightText ? 6.72 : 4.8 }} />
        {inputs.showFounderEmblem ? (
          <BadgeColumn
            glyphD={STAR_D}
            label="FOUNDER"
            symbolColor={lightText ? '#FFD700' : '#d97706'}
            textColor={lightText ? '#FFFFFF' : '#7c3aed'}
          />
        ) : null}
        {inputs.showCardLoversEmblem ? (
          <BadgeColumn
            glyphD={HEART_D}
            label="Card Lover"
            symbolColor="#f43f5e"
            textColor={lightText ? '#FFFFFF' : '#f43f5e'}
          />
        ) : null}
        {inputs.showVipEmblem ? (
          <BadgeColumn
            glyphD={DIAMOND_D}
            label="VIP"
            symbolColor="#6366f1"
            textColor={lightText ? '#FFFFFF' : '#6366f1'}
          />
        ) : null}
      </View>

      {/* Layer 2: grade + condition, centered on the full label like production */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: W,
          height: H,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: BK_GRADE_PT * (spec.fontScale || 1), color: gradeColor, lineHeight: 1 }}>
          {inputs.grade}
        </Text>
        {inputs.condition ? (
          <Text
            style={{
              fontFamily: 'Helvetica-Bold',
              fontSize: condPt,
              color: condColor,
              marginTop: 1.9,
              letterSpacing: 0.4,
            }}
          >
            {inputs.condition.toUpperCase()}
          </Text>
        ) : null}
      </View>

      {/* Layer 3: subgrades, right-aligned */}
      {inputs.subgrades ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: W,
            height: H,
            justifyContent: 'center',
            alignItems: 'flex-end',
            paddingRight: BK_SUB_RIGHT_INSET,
          }}
        >
          {(['centering', 'corners', 'edges', 'surface'] as const).map(k => {
            const v = inputs.subgrades?.[k]
            if (v == null || isNaN(Number(v))) return null
            return (
              <Text
                key={k}
                style={{
                  fontFamily: 'Helvetica',
                  fontSize: BK_SUB_PT,
                  color: subColor,
                  textAlign: 'right',
                  lineHeight: BK_SUB_LH / BK_SUB_PT,
                }}
              >
                {labelOfSub(k)}: {Math.round(Number(v))}
              </Text>
            )
          })}
        </View>
      ) : null}
    </>
  )
}

function labelOfSub(k: 'centering' | 'corners' | 'edges' | 'surface'): string {
  switch (k) {
    case 'centering': return 'Centering'
    case 'corners': return 'Corners'
    case 'edges': return 'Edges'
    case 'surface': return 'Surface'
  }
}

/** Back condition auto-shrink (24px down to 12px at 300 DPI, like production). */
function fitBackCondition(text: string): number {
  const maxW = W - BK_PADDING * 2 - 9.6
  const len = (text || '').length || 1
  let pt = BK_COND_PT
  const min = 12 * 0.24
  while (pt > min && len * pt * 0.58 > maxW) pt -= 0.25
  return Math.max(min, pt)
}

// ============================================================================
// Single-label document (custom-style format preview/download)
// ============================================================================

const PAGE_W = 8.5 * INCH
const PAGE_H = 11 * INCH
const LABEL_X = (PAGE_W - W) / 2
const LABEL_Y = (PAGE_H - H) / 2

export function CustomSlabPdfDoc({
  inputs,
  spec,
  verdictLine,
}: {
  inputs: Omit<SlabLabelInputs, 'theme'>
  spec: LabStyleSpec
  verdictLine?: string
}) {
  return (
    <Document>
      <Page size="LETTER" style={{ backgroundColor: '#FFFFFF' }}>
        {/* Header */}
        <View style={{ position: 'absolute', top: 40, left: 40, right: 40 }}>
          <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#111827' }}>
            Label Lab — Custom Style: {spec.name}
          </Text>
          {verdictLine ? (
            <Text style={{ fontSize: 6, color: '#6b7280', marginTop: 2 }}>{verdictLine}</Text>
          ) : null}
        </View>

        {/* Cut guide — neutral gray so it's visible regardless of label theme */}
        <Svg
          style={{ position: 'absolute', top: 0, left: 0, width: PAGE_W, height: PAGE_H }}
          viewBox={`0 0 ${PAGE_W} ${PAGE_H}`}
        >
          <Rect
            x={LABEL_X}
            y={LABEL_Y}
            width={W}
            height={H}
            fill="none"
            stroke="#9ca3af"
            strokeWidth={0.5}
            strokeDasharray="2 2"
          />
          {([
            [LABEL_X - 3, LABEL_Y - 3, LABEL_X + 5, LABEL_Y - 3],
            [LABEL_X - 3, LABEL_Y - 3, LABEL_X - 3, LABEL_Y + 5],
            [LABEL_X + W + 3, LABEL_Y - 3, LABEL_X + W - 5, LABEL_Y - 3],
            [LABEL_X + W + 3, LABEL_Y - 3, LABEL_X + W + 3, LABEL_Y + 5],
            [LABEL_X - 3, LABEL_Y + H + 3, LABEL_X + 5, LABEL_Y + H + 3],
            [LABEL_X - 3, LABEL_Y + H + 3, LABEL_X - 3, LABEL_Y + H - 5],
            [LABEL_X + W + 3, LABEL_Y + H + 3, LABEL_X + W - 5, LABEL_Y + H + 3],
            [LABEL_X + W + 3, LABEL_Y + H + 3, LABEL_X + W + 3, LABEL_Y + H - 5],
          ] as const).map((l, i) => (
            <Line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke="#9ca3af" strokeWidth={0.5} />
          ))}
        </Svg>

        {/* Label */}
        <View style={{ position: 'absolute', left: LABEL_X, top: LABEL_Y, width: W, height: H }}>
          <CustomSlabLabelBlock inputs={inputs} spec={spec} idSuffix="single" />
        </View>
      </Page>
    </Document>
  )
}