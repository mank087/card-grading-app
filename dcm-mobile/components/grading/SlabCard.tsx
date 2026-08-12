import { memo, useState } from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
// expo-image gives us automatic disk caching for remote Supabase signed URLs.
// The bundled logo (used with tintColor below) stays on react-native Image
// since tintColor support is more reliable there.
import { Image as ExpoImage } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/lib/constants'
import { LinearGradient } from 'expo-linear-gradient'
import type { LabelColorOverrides, LabelStyleId } from '@/hooks/useLabelStyle'

/**
 * SlabCard — Renders a card inside a graded slab frame
 * with the DCM label above the card image. Supports modern (default) and
 * traditional layouts plus user color overrides from saved custom styles.
 */

interface SlabCardProps {
  imageUrl: string | null
  displayName: string
  contextLine: string
  serial: string
  grade: number | null
  condition: string
  features?: string[]
  size?: 'sm' | 'md' | 'lg'
  isBack?: boolean
  /** Altered/Authentic card: shows grade "A" / condition "Authentic" (web parity). */
  isAlteredAuthentic?: boolean
  subScores?: { centering: number; corners: number; edges: number; surface: number } | null
  labelStyle?: LabelStyleId
  colorOverrides?: LabelColorOverrides
  qrUrl?: string
  /** Heritage band palette (from card.card_colors); brand purples when absent. */
  heritageBandColors?: string[]
  showFounderEmblem?: boolean
  showVipEmblem?: boolean
  showCardLoversEmblem?: boolean
}

import {
  HERITAGE_BRAND_COLORS,
  HERITAGE_CHIP_BLACK,
  HERITAGE_GRADE_INKS,
  HERITAGE_FALLBACK_INK,
  HERITAGE_THEME,
  HERITAGE_SCREEN_FIELD,
  HERITAGE_SCREEN_EDGE,
  GRADE_10_FOIL_STOPS,
  resolveHeritagePattern,
} from '@/lib/heritage'

const EMBLEMS = {
  founder: { icon: 'star', label: 'Founder', iconColor: '#FFD700', textColor: '#FFFFFF' },
  vip: { icon: 'diamond', label: 'VIP', iconColor: '#6366f1', textColor: '#FFFFFF' },
  cardLovers: { icon: 'heart', label: 'Card Lover', iconColor: '#f43f5e', textColor: '#FFFFFF' },
} as const

const HERITAGE_EMBLEMS = {
  founder: { ...EMBLEMS.founder, iconColor: '#A67C1B', textColor: '#A67C1B' },
  vip: { ...EMBLEMS.vip, iconColor: '#4338CA', textColor: '#4338CA' },
  cardLovers: { ...EMBLEMS.cardLovers, iconColor: '#E11D48', textColor: '#E11D48' },
} as const

const TRADITIONAL_EMBLEMS = {
  founder: { ...EMBLEMS.founder, iconColor: '#d97706', textColor: '#7c3aed' },
  vip: { ...EMBLEMS.vip, iconColor: '#6366f1', textColor: '#6366f1' },
  cardLovers: { ...EMBLEMS.cardLovers, iconColor: '#f43f5e', textColor: '#ec4899' },
} as const

