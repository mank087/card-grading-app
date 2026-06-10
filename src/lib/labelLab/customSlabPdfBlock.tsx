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

/** Derive the content-row palette from a spec's chosen text color. */
export function paletteFromSpec(spec: LabStyleSpec): SlabTextPalette {
  const rgb = parseHex(spec.textColor)
  const lightText = rgb ? relativeLuminanceWCAG(rgb) >= 0.5 : true
  return lightText
    ? {
        name: spec.textColor,
        muted: 'rgba(255,255,255,0.72)',
        accent: spec.accentColor || '#ffffff',
        grade: spec.textColor,
        condition: 'rgba(255,255,255,0.85)',
        gradeDivider: null,
        logo: 'white',
      }
    : {
        name: spec.textColor,
        muted: '#4b5563',
        accent: spec.accentColor || '#2563eb',
        grade: spec.textColor,
        condition: '#374151',
        gradeDivider: null,
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
}: {
  inputs: Omit<SlabLabelInputs, 'theme'>
  spec: LabStyleSpec
  idSuffix: string
}) {
  return (
    <>
      <SpecBackground spec={spec} idSuffix={idSuffix} />
      <SlabFrontContentRow inputs={inputs} palette={paletteFromSpec(spec)} />
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

function SpecBackground({ spec, idSuffix }: { spec: LabStyleSpec; idSuffix: string }) {
  const coords = angleToCoords(spec.background.angleDeg)
  const gradId = `lab-spec-${idSuffix}`
  const fadeId = `lab-fade-${idSuffix}`
  const borderPt = spec.border ? Math.max(0.5, spec.border.widthIn * INCH) : 0

  return (
    <Svg
      style={{ position: 'absolute', top: 0, left: 0, width: W, height: H }}
      viewBox={`0 0 ${W} ${H}`}
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
      <Rect x={0} y={0} width={W} height={H} fill={`url(#${gradId})`} />
      {spec.pattern ? <GeometricPattern idx={spec.pattern.idx} colors={spec.pattern.colors} /> : null}

      {/* Overlays */}
      {spec.overlay?.kind === 'bottom-fade' ? (
        <Rect x={0} y={0} width={W} height={H} fill={`url(#${fadeId})`} />
      ) : null}
      {spec.overlay?.kind === 'darken' ? (
        <Rect x={0} y={0} width={W} height={H} fill="#000000" fillOpacity={spec.overlay.opacity} />
      ) : null}
      {spec.overlay?.kind === 'modern-glow' ? (
        <Rect x={0} y={0} width={W} height={H} fill="#8b5cf6" fillOpacity={0.1} />
      ) : null}

      {/* Border (neon outline / custom border) — stroked rect inset so the
          full width survives the cut line. */}
      {spec.border ? (
        <Rect
          x={borderPt / 2}
          y={borderPt / 2}
          width={W - borderPt}
          height={H - borderPt}
          fill="none"
          stroke={spec.border.color}
          strokeWidth={borderPt}
        />
      ) : null}
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

function buildPattern(idx: number, colors: string[]): { polys: Poly[]; dividers: Divider[] } {
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

function GeometricPattern({ idx, colors }: { idx: number; colors: string[] }) {
  // Production: strokeStyle rgba(0,0,0,0.9), lineWidth 2.5 * (min(W,H)/400)
  const strokeW = 2.5 * (Math.min(W, H) / 400)
  const { polys, dividers } = buildPattern(idx, colors)
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