// Build a QR-code image URL from a target URL using a free public QR-as-an-image service.
// We render this via <Image>, mirroring the visual fidelity of the web QRCodeCanvas.
function buildQrImageUrl(target: string, sizePx: number): string {
  const px = Math.max(40, Math.min(480, Math.round(sizePx)))
  return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(target)}&size=${px}x${px}&format=png&ecc=H&margin=0`
}

const RAINBOW_COLORS = ['#ff0000', '#ff8800', '#ffff00', '#00cc00', '#0066ff', '#8800ff', '#ff00ff'] as const
const DEFAULT_MODERN_COLORS = ['#1a1625', '#2d1f47', '#1a1625'] as const

function getWrapperColors(overrides?: LabelColorOverrides): readonly string[] {
  if (!overrides) return DEFAULT_MODERN_COLORS
  if (overrides.isRainbow) return RAINBOW_COLORS
  if (overrides.isCardExtension && overrides.topEdgeGradient && overrides.topEdgeGradient.length >= 2) {
    return overrides.topEdgeGradient
  }
  if (overrides.isNeonOutline) return ['#0a0a0a', '#1a1a2e', '#0a0a0a']
  return [overrides.gradientStart, overrides.gradientEnd, overrides.gradientStart]
}

/**
 * Native band renderer. All 11 web patterns (src/lib/labelLab/bandGeometry.ts)
 * are approximated with plain Views — absolute positioning, transforms
 * (rotate / skewX / skewY), border-triangles and borderRadius — since the
 * binary has no react-native-svg. Each painter measures itself via onLayout
 * (RN can't size children in percent-of-height), paints the base colour behind
 * so no ivory ever shows through, cycles colours with the same q()/gem() order
 * as the web geometry, and clips with overflow:'hidden' on its OWN container
 * (overflow on the outer label hides all children on Android).
 */

/** Web bandGeometry's pickFrom: palette cycle, negative-safe. */
const pickColor = (colors: string[]) => (i: number) =>
  colors[((i % colors.length) + colors.length) % colors.length] || '#7c3aed'

const BAND_STROKE = 'rgba(0,0,0,0.55)'

/** Measured painter shell shared by every pattern below. */
function MeasuredBand({ base, paint }: { base: string; paint: (w: number, h: number) => React.ReactNode }) {
  const [dims, setDims] = useState({ w: 0, h: 0 })
  return (
    <View
      onLayout={e => setDims({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={{ flex: 1, backgroundColor: base, overflow: 'hidden' }}
    >
      {dims.w > 0 && dims.h > 0 ? paint(dims.w, dims.h) : null}
    </View>
  )
}

/** Thin rotated View standing in for an SVG stroke segment. */
function lineNode(key: string, x1: number, y1: number, x2: number, y2: number, sw: number) {
  const len = Math.hypot(x2 - x1, y2 - y1)
  if (len < 0.5) return null
  const deg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI
  return (
    <View
      key={key}
      style={{
        position: 'absolute',
        left: (x1 + x2) / 2 - len / 2,
        top: (y1 + y2) / 2 - sw / 2,
        width: len,
        height: sw,
        backgroundColor: BAND_STROKE,
        transform: [{ rotate: `${deg}deg` }],
      }}
    />
  )
}

/**
 * Diamond mosaic band — mirrors bandGeometry.ts's diamond pattern: two offset
 * columns (x = 25% / 75% of band width) of large rotated squares, row height
 * H/9, second column staggered half a row; base colour behind, diamonds cycle
 * the non-base colours (same n++ order as the web) so none disappears.
 * Measured via onLayout because RN can't size children in percent-of-height.
 */
function DiamondBand({ colors }: { colors: string[] }) {
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const base = colors[0] || '#7c3aed'
  const gem = (i: number) =>
    colors.length > 1 ? (colors[1 + (i % (colors.length - 1))] || '#7c3aed') : '#7c3aed'
  const nodes: React.ReactNode[] = []
  if (dims.h > 0 && dims.w > 0) {
    const size = dims.h / 9
    const half = size * 0.62
    const side = half * Math.SQRT2 // rotated square whose diagonal is 2*half
    let n = 0
    for (let row = -1; row <= Math.ceil(dims.h / size) + 1; row++) {
      for (let col = 0; col < 2; col++) {
        const cx = dims.w * (col === 0 ? 0.25 : 0.75)
        const cy = row * size + (col === 1 ? size / 2 : 0)
        nodes.push(
          <View
            key={`${row}-${col}`}
            style={{
              position: 'absolute',
              left: cx - side / 2,
              top: cy - side / 2,
              width: side,
              height: side,
              transform: [{ rotate: '45deg' }],
              backgroundColor: gem(n++),
            }}
          />
        )
      }
    }
  }
  return (
    <View
      onLayout={e => setDims({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={{ flex: 1, backgroundColor: base, overflow: 'hidden' }}
    >
      {nodes}
    </View>
  )
}

/**
 * Diagonal stripes — web shears H/9 stripes by skew = W (steep ~45° up-right).
 * skewY on a full-width stripe View reproduces the shear exactly; RN skews
 * around the view centre, which only phase-shifts the whole field by W/2, so
 * the loop range is padded to keep both corners covered.
 */
function StripesBand({ colors }: { colors: string[] }) {
  const q = pickColor(colors)
  return (
    <MeasuredBand
      base={q(0)}
      paint={(w, h) => {
        const sh = h / 9
        const extra = Math.ceil(w / sh) + 1 // web: ceil(skew/h)+1, skew = w
        const pad = Math.ceil(w / 2 / sh) + 1 // centre-origin skew phase shift
        const nodes: React.ReactNode[] = []
        for (let i = -1 - extra - pad; i <= 9 + extra + pad; i++) {
          nodes.push(
            <View
              key={i}
              style={{
                position: 'absolute',
                left: 0,
                top: i * sh,
                width: w,
                height: sh + 0.5,
                backgroundColor: q(i + 1 + extra),
                transform: [{ skewY: '-45deg' }],
              }}
            />
          )
        }
        return nodes
      }}
    />
  )
}

/**
 * Chevron — nested Vs, apex down on the centre line (step = H/7, depth =
 * 0.75·step). Each V is two half-width rects skewed towards each other; both
 * halves sit at y + depth/2 so the centre-origin skew lands the edges exactly
 * on the web path (0,y) → (W/2, y+depth) → (W, y).
 */
function ChevronBand({ colors }: { colors: string[] }) {
  const q = pickColor(colors)
  return (
    <MeasuredBand
      base={q(0)}
      paint={(w, h) => {
        const n = 7
        const step = h / n
        const depth = step * 0.75
        const deg = (Math.atan2(depth, w / 2) * 180) / Math.PI
        const nodes: React.ReactNode[] = []
        for (let i = -2; i <= n + 1; i++) {
          const y = i * step
          const fill = q(i + 2)
          const top = y + depth / 2
          nodes.push(
            <View
              key={`l${i}`}
              style={{
                position: 'absolute',
                left: 0,
                top,
                width: w / 2 + 0.5,
                height: step + 0.5,
                backgroundColor: fill,
                transform: [{ skewY: `${deg}deg` }],
              }}
            />,
            <View
              key={`r${i}`}
              style={{
                position: 'absolute',
                left: w / 2 - 0.5,
                top,
                width: w / 2 + 0.5,
                height: step + 0.5,
                backgroundColor: fill,
                transform: [{ skewY: `${-deg}deg` }],
              }}
            />
          )
        }
        return nodes
      }}
    />
  )
}

/**
 * Prism — interlocking triangles off alternating edges (step = H/8). The RN
 * border-triangle trick reproduces the web geometry EXACTLY: a 0×0 View with
 * transparent top/bottom borders of step/2 and a coloured left (or right)
 * border of width W is precisely the triangle (0,y)-(W,y+step/2)-(0,y+step).
 */
function PrismBand({ colors }: { colors: string[] }) {
  const q = pickColor(colors)
  return (
    <MeasuredBand
      base={q(0)}
      paint={(w, h) => {
        const n = 8
        const step = h / n
        const nodes: React.ReactNode[] = []
        for (let i = -1; i <= n; i++) {
          const y = i * step
          nodes.push(
            // Left-edge triangle: (0,y) (W,y+step/2) (0,y+step)
            <View
              key={`a${i}`}
              style={{
                position: 'absolute',
                left: 0,
                top: y,
                width: 0,
                height: 0,
                borderTopWidth: step / 2,
                borderBottomWidth: step / 2,
                borderLeftWidth: w,
                borderTopColor: 'transparent',
                borderBottomColor: 'transparent',
                borderLeftColor: q(i * 2),
              }}
            />,
            // Right-edge triangle: (W,y+step/2) (W,y+step*1.5) (0,y+step)
            <View
              key={`b${i}`}
              style={{
                position: 'absolute',
                left: 0,
                top: y + step / 2,
                width: 0,
                height: 0,
                borderTopWidth: step / 2,
                borderBottomWidth: step / 2,
                borderRightWidth: w,
                borderTopColor: 'transparent',
                borderBottomColor: 'transparent',
                borderRightColor: q(i * 2 + 1),
              }}
            />
          )
        }
        return nodes
      }}
    />
  )
}

/** Web lightning zigzag spine (fractions of W/H) and ribbon width. */
const LIGHTNING_ZIG: [number, number][] = [
  [0.42, 0], [0.10, 0.20], [0.47, 0.28], [0.14, 0.50],
  [0.50, 0.58], [0.18, 0.80], [0.44, 1.0],
]

/**
 * Lightning — a thick jagged ribbon (width 0.34·W) over darker flanks. Each
 * zig segment is a skewX-ed rect whose left edge runs point-to-point along the
 * web's zigzag spine; the right flank is a flat rect the bolt overdraws.
 */
function LightningBand({ colors }: { colors: string[] }) {
  const q = pickColor(colors)
  return (
    <MeasuredBand
      base={q(0)}
      paint={(w, h) => {
        const zig = LIGHTNING_ZIG.map(([x, y]) => [x * w, y * h] as [number, number])
        const off = 0.34 * w
        const nodes: React.ReactNode[] = [
          // Right flank behind the bolt (web fills right of the ribbon with q(1)).
          <View
            key="flank"
            style={{ position: 'absolute', left: 0.52 * w, top: 0, width: w, height: h, backgroundColor: q(1) }}
          />,
        ]
        for (let s = 0; s < zig.length - 1; s++) {
          const [x1, y1] = zig[s]
          const [x2, y2] = zig[s + 1]
          const dy = y2 - y1
          const deg = (Math.atan2(x2 - x1, dy) * 180) / Math.PI
          nodes.push(
            <View
              key={`seg${s}`}
              style={{
                position: 'absolute',
                left: (x1 + x2) / 2,
                top: y1 - 0.5,
                width: off,
                height: dy + 1,
                backgroundColor: q(4),
                transform: [{ skewX: `${deg}deg` }],
              }}
            />
          )
        }
        return nodes
      }}
    />
  )
}

/**
 * Shattered glass — web draws radial cells from a focal point (0.42W, 0.36H)
 * plus two fracture rings. Approximation: a fan of long border-triangle
 * shards rotated around the focal point (colour-strided like the web cells),
 * thin crack lines through the focal, and two ring outlines via borderRadius
 * circles. Not cell-exact, but reads as the same pattern family at label size.
 */
function ShatteredBand({ colors }: { colors: string[] }) {
  const q = pickColor(colors)
  return (
    <MeasuredBand
      base={q(0)}
      paint={(w, h) => {
        const cx = 0.42 * w
        const cy = 0.36 * h
        const L = w + h
        const K = 8
        const halfH = Math.tan(((180 / K + 8) * Math.PI) / 180) * L
        const sw = Math.max(1, w * 0.022)
        const nodes: React.ReactNode[] = []
        for (let k = 0; k < K; k++) {
          const theta = (k / K) * 2 * Math.PI + 0.4
          // Border triangle points RIGHT (apex at the box's right-centre);
          // place the apex on the focal point, body fanning outward.
          const centerX = cx - (L / 2) * Math.cos(theta)
          const centerY = cy - (L / 2) * Math.sin(theta)
          nodes.push(
            <View
              key={`shard${k}`}
              style={{
                position: 'absolute',
                left: centerX - L / 2,
                top: centerY - halfH,
                width: 0,
                height: 0,
                borderTopWidth: halfH,
                borderBottomWidth: halfH,
                borderLeftWidth: L,
                borderTopColor: 'transparent',
                borderBottomColor: 'transparent',
                // Same stride idea as the web (i*2 + r*3) so neighbours differ.
                borderLeftColor: q(k * 2 + (k % 3)),
                transform: [{ rotate: `${(theta * 180) / Math.PI}deg` }],
              }}
            />
          )
        }
        // Radial cracks: through-lines at varied angles ≈ the web's 14 rays.
        for (const a of [15, 55, 95, 130, 170, 210, 250, 300]) {
          nodes.push(
            <View
              key={`crack${a}`}
              style={{
                position: 'absolute',
                left: cx - L,
                top: cy - sw / 2,
                width: 2 * L,
                height: sw,
                backgroundColor: BAND_STROKE,
                transform: [{ rotate: `${a}deg` }],
              }}
            />
          )
        }
        // Concentric fracture rings at the web's 0.34 / 0.66 radii.
        for (const t of [0.34, 0.66]) {
          const r = t * Math.max(w, h) * 0.9
          nodes.push(
            <View
              key={`ring${t}`}
              style={{
                position: 'absolute',
                left: cx - r,
                top: cy - r,
                width: 2 * r,
                height: 2 * r,
                borderRadius: r,
                borderWidth: sw,
                borderColor: BAND_STROKE,
              }}
            />
          )
        }
        return nodes
      }}
    />
  )
}

/** Web fractured break lines: [left y, kink x, kink y, right y] as fractions. */
const FRACTURE_BREAKS: [number, number, number, number][] = [
  [0.26, 0.60, 0.10, 0.20],
  [0.38, 0.35, 0.50, 0.30],
  [0.64, 0.68, 0.52, 0.60],
  [0.78, 0.30, 0.88, 0.86],
]

/**
 * Fractured — five stacked regions split by kinked break lines. Each break is
 * drawn as two skewY-ed rects (left of the kink / right of the kink) that fill
 * from their break line down to the band bottom; painting top-to-bottom lets
 * each lower region overdraw the previous one, exactly like the web's region
 * fills. Thin line segments trace the breaks as the crack strokes.
 */
function FracturedBand({ colors }: { colors: string[] }) {
  const q = pickColor(colors)
  return (
    <MeasuredBand
      base={q(0)}
      paint={(w, h) => {
        const sw = Math.max(1, w * 0.022)
        const nodes: React.ReactNode[] = []
        const cracks: React.ReactNode[] = []
        FRACTURE_BREAKS.forEach((b, j) => {
          const [ly, kx, ky, ry] = b
          const fill = q(j + 1)
          const lw = kx * w
          const rw = (1 - kx) * w
          const tanL = ((ky - ly) * h) / lw
          const tanR = ((ry - ky) * h) / rw
          nodes.push(
            <View
              key={`l${j}`}
              style={{
                position: 'absolute',
                left: 0,
                top: ly * h + (lw / 2) * tanL,
                width: lw + 0.5,
                height: h,
                backgroundColor: fill,
                transform: [{ skewY: `${(Math.atan(tanL) * 180) / Math.PI}deg` }],
              }}
            />,
            <View
              key={`r${j}`}
              style={{
                position: 'absolute',
                left: lw - 0.5,
                top: ky * h + (rw / 2) * tanR,
                width: rw + 0.5,
                height: h,
                backgroundColor: fill,
                transform: [{ skewY: `${(Math.atan(tanR) * 180) / Math.PI}deg` }],
              }}
            />
          )
          cracks.push(
            lineNode(`cl${j}`, 0, ly * h, kx * w, ky * h, sw),
            lineNode(`cr${j}`, kx * w, ky * h, w, ry * h, sw)
          )
        })
        return [...nodes, ...cracks]
      }}
    />
  )
}

/**
 * Scales — overlapping dome-down semicircles (2 columns, alternate rows offset
 * by r), drawn with borderBottom radii. Later (lower) rows paint on top, same
 * overlap order as the web arcs.
 */
function ScalesBand({ colors }: { colors: string[] }) {
  const q = pickColor(colors)
  return (
    <MeasuredBand
      base={q(0)}
      paint={(w, h) => {
        const cols = 2
        const r = (w / cols) * 0.78
        const stepY = r * 0.85
        const nodes: React.ReactNode[] = []
        let n = 0
        for (let row = -1; row * stepY < h + r; row++) {
          const offset = row % 2 === 0 ? 0 : r
          for (let col = -1; col <= cols; col++) {
            const cx = col * (r * 2) + offset
            const cy = row * stepY
            nodes.push(
              <View
                key={`${row}-${col}`}
                style={{
                  position: 'absolute',
                  left: cx - r,
                  top: cy,
                  width: 2 * r,
                  height: r,
                  borderBottomLeftRadius: r,
                  borderBottomRightRadius: r,
                  backgroundColor: q(n++),
                }}
              />
            )
          }
        }
        return nodes
      }}
    />
  )
}

function HeritageBandArt({ pattern, colors }: { pattern: string; colors: string[] }) {
  // Unknown / legacy ids resolve to diamond, matching the web's
  // resolveHeritageSelection (never silently downgrade to a gradient).
  const p = resolveHeritagePattern(pattern)
  const c = (i: number) => colors[i % colors.length] || '#7c3aed'
  if (p === 'mosaic') {
    return (
      <View style={{ flex: 1 }}>
        {Array.from({ length: 9 }, (_, r) => (
          <View key={r} style={{ flex: 1, flexDirection: 'row' }}>
            <View style={{ flex: 1, backgroundColor: c(r * 2) }} />
            <View style={{ flex: 1, backgroundColor: c(r * 2 + 1) }} />
          </View>
        ))}
      </View>
    )
  }
  if (p === 'split') {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: c(0) }} />
        <View style={{ flex: 1, backgroundColor: c(3) }} />
      </View>
    )
  }
  if (p === 'gradient') {
    return (
      <LinearGradient
        colors={colors.slice(0, 5) as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ flex: 1 }}
      />
    )
  }
  if (p === 'stripes') return <StripesBand colors={colors} />
  if (p === 'chevron') return <ChevronBand colors={colors} />
  if (p === 'prism') return <PrismBand colors={colors} />
  if (p === 'lightning') return <LightningBand colors={colors} />
  if (p === 'shattered') return <ShatteredBand colors={colors} />
  if (p === 'fractured') return <FracturedBand colors={colors} />
  if (p === 'scales') return <ScalesBand colors={colors} />
  return <DiamondBand colors={colors} />
}

function dynamicNameFontSize(name: string, base: number): number {
  if (!name) return base
  if (name.length > 30) return base * 0.75
  if (name.length > 22) return base * 0.85
  if (name.length > 16) return base * 0.92
  return base
}

function SlabCardImpl({
  imageUrl,
  displayName,
  contextLine,
  serial,
  grade,
  condition,
  features = [],
  size = 'md',
  isBack = false,
  isAlteredAuthentic = false,
  subScores,
  labelStyle = 'modern',
  colorOverrides,
  qrUrl,
  showFounderEmblem = false,
  showVipEmblem = false,
  showCardLoversEmblem = false,
  heritageBandColors,
}: SlabCardProps) {
  // Altered/Authentic parity with web ModernFrontLabel: grade "A", condition
  // "Authentic", only when there is no numeric grade to show.
  const gradeText = grade !== null ? Math.round(grade).toString() : (isAlteredAuthentic ? 'A' : 'N/A')
  const conditionText = (isAlteredAuthentic && grade === null ? 'Authentic' : condition || '').toUpperCase()
  const fontScale = size === 'sm' ? 0.85 : size === 'md' ? 1 : 1.15
  const isTraditional = labelStyle === 'traditional'
  // Heritage: built-in id, or a saved custom style whose config is Heritage.
  const isHeritage = labelStyle === 'heritage' || !!colorOverrides?.isHeritage
  // Front and back labels share the same height so they line up across the slab —
  // matches the web (ModernFrontLabel heights match ModernBackLabel by design).
  // Aspect-locked to the measured slab width so the proportions match the web:
  // heritage is a 1400x400 canvas (w/3.5); modern/traditional render a 360px
  // design at min-height ~110 (w/3.27). Until layout runs (or below the
  // legibility floor) we fall back to the historical fixed heights.
  const [slabW, setSlabW] = useState(0)
  const labelAspect = isHeritage ? 3.5 : 3.27
  const fallbackLabelHeight = size === 'sm' ? 70 : size === 'md' ? 84 : 110
  // slabGradient pads 4px per side; the label spans the remainder.
  const labelHeight = slabW > 0 ? Math.max(56, (slabW - 8) / labelAspect) : fallbackLabelHeight
  const bandColors = (colorOverrides?.heritageBandColors && colorOverrides.heritageBandColors.length >= 2)
    ? colorOverrides.heritageBandColors
    : (heritageBandColors && heritageBandColors.length >= 2 ? heritageBandColors : HERITAGE_BRAND_COLORS)
  const isLight = isTraditional || isHeritage
  const heritagePattern = colorOverrides?.heritagePattern || 'diamond'
  const qrSize = size === 'sm' ? 44 : size === 'md' ? 56 : 70
  // Allow the context line (Set • #Num • Year) to wrap to 2 lines on the card detail
  // page (size=lg) where there's enough vertical room. Keep 1 line on sm/md.
  const contextLines = size === 'lg' ? 2 : 1

  const wrapperColors = isLight ? ['#e5e7eb', '#f3f4f6', '#e5e7eb'] : getWrapperColors(colorOverrides)
  // Heritage field: the web on-screen (non-hardened) ivory, not flat white.
  const labelColors = isHeritage ? [HERITAGE_SCREEN_FIELD, HERITAGE_SCREEN_FIELD, HERITAGE_SCREEN_FIELD] : isTraditional ? ['#f9fafb', '#ffffff', '#f9fafb'] : (colorOverrides?.isCardExtension ? wrapperColors : (colorOverrides?.isRainbow ? ['#1a1625', '#2d1f47', '#1a1625'] : (colorOverrides ? [colorOverrides.gradientStart, colorOverrides.gradientEnd, colorOverrides.gradientStart] : DEFAULT_MODERN_COLORS)))

  // Modern text polarity — dark text on light custom gradients (web
  // ModernFrontLabel's `tx` sets, resolved by useLabelStyle from the saved
  // config's textColorMode / WCAG auto pick).
  const darkText = !isLight && colorOverrides?.textPolarity === 'dark'

  // Text colors: traditional/heritage = dark on light, modern = polarity-picked
  const nameColor = isHeritage ? HERITAGE_THEME.ink : isTraditional ? Colors.gray[900] : darkText ? 'rgba(31,41,55,0.95)' : 'rgba(255,255,255,0.95)'
  const contextColor = isHeritage ? HERITAGE_THEME.inkSoft : isTraditional ? Colors.gray[600] : darkText ? '#4b5563' : 'rgba(255,255,255,0.7)'
  const featureColor = isLight ? Colors.blue[600] : darkText ? '#2563eb' : 'rgba(34,197,94,0.9)'
  const serialColor = isHeritage ? HERITAGE_THEME.inkSoft : isTraditional ? Colors.gray[500] : darkText ? '#6b7280' : 'rgba(255,255,255,0.65)'
  const gradeColor = isHeritage ? HERITAGE_THEME.ink : isTraditional ? Colors.purple[700] : darkText ? '#7c3aed' : Colors.white
  const conditionColor = isHeritage ? HERITAGE_THEME.ink : isTraditional ? Colors.purple[600] : darkText ? '#6b46c1' : 'rgba(255,255,255,0.85)'
  const logoTint = isHeritage ? HERITAGE_THEME.rule : (isTraditional || darkText) ? undefined : 'rgba(255,255,255,0.9)'

  // Custom-style border on the modern label (web applies borderWidth inches
  // x 96dpi; heritage/traditional draw their own edges).
  const customBorder = !isHeritage && !isTraditional && colorOverrides?.borderEnabled
    ? { borderWidth: Math.max(1, Math.round((colorOverrides.borderWidth ?? 0.04) * 96)), borderColor: colorOverrides.borderColor }
    : null

  // Heritage grade chip: numeral ink per grade (overridable), 10 = rainbow.
  const wholeGrade = grade !== null ? Math.round(grade) : null
  const heritageInkOverride = wholeGrade != null ? colorOverrides?.heritageGradeColors?.[String(wholeGrade)] : undefined
  const heritageInk = heritageInkOverride
    || (wholeGrade != null ? HERITAGE_GRADE_INKS[wholeGrade]?.ink : undefined)
    || HERITAGE_FALLBACK_INK.ink
  // Chip condition line: an empty condition falls back to the chip's own
  // label (web resolveGradeChip .label — GEM MINT / MINT / ... / AUTHENTIC).
  const heritageChipLabel = conditionText
    || (wholeGrade != null ? HERITAGE_GRADE_INKS[wholeGrade]?.label : undefined)
    || HERITAGE_FALLBACK_INK.label

  const nameFontSize = dynamicNameFontSize(displayName, 12 * fontScale)

  // Heritage geometry: HERITAGE_PX mockup-px (1400x400 canvas) scaled by the
  // label height so the layout keeps its printed proportions at every size.
  const hs = labelHeight / 400
  const hBandW = Math.round(90 * hs)
  const hRuleW = Math.max(1.5, 6 * hs)
  const hChipW = 240 * hs
  const hChipH = 252 * hs
  const hChipR = 28 * hs
  const hChipB = Math.max(1.25, 6 * hs)
  const hNumSize = (gradeText.length > 2 ? 90 : gradeText.length > 1 ? 150 : 168) * hs
  const hCondSize = (heritageChipLabel.length > 8 ? 28 : 32) * hs
  // Collection tiles (sm) are too small for a legible bottom mark — hide it
  // there; md/lg (labelHeight >= 84) keep the mark + accent rules.
  const showHeritageMark = size !== 'sm'

  return (
    <View style={styles.slabWrapper} onLayout={e => setSlabW(e.nativeEvent.layout.width)}>
      <LinearGradient
        colors={wrapperColors as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.slabGradient}
      >
        {/* Label */}
        <LinearGradient
          colors={labelColors as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.5 }}
          style={[
            styles.label,
            { height: labelHeight },
            isTraditional && { borderWidth: 1, borderColor: Colors.gray[200] },
            // Heritage: subtle edge keyline around the ivory field (web theme).
            isHeritage && { borderWidth: StyleSheet.hairlineWidth, borderColor: HERITAGE_SCREEN_EDGE },
            customBorder,
          ]}
        >
          {isHeritage && (
            <>
              <View style={[styles.heritageBand, { width: hBandW }]}>
                <HeritageBandArt pattern={heritagePattern} colors={bandColors} />
              </View>
              <View style={[styles.heritageBandRule, { left: hBandW, width: hRuleW }]} />
            </>
          )}
          {isBack ? (
            <View style={[styles.backLabelContent, isHeritage && { paddingLeft: hBandW + hRuleW + 6 }]}>
              {/* QR code + emblems clustered on the left */}
              <View style={styles.backLeftCluster}>
                {qrUrl ? (
                  <View style={[styles.backQrBox, { padding: 4, backgroundColor: '#fff', borderRadius: 4 }]}>
                    <Image
                      source={{ uri: buildQrImageUrl(qrUrl, qrSize * 2) }}
                      style={{ width: qrSize, height: qrSize }}
                      resizeMode="contain"
                    />
                    {/* DCM mark knocked into the centre — matches the printed
                        labels (ecc=H absorbs the occlusion). */}
                    <View
                      style={{
                        position: 'absolute',
                        left: 4 + qrSize / 2 - qrSize * 0.15,
                        top: 4 + qrSize / 2 - qrSize * 0.15,
                        width: qrSize * 0.3,
                        height: qrSize * 0.3,
                        borderRadius: qrSize * 0.15,
                        backgroundColor: '#fff',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Image
                        source={require('@/assets/images/dcm-logo.png')}
                        style={{ width: qrSize * 0.24, height: qrSize * 0.24 }}
                        resizeMode="contain"
                      />
                    </View>
                  </View>
                ) : null}
                {([
                  showFounderEmblem ? 'founder' : null,
                  showCardLoversEmblem ? 'cardLovers' : null,
                  showVipEmblem ? 'vip' : null,
                ].filter(Boolean) as Array<keyof typeof EMBLEMS>).map(key => {
                  const e = isHeritage ? HERITAGE_EMBLEMS[key] : isTraditional ? TRADITIONAL_EMBLEMS[key] : EMBLEMS[key]
                  const iconSize = size === 'sm' ? 11 : size === 'md' ? 13 : 15
                  // Vertical box height = the label's available height minus icon + paddings.
                  // Sized so even the longest label ("CARD LOVER", 10 chars) fits without truncating.
                  const verticalBoxHeight = labelHeight - iconSize - 14
                  // Font size tuned so 10 uppercase chars fit within verticalBoxHeight.
                  const textFontSize = size === 'sm' ? 5 : size === 'md' ? 6 : 7
                  return (
                    <View key={key} style={styles.emblemColumn}>
                      <Ionicons name={e.icon as any} size={iconSize} color={e.iconColor} />
                      <View style={[styles.verticalLabelBox, { width: 10, height: verticalBoxHeight }]}>
                        <Text
                          style={{
                            fontSize: textFontSize,
                            fontWeight: '700',
                            color: e.textColor,
                            textTransform: 'uppercase',
                            position: 'absolute',
                            width: verticalBoxHeight,
                            textAlign: 'center',
                            transform: [{ rotate: '-90deg' }],
                          }}
                          numberOfLines={1}
                        >
                          {e.label}
                        </Text>
                      </View>
                    </View>
                  )
                })}
              </View>
              {/* Center: large grade + condition */}
              <View style={styles.backGradeSection}>
                <Text style={[styles.backGradeText, { fontSize: 32 * fontScale, color: gradeColor }]}>{gradeText}</Text>
                {conditionText ? (
                  <Text style={[styles.backConditionText, { fontSize: 9 * fontScale, color: conditionColor }]}>{conditionText}</Text>
                ) : null}
              </View>
              {/* Right: full sub-grade names */}
              {subScores && (
                <View style={styles.backSubScores}>
                  {[
                    ['Centering', subScores.centering],
                    ['Corners', subScores.corners],
                    ['Edges', subScores.edges],
                    ['Surface', subScores.surface],
                  ].map(([label, val]) => {
                    const v = typeof val === 'number' ? Math.round(val) : (val && typeof val === 'object' && (val as any).weighted != null ? Math.round((val as any).weighted) : null)
                    return v != null
                      ? <Text key={label as string} style={[styles.subScoreText, { fontSize: 9 * fontScale, color: contextColor }]}>{label}: {v}</Text>
                      : null
                  })}
                </View>
              )}
            </View>
          ) : isHeritage ? (
            // Heritage front — mirrors HERITAGE_PX / HeritageLabelPreview:
            // band + rule, then name / context / serial at TEXT_X, near-square
            // black grade chip at right (condition INSIDE it), DCM mark
            // centred at the bottom flanked by short black accent rules.
            <View style={styles.heritageFrontContent}>
              <View style={[styles.heritageTextCol, { paddingLeft: Math.max(4, 150 * hs - 8), paddingTop: Math.max(0, 50 * hs - 8) }]}>
                {/* adjustsFontSizeToFit: shrink to the label width instead of
                    ellipsizing — labels must never truncate the card name. */}
                <Text style={[styles.labelName, { fontSize: dynamicNameFontSize(displayName, 84 * hs), color: nameColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                  {displayName}
                </Text>
                {contextLine ? (
                  <Text
                    style={[styles.heritageContext, { fontSize: 30 * hs, lineHeight: 30 * hs * 1.25, color: contextColor }]}
                    numberOfLines={3}
                    adjustsFontSizeToFit
                    minimumFontScale={0.55}
                  >
                    {contextLine}
                  </Text>
                ) : null}
                {/* Divider rule + "Serial:" prefix, mirrors HeritageLabelPreview's
                    front serial row (rect + "Serial: {serial}" text). */}
                <View style={[styles.heritageSerialRule, { height: Math.max(1, 6 * hs), marginTop: 24 * hs }]} />
                <Text style={[styles.labelSerial, { fontSize: 34 * hs, marginTop: 18 * hs, color: serialColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>Serial: {serial}</Text>
              </View>

              <View style={{ paddingTop: Math.max(0, 64 * hs - 8) }}>
                {wholeGrade === 10 && !heritageInkOverride ? (
                  // Rainbow-foil ring via gradient wrapper; per-glyph tints
                  // approximate the foil numeral without SVG.
                  <LinearGradient
                    colors={GRADE_10_FOIL_STOPS as any}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ width: hChipW, height: hChipH, borderRadius: hChipR, padding: hChipB }}
                  >
                    <View style={[styles.heritageChip, { flex: 1, alignSelf: 'stretch', borderRadius: hChipR - hChipB }]}>
                      <Text style={{ fontSize: 150 * hs, lineHeight: 150 * hs * 1.05, fontWeight: '800' }}>
                        <Text style={{ color: GRADE_10_FOIL_STOPS[1] }}>1</Text>
                        <Text style={{ color: GRADE_10_FOIL_STOPS[3] }}>0</Text>
                      </Text>
                      <Text style={[styles.heritageChipLabel, { fontSize: hCondSize, color: '#F4EFE4' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                        {heritageChipLabel}
                      </Text>
                    </View>
                  </LinearGradient>
                ) : (
                  <View
                    style={[
                      styles.heritageChip,
                      { width: hChipW, height: hChipH, borderRadius: hChipR },
                      wholeGrade === 10 && { borderWidth: hChipB, borderColor: heritageInk },
                    ]}
                  >
                    <Text style={{ fontSize: hNumSize, lineHeight: hNumSize * 1.05, fontWeight: '800', color: heritageInk }}>
                      {gradeText}
                    </Text>
                    <Text style={[styles.heritageChipLabel, { fontSize: hCondSize, color: heritageInk }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                      {heritageChipLabel}
                    </Text>
                  </View>
                )}
              </View>

              {showHeritageMark && (
                <View style={styles.heritageMarkRow} pointerEvents="none">
                  <View style={[styles.heritageMarkRule, { width: 112 * hs, height: Math.max(1.5, 6 * hs) }]} />
                  <Image
                    source={require('@/assets/images/dcm-logo.png')}
                    style={{ width: 260 * 0.85 * hs, height: 96 * 0.85 * hs, marginHorizontal: 20 * hs }}
                    resizeMode="contain"
                    tintColor={logoTint}
                  />
                  <View style={[styles.heritageMarkRule, { width: 112 * hs, height: Math.max(1.5, 6 * hs) }]} />
                </View>
              )}
            </View>
          ) : (
            <View style={styles.frontLabelContent}>
              <Image
                source={require('@/assets/images/dcm-logo.png')}
                style={[styles.labelLogo, { width: 22 * fontScale, height: 22 * fontScale }]}
                resizeMode="contain"
                tintColor={logoTint}
              />

              <View style={styles.labelInfo}>
                {/* adjustsFontSizeToFit everywhere: labels shrink to the tile
                    width instead of ellipsizing the card name/details. */}
                <Text style={[styles.labelName, { fontSize: nameFontSize, color: nameColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                  {displayName}
                </Text>
                {contextLine ? (
                  <Text
                    style={[styles.labelContext, { fontSize: (size === 'lg' ? 9 : 8) * fontScale, color: contextColor, lineHeight: (size === 'lg' ? 11 : 10) }]}
                    numberOfLines={contextLines}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                  >
                    {contextLine}
                  </Text>
                ) : null}
                {features.length > 0 && (
                  <Text style={[styles.labelFeatures, { fontSize: 7.5 * fontScale, color: featureColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                    {features.join(' • ')}
                  </Text>
                )}
                <Text style={[styles.labelSerial, { fontSize: 7 * fontScale, color: serialColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{serial}</Text>
              </View>

              <View style={styles.labelGradeSection}>
                <Text style={[styles.labelGrade, { fontSize: 26 * fontScale, color: gradeColor }]}>{gradeText}</Text>
                {conditionText ? (
                  <>
                    <View style={[styles.gradeUnderline, { backgroundColor: (isTraditional || darkText) ? Colors.purple[600] : 'rgba(255,255,255,0.5)' }]} />
                    <Text style={[styles.labelCondition, { fontSize: 7 * fontScale, color: conditionColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{conditionText}</Text>
                  </>
                ) : null}
              </View>
            </View>
          )}
        </LinearGradient>

        {/* Separator */}
        <LinearGradient
          colors={isHeritage
            ? ['rgba(16,16,20,0.15)', 'rgba(16,16,20,0.55)', 'rgba(16,16,20,0.15)']
            : isTraditional
            ? ['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.05)']
            : ['rgba(139,92,246,0.1)', 'rgba(139,92,246,0.4)', 'rgba(139,92,246,0.1)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.separator}
        />

        {/* Card image */}
        <View style={styles.imageContainer}>
          {imageUrl ? (
            <ExpoImage source={imageUrl} style={styles.cardImage} contentFit="contain" cachePolicy="disk" transition={150} />
          ) : (
            <View style={[styles.cardImage, styles.placeholderImage]}>
              <Text style={styles.placeholderText}>No Image</Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </View>
  )
}

// Memoize so the collection grid doesn't re-render every tile when a sibling
// changes (e.g., search input updates, sort flips). Default shallow prop
// equality is enough — most props are primitives or stable references.
const SlabCard = memo(SlabCardImpl);
export default SlabCard;

const styles = StyleSheet.create({
  // Top-left radius matches the label's own corner; clipping stays INSIDE the
  // band (no children), avoiding the Android bug where overflow:hidden on the
  // label's LinearGradient hid every child (all label text vanished).
  heritageBand: { position: 'absolute', left: 0, top: 0, bottom: 0, borderTopLeftRadius: 10, overflow: 'hidden' },
  heritageBandRule: { position: 'absolute', top: 0, bottom: 0, backgroundColor: '#101014' },
  heritageFrontContent: { flex: 1, flexDirection: 'row', alignItems: 'flex-start' },
  heritageTextCol: { flex: 1, minWidth: 0 },
  heritageContext: { marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.5 },
  heritageSerialRule: { alignSelf: 'stretch', backgroundColor: '#101014', marginRight: 8 },
  heritageChip: { backgroundColor: HERITAGE_CHIP_BLACK, alignItems: 'center', justifyContent: 'center' },
  heritageChipLabel: { fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
  heritageMarkRow: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  heritageMarkRule: { backgroundColor: '#101014' },
  slabWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  slabGradient: { padding: 4, borderRadius: 14 },
  label: {
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: 'center',
  },

  frontLabelContent: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6 },
  labelLogo: { opacity: 0.95 },
  labelInfo: { flex: 1, minWidth: 0 },
  labelName: { fontWeight: '700' },
  labelContext: { marginTop: 1 },
  labelFeatures: { fontWeight: '700', marginTop: 1 },
  labelSerial: { fontFamily: 'SpaceMono', marginTop: 2 },
  labelGradeSection: { alignItems: 'center', marginLeft: 4, minWidth: 38 },
  labelGrade: { fontWeight: '800' },
  gradeUnderline: { height: 1.5, width: 24, marginTop: 2, marginBottom: 2 },
  labelCondition: { fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' },

  backLabelContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1, gap: 8 },
  backLeftCluster: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backQrBox: { justifyContent: 'center', alignItems: 'center' },
  emblemColumn: { alignItems: 'center', justifyContent: 'flex-start', paddingTop: 2, paddingHorizontal: 1 },
  verticalLabelBox: { alignItems: 'center', justifyContent: 'center', overflow: 'visible', marginTop: 2 },
  backGradeSection: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  backGradeText: { fontWeight: '800', textAlign: 'center' },
  backConditionText: { fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2, textAlign: 'center' },
  backSubScores: { gap: 2, alignItems: 'flex-end', justifyContent: 'center' },
  subScoreText: { fontWeight: '500' },

  separator: { height: 1 },

  imageContainer: {
    backgroundColor: '#0a0a12',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    aspectRatio: 0.714,
    overflow: 'hidden',
  },
  cardImage: { width: '100%', height: '100%' },
  placeholderImage: { backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: Colors.gray[600], fontSize: 12 },
})
