/* eslint-disable jsx-a11y/alt-text */
/**
 * Round 3 "Heritage" slab label — vector PDF, front + back.
 *
 * Lab-only for now. This is the Aug 2026 redesign rendered through the same
 * @react-pdf path the lab already uses for the production slab formats, so it
 * can be printed at true size and compared against a real slab before any of
 * it touches Label Studio.
 *
 * What it is:
 *   front — ivory field, patterned left band, dark type, grade CHIP coloured
 *           by grade (GRADE_CHIPS), DCM mark bottom-centre hugging the edge.
 *   back  — same band, QR carrying the DCM mark, emblems rotated 90deg CCW
 *           with the symbol on top, grade + condition centred, sub-grades
 *           right-aligned. No serial: the QR already encodes it.
 *
 * Deliberately NOT wired into production generators yet. Those still hardcode
 * '#7c3aed' for the grade in three places (customSlabPdfBlock, slabLabelPdfDoc,
 * customSlabLabelGenerator); this reads GRADE_CHIPS instead, and reconciling
 * the two is the real migration work.
 *
 * Units: @react-pdf is points. 2.8" x 0.8" = 201.6 x 57.6pt. Mockups were
 * authored at 1400 x 400px, so `u()` maps mockup px to points.
 */
import React from 'react'
import { Document, Page, View, Text, Image, Svg, Path, Rect, Line, G, Defs, LinearGradient, Stop, ClipPath } from '@react-pdf/renderer'
import { resolveGradeChip, type GradeChip } from '@/lib/labelPresets'

const INCH = 72
const LABEL_W = 2.8 * INCH        // 201.6
const LABEL_H = 0.8 * INCH        // 57.6
const PAGE_W = 8.5 * INCH
const PAGE_H = 11 * INCH

/** Mockup px (1400x400) -> points. */
const u = (px: number) => (px / 1400) * LABEL_W

const BAND_W = u(90)
const RULE_W = u(6)

const IVORY = '#FAF8F4'
const INK = '#141414'
const INK_SOFT = '#5A5A5A'
const GOLD = '#A67C1B'
const EDGE = '#E5DECF'

export type BandPattern =
  | 'gradient' | 'split' | 'mosaic' | 'diamond' | 'stripes' | 'chevron'
  | 'lightning' | 'shattered' | 'fractured' | 'scales' | 'prism'

export const BAND_PATTERNS: { id: BandPattern; name: string; note: string }[] = [
  { id: 'gradient',  name: 'Gradient',         note: 'Quietest. Vertical multi-stop.' },
  { id: 'split',     name: 'Split',            note: 'Hard stack, no blend.' },
  { id: 'mosaic',    name: 'Mosaic tiles',     note: '2 x 9 flat tiles. No gradients — nothing to band in print.' },
  { id: 'diamond',   name: 'Diamond mosaic',   note: 'The Round 1 Front C treatment: rotated squares in two columns. Most "graded card" of the set.' },
  { id: 'stripes',   name: 'Diagonal stripes', note: '45deg across the strip.' },
  { id: 'chevron',   name: 'Chevron',          note: 'Nested Vs pointing into the label. Directional without being loud.' },
  { id: 'lightning', name: 'Lightning bolt',   note: 'Single zigzag down the band.' },
  { id: 'shattered', name: 'Shattered glass',  note: 'Shards from a focal point. Most detail — first to lose definition in print.' },
  { id: 'fractured', name: 'Fractured',        note: 'Five stacked regions, angled cuts.' },
  { id: 'scales',    name: 'Scales',           note: 'Overlapping arcs, like a foil texture. Reads as pattern rather than shapes at slab distance.' },
  { id: 'prism',     name: 'Prism',            note: 'Interlocking triangles off alternating edges. Sharp and modern.' },
]

export interface HeritageInputs {
  primaryName: string
  contextLine: string
  serial: string
  grade: string
  condition: string
  subgrades: { centering: number | null; corners: number | null; edges: number | null; surface: number | null }
  /** Band colours, sampled from the card or a brand set. At least 2. */
  bandColors: string[]
  pattern: BandPattern
  /** DCM mark, dark version — used on ivory and on the gold medallion. */
  colorLogoDataUrl?: string | null
  /** DCM mark, white version — needed by the plate and bar treatments. */
  whiteLogoDataUrl?: string | null
  /** How hard the mark works to be seen at the bottom edge. */
  logoTreatment?: LogoTreatment
  /** QR with the mark knocked into the centre, built by the caller. */
  qrDataUrl?: string | null
  showFounder?: boolean
  showCardLover?: boolean
  showVip?: boolean
}

const pickFrom = (p: string[]) => (i: number) => p[i % p.length] || '#7C3AED'

/**
 * How the DCM mark is presented at the bottom edge.
 *
 * On the ivory field a bare navy mark at 200x78 mockup-px is honest but quiet —
 * at 2.8" it reads as a smudge from arm's length, which defeats the point of
 * moving it to the bottom centre in the first place. Each treatment below buys
 * presence a different way, and they cost different amounts of ink.
 */
export type LogoTreatment = 'plain' | 'plate' | 'medallion' | 'rules' | 'bar' | 'tab'

export const LOGO_TREATMENTS: { id: LogoTreatment; name: string; note: string }[] = [
  { id: 'plain',     name: 'Plain',        note: 'Bare navy mark on ivory. Least ink, least presence — the current Round 3 behaviour.' },
  { id: 'rules',     name: 'Flanking rules', note: 'Two gold hairlines running out to the edges. Adds emphasis with almost no ink; the mark itself is unchanged.' },
  { id: 'plate',     name: 'Dark plate',   note: 'White mark knocked out of a dark rounded plate. Strongest contrast of the set and the most obviously deliberate.' },
  { id: 'medallion', name: 'Gold medallion', note: 'Dark mark on a gold disc. Reads as a seal or hallmark — most premium, but gold is the hardest colour to keep consistent in print.' },
  { id: 'bar',       name: 'Bottom bar',   note: 'Full-width bar in the band colour with a white mark. Ties the band to the mark and anchors the whole label. Most ink.' },
  { id: 'tab',       name: 'Notched tab',  note: 'A tab breaking the bottom edge, in the band colour. Distinctive silhouette even before you read it.' },
]

// ---------------------------------------------------------------------------
// Band patterns. Geometry mirrors the approved Round 3 mockups, which in turn
// re-cut customSlabLabelGenerator's patterns for a tall narrow strip.
// ---------------------------------------------------------------------------
export function BandArt({
  pattern, colors, id, w, h,
}: { pattern: BandPattern; colors: string[]; id: string; w?: number; h?: number }) {
  const q = pickFrom(colors)
  const W = w ?? BAND_W
  const H = h ?? LABEL_H
  // Divider weight scaled for the strip; 2.5px across a full label is a
  // hairline, inside a 90px band it is a fat rule.
  const dw = (W / BAND_W) * u(2)
  const dc = 'rgba(0,0,0,0.55)'

  if (pattern === 'gradient') {
    return (
      <Svg width={W} height={H} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Defs>
          <LinearGradient id={`bg-${id}`} x1="0" y1="0" x2="0" y2="1">
            {colors.map((c, i) => (
              <Stop key={i} offset={colors.length > 1 ? i / (colors.length - 1) : 0} stopColor={c} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={W} height={H} fill={`url(#bg-${id})`} />
      </Svg>
    )
  }

  const shapes: React.ReactNode[] = []
  // Every pattern paints a base fill first. Without it, any gap left by the
  // geometry shows the ivory field through the band and reads as a printing
  // fault -- which is exactly what the diagonal stripes were doing.
  shapes.push(<Rect key="base" x={0} y={0} width={W} height={H} fill={q(0)} />)

  if (pattern === 'split') {
    shapes.push(<Rect key="a" x={0} y={0} width={W} height={H / 2} fill={q(0)} />)
    shapes.push(<Rect key="b" x={0} y={H / 2} width={W} height={H / 2} fill={q(3)} />)
    shapes.push(<Line key="d" x1={0} y1={H / 2} x2={W} y2={H / 2} strokeWidth={dw} stroke={dc} />)
  }

  if (pattern === 'mosaic') {
    const cols = 2, rows = 9, tw = W / cols, th = H / rows
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        shapes.push(<Rect key={`t${r}${c}`} x={c * tw} y={r * th} width={tw} height={th} fill={q(r * cols + c)} />)
    for (let c = 1; c < cols; c++)
      shapes.push(<Line key={`v${c}`} x1={c * tw} y1={0} x2={c * tw} y2={H} strokeWidth={dw} stroke={dc} />)
    for (let r = 1; r < rows; r++)
      shapes.push(<Line key={`h${r}`} x1={0} y1={r * th} x2={W} y2={r * th} strokeWidth={dw} stroke={dc} />)
  }

  if (pattern === 'diamond') {
    // The Round 1 Front C treatment: squares rotated 45deg in two columns,
    // clipped by the band so the edge ones read as half-diamonds.
    const size = H / 9
    const half = size * 0.62
    let n = 0
    for (let row = -1; row <= Math.ceil(H / size) + 1; row++) {
      for (let col = 0; col < 2; col++) {
        const cx = W * (col === 0 ? 0.25 : 0.75)
        const cy = row * size + (col === 1 ? size / 2 : 0)
        shapes.push(
          <Path
            key={`d${row}${col}`}
            d={`M ${cx} ${cy - half} L ${cx + half} ${cy} L ${cx} ${cy + half} L ${cx - half} ${cy} Z`}
            fill={q(n++)}
            stroke={dc}
            strokeWidth={dw * 0.6}
          />
        )
      }
    }
  }

  if (pattern === 'stripes') {
    // Sheared bands. The shear pushes coverage sideways, so the loop has to run
    // past both ends by skew/h stripes or the corner nearest the shear
    // direction is left unpainted -- it was showing as a white wedge.
    const h = H / 9, skew = W
    const extra = Math.ceil(skew / h) + 1
    for (let i = -1; i <= 9 + extra; i++) {
      const y0 = i * h
      shapes.push(
        <Path key={`s${i}`} d={`M 0 ${y0} L ${W} ${y0 - skew} L ${W} ${y0 - skew + h} L 0 ${y0 + h} Z`} fill={q(i + 1)} />
      )
    }
    for (let i = -1; i <= 9 + extra; i++) {
      const y0 = i * h
      shapes.push(<Path key={`sd${i}`} d={`M 0 ${y0} L ${W} ${y0 - skew}`} strokeWidth={dw} stroke={dc} fill="none" />)
    }
  }

  if (pattern === 'chevron') {
    // Real Vs: apex on the band's centre line, arms running back to both edges.
    // A single slanted edge per step just reproduces the stripes pattern at a
    // different angle, which is what the first attempt did.
    const n = 7, step = H / n, depth = step * 0.75
    const vAt = (y: number) => `M 0 ${y} L ${W / 2} ${y + depth} L ${W} ${y}`
    for (let i = -2; i <= n + 1; i++) {
      const y = i * step
      shapes.push(
        <Path
          key={`c${i}`}
          d={`${vAt(y)} L ${W} ${y + step} L ${W / 2} ${y + depth + step} L 0 ${y + step} Z`}
          fill={q(i + 2)}
        />
      )
      shapes.push(<Path key={`cd${i}`} d={vAt(y)} strokeWidth={dw} stroke={dc} fill="none" />)
    }
  }

  if (pattern === 'lightning') {
    const z: [number, number][] = [
      [W * 0.62, 0], [W * 0.28, H * 0.22], [W * 0.70, H * 0.44],
      [W * 0.30, H * 0.66], [W * 0.66, H * 0.86], [W * 0.40, H],
    ]
    const zig = z.map(([x, y]) => `L ${x} ${y}`).join(' ')
    shapes.push(<Path key="l" d={`M 0 0 L ${z[0][0]} ${z[0][1]} ${zig} L 0 ${H} Z`} fill={q(0)} />)
    shapes.push(<Path key="r" d={`M ${W} 0 L ${z[0][0]} ${z[0][1]} ${zig} L ${W} ${H} Z`} fill={q(1)} />)
    shapes.push(<Path key="d" d={`M ${z[0][0]} ${z[0][1]} ${zig}`} strokeWidth={dw} stroke={dc} fill="none" />)
  }

  if (pattern === 'shattered') {
    // Shards from a focal point to a CLOSED perimeter loop. The perimeter must
    // be walked in order and wrap back to the first point, or the last shard is
    // missing and a wedge of ivory shows through.
    const cx = W * 0.42, cy = H * 0.36
    const pts: [number, number][] = [
      [0, 0], [W * 0.55, 0], [W, 0],
      [W, H * 0.18], [W, H * 0.40], [W, H * 0.62], [W, H * 0.82], [W, H],
      [W * 0.45, H], [0, H],
      [0, H * 0.78], [0, H * 0.56], [0, H * 0.34], [0, H * 0.16],
    ]
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i]
      const [bx, by] = pts[(i + 1) % pts.length]   // wraps -- closes the loop
      const d = `M ${cx} ${cy} L ${ax} ${ay} L ${bx} ${by} Z`
      shapes.push(<Path key={`f${i}`} d={d} fill={q(i)} />)
    }
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i]
      shapes.push(
        <Path key={`o${i}`} d={`M ${cx} ${cy} L ${ax} ${ay}`} strokeWidth={dw * 0.8} stroke={dc} fill="none" />
      )
    }
  }

  if (pattern === 'fractured') {
    const ys = [0, H * 0.18, H * 0.40, H * 0.58, H * 0.80, H]
    const jog = W * 0.34
    for (let i = 0; i < 5; i++) {
      const yA = ys[i], yB = ys[i + 1]
      const oA = i % 2 === 0 ? 0 : jog, oB = (i + 1) % 2 === 0 ? 0 : jog
      shapes.push(
        <Path key={`r${i}`} d={`M 0 ${yA} L ${W} ${yA + oA * 0.5} L ${W} ${yB + oB * 0.5} L 0 ${yB} Z`} fill={q(i)} />
      )
      if (i > 0) shapes.push(<Path key={`rd${i}`} d={`M 0 ${yA} L ${W} ${yA + oA * 0.5}`} strokeWidth={dw} stroke={dc} fill="none" />)
    }
  }

  if (pattern === 'scales') {
    // Overlapping arcs, painted top-down so each row laps the one above.
    // Reads as a foil texture rather than as individual shapes at slab size.
    const cols = 2, r = W / cols * 0.78, stepY = r * 0.85
    let n = 0
    for (let row = -1; row * stepY < H + r; row++) {
      const offset = row % 2 === 0 ? 0 : r
      for (let col = -1; col <= cols; col++) {
        const cx = col * (r * 2) + offset
        const cy = row * stepY
        shapes.push(
          <Path
            key={`sc${row}-${col}`}
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy} Z`}
            fill={q(n++)}
            stroke={dc}
            strokeWidth={dw * 0.5}
          />
        )
      }
    }
  }

  if (pattern === 'prism') {
    // Interlocking triangles alternating off the left and right edges. Each
    // pair tiles a full step, so there is no gap between them.
    const n = 8, step = H / n
    for (let i = -1; i <= n; i++) {
      const y = i * step
      shapes.push(
        <Path key={`p1${i}`} d={`M 0 ${y} L ${W} ${y + step / 2} L 0 ${y + step} Z`} fill={q(i * 2)} />
      )
      shapes.push(
        <Path key={`p2${i}`} d={`M ${W} ${y + step / 2} L ${W} ${y + step * 1.5} L 0 ${y + step} Z`} fill={q(i * 2 + 1)} />
      )
      shapes.push(
        <Path key={`pd${i}`} d={`M 0 ${y} L ${W} ${y + step / 2} L 0 ${y + step}`} strokeWidth={dw * 0.7} stroke={dc} fill="none" />
      )
    }
  }

  // Clip so a loosely-generated pattern still lands inside a clean band edge.
  return (
    <Svg width={W} height={H} style={{ position: 'absolute', top: 0, left: 0 }}>
      <Defs>
        <ClipPath id={`clip-${id}`}>
          <Rect x={0} y={0} width={W} height={H} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#clip-${id})`}>{shapes}</G>
    </Svg>
  )
}

/** Exported for the band-audit script only. */
export const __BandArtForAudit = BandArt


// ---------------------------------------------------------------------------

function GradeChipBlock({ chip, size }: { chip: GradeChip; size: number }) {
  const isBig = String(chip.grade).length > 1 || chip.grade === 0
  return (
    <View
      style={{
        width: size, height: size * (252 / 240), borderRadius: u(28),
        backgroundColor: chip.fill, alignItems: 'center', justifyContent: 'center',
        borderWidth: u(3), borderColor: chip.ink === '#FFFFFF' ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.18)',
      }}
    >
      <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: u(isBig ? 150 : 168), color: chip.ink, lineHeight: 1 }}>
        {chip.grade === 0 ? 'A' : chip.grade}
      </Text>
      <Text
        style={{
          fontFamily: 'Helvetica-Bold', fontSize: u(chip.label.length > 8 ? 26 : 30),
          color: chip.ink, opacity: 0.9, letterSpacing: u(4), marginTop: u(6),
        }}
      >
        {chip.label}
      </Text>
    </View>
  )
}

/**
 * The bottom-centre mark and whatever is doing the work of making it visible.
 *
 * Everything is sized off one box so the treatments are directly comparable —
 * only the backing changes, never the mark's size or position.
 */
function LogoBlock({ i }: { i: HeritageInputs }) {
  const t = i.logoTreatment ?? 'plain'
  const dark = i.colorLogoDataUrl
  const white = i.whiteLogoDataUrl
  const band = i.bandColors[0] || '#7C3AED'

  const MARK_W = u(190), MARK_H = u(70)
  const left = (LABEL_W - MARK_W) / 2
  const bottomPad = u(10)
  const top = LABEL_H - MARK_H - bottomPad

  const mark = (src: string | null | undefined) =>
    src ? <Image src={src} style={{ width: MARK_W * 0.78, height: MARK_H * 0.78, objectFit: 'contain' }} /> : null

  if (t === 'bar') {
    // Bar spans from the gold rule to the right edge so it reads as part of the
    // band system rather than a floating block.
    const barH = u(96)
    return (
      <View style={{ position: 'absolute', left: BAND_W + RULE_W, top: LABEL_H - barH, right: 0, height: barH, backgroundColor: band, alignItems: 'center', justifyContent: 'center' }}>
        {mark(white ?? dark)}
      </View>
    )
  }

  if (t === 'tab') {
    // A tab hanging off the bottom edge. Squared rather than notched: at 2.8"
    // an angled notch closes up in print and just looks like a printing fault.
    const tabW = u(260), tabH = u(86)
    return (
      <View style={{ position: 'absolute', left: (LABEL_W - tabW) / 2, top: LABEL_H - tabH, width: tabW, height: tabH, backgroundColor: band, borderTopLeftRadius: u(20), borderTopRightRadius: u(20), alignItems: 'center', justifyContent: 'center' }}>
        {mark(white ?? dark)}
      </View>
    )
  }

  if (t === 'plate') {
    const plateW = u(250), plateH = u(88)
    return (
      <View style={{ position: 'absolute', left: (LABEL_W - plateW) / 2, top: LABEL_H - plateH - u(6), width: plateW, height: plateH, backgroundColor: INK, borderRadius: u(18), alignItems: 'center', justifyContent: 'center' }}>
        {mark(white ?? dark)}
      </View>
    )
  }

  if (t === 'medallion') {
    const d = u(104)
    return (
      <View style={{ position: 'absolute', left: (LABEL_W - d) / 2, top: LABEL_H - d - u(4), width: d, height: d, backgroundColor: GOLD, borderRadius: d / 2, alignItems: 'center', justifyContent: 'center' }}>
        {dark ? <Image src={dark} style={{ width: d * 0.62, height: d * 0.62, objectFit: 'contain' }} /> : null}
      </View>
    )
  }

  if (t === 'rules') {
    const ruleY = LABEL_H - MARK_H / 2 - bottomPad
    const gap = u(24)
    return (
      <>
        <View style={{ position: 'absolute', left: BAND_W + RULE_W + u(40), top: ruleY, width: left - (BAND_W + RULE_W) - u(40) - gap, height: 0.6, backgroundColor: GOLD, opacity: 0.75 }} />
        <View style={{ position: 'absolute', left: left + MARK_W + gap, top: ruleY, width: LABEL_W - (left + MARK_W + gap) - u(40), height: 0.6, backgroundColor: GOLD, opacity: 0.75 }} />
        <View style={{ position: 'absolute', left, top, width: MARK_W, height: MARK_H, alignItems: 'center', justifyContent: 'center' }}>
          {mark(dark)}
        </View>
      </>
    )
  }

  return (
    <View style={{ position: 'absolute', left, top, width: MARK_W, height: MARK_H, alignItems: 'center', justifyContent: 'center' }}>
      {mark(dark)}
    </View>
  )
}

function HeritageFront({ i, chip }: { i: HeritageInputs; chip: GradeChip }) {
  return (
    <View style={{ width: LABEL_W, height: LABEL_H, backgroundColor: IVORY, position: 'relative', border: `0.5pt solid ${EDGE}` }}>
      <View style={{ position: 'absolute', top: 0, left: 0, width: BAND_W, height: LABEL_H }}>
        <BandArt pattern={i.pattern} colors={i.bandColors} id="f" />
      </View>
      <View style={{ position: 'absolute', top: 0, left: BAND_W, width: RULE_W, height: LABEL_H, backgroundColor: GOLD }} />

      {/* Text block */}
      <View style={{ position: 'absolute', left: u(150), top: u(56), width: u(920) }}>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: u(84), color: INK }}>{i.primaryName}</Text>
        <Text style={{ fontFamily: 'Helvetica', fontSize: u(29), color: INK_SOFT, letterSpacing: u(4), marginTop: u(22) }}>
          {i.contextLine.toUpperCase()}
        </Text>
        <View style={{ height: 0.5, backgroundColor: '#D9D2C4', marginTop: u(30), width: u(940) }} />
        <Text style={{ fontFamily: 'Courier', fontSize: u(36), color: INK_SOFT, letterSpacing: u(4), marginTop: u(22) }}>
          DCM {i.serial}
        </Text>
      </View>

      {/* Grade chip */}
      <View style={{ position: 'absolute', left: u(1130), top: u(64) }}>
        <GradeChipBlock chip={chip} size={u(240)} />
      </View>

      {/* Mark, bottom-centre, hugging the edge */}
      <LogoBlock i={i} />
    </View>
  )
}

/**
 * Symbol on top, word rotated 90deg counter-clockwise reading bottom-to-top.
 *
 * @react-pdf rotates an element about its own centre and does NOT reflow around
 * the rotated box. A naive `<Text transform="rotate(-90deg)">` therefore drifts
 * sideways by half its own length, so "CARD LOVER" lands on top of the VIP
 * emblem next to it while "VIP" barely moves. The fix is to give the text a
 * fixed track and offset it so its centre already sits on the slot centre —
 * then rotation is a no-op horizontally, whatever the word length.
 */
const EMBLEM_SLOT = u(56)
const EMBLEM_TRACK = u(240)   // long enough for the longest word, "CARD LOVER"

function Emblem({ symbol, word, color, left }: { symbol: string; word: string; color: string; left: number }) {
  // Centre the track on the slot so rotation keeps the word in its column.
  const trackLeft = (EMBLEM_SLOT - EMBLEM_TRACK) / 2
  return (
    <View style={{ position: 'absolute', left, top: u(40), width: EMBLEM_SLOT, height: u(320) }}>
      <Text style={{ fontFamily: 'Helvetica', fontSize: u(46), color, textAlign: 'center', width: EMBLEM_SLOT }}>
        {symbol}
      </Text>
      <View
        style={{
          position: 'absolute', top: u(70), left: trackLeft,
          width: EMBLEM_TRACK, height: u(34),
          transform: 'rotate(-90deg)',
        }}
      >
        {/* right-aligned so the word ENDS at the symbol, i.e. tops align once
            rotated — bottom-aligning leaves the tops ragged across emblems. */}
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: u(27), color, letterSpacing: u(3), textAlign: 'right' }}>
          {word}
        </Text>
      </View>
    </View>
  )
}

function HeritageBack({ i, chip }: { i: HeritageInputs; chip: GradeChip }) {
  const sg = i.subgrades
  const row = (label: string, v: number | null) =>
    v == null ? null : (
      <Text key={label} style={{ fontFamily: 'Helvetica', fontSize: u(30), color: INK_SOFT, textAlign: 'right', marginBottom: u(20) }}>
        {label}: {v}
      </Text>
    )
  return (
    <View style={{ width: LABEL_W, height: LABEL_H, backgroundColor: IVORY, position: 'relative', border: `0.5pt solid ${EDGE}` }}>
      <View style={{ position: 'absolute', top: 0, left: 0, width: BAND_W, height: LABEL_H }}>
        <BandArt pattern={i.pattern} colors={i.bandColors} id="b" />
      </View>
      <View style={{ position: 'absolute', top: 0, left: BAND_W, width: RULE_W, height: LABEL_H, backgroundColor: GOLD }} />

      {/* QR carrying the mark. Caller builds it at error-correction H. */}
      {i.qrDataUrl ? (
        <View style={{ position: 'absolute', left: u(132), top: u(52), width: u(296), height: u(296), backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#D9D2C4', alignItems: 'center', justifyContent: 'center' }}>
          <Image src={i.qrDataUrl} style={{ width: u(280), height: u(280) }} />
        </View>
      ) : null}

      {i.showFounder ? <Emblem symbol="*" word="FOUNDER" color="#B45309" left={u(458)} /> : null}
      {i.showCardLover ? <Emblem symbol="♥" word="CARD LOVER" color="#BE185D" left={u(532)} /> : null}
      {i.showVip ? <Emblem symbol="◆" word="VIP" color="#4F46E5" left={u(606)} /> : null}

      {/* Grade + condition, centred. No serial — the QR encodes it. */}
      <View style={{ position: 'absolute', left: u(700), top: u(60), width: u(360), alignItems: 'center' }}>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: u(150), color: INK, lineHeight: 1 }}>
          {chip.grade === 0 ? 'A' : chip.grade}
        </Text>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: u(34), color: INK, letterSpacing: u(7), marginTop: u(14) }}>
          {(i.condition || chip.label).toUpperCase()}
        </Text>
        <Text style={{ fontFamily: 'Helvetica', fontSize: u(24), color: GOLD, letterSpacing: u(3), marginTop: u(30) }}>
          DCMGRADING.COM/VERIFY
        </Text>
      </View>

      {/* Sub-grades, right-aligned, matching ModernBackLabel. */}
      <View style={{ position: 'absolute', right: u(70), top: u(84), width: u(300) }}>
        {row('Centering', sg.centering)}
        {row('Corners', sg.corners)}
        {row('Edges', sg.edges)}
        {row('Surface', sg.surface)}
      </View>
    </View>
  )
}

export function HeritageSlabPdfDoc(props: { inputs: HeritageInputs; note?: string }) {
  const { inputs, note } = props
  const chip = resolveGradeChip(inputs.grade)
  const patternName = BAND_PATTERNS.find(p => p.id === inputs.pattern)?.name ?? inputs.pattern

  return (
    <Document>
      <Page size={[PAGE_W, PAGE_H]} style={{ paddingTop: 40, paddingHorizontal: 40, backgroundColor: '#FFFFFF' }}>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: '#141414' }}>
          Heritage (Round 3) — {patternName} — true size 2.8&quot; x 0.8&quot;
        </Text>
        <Text style={{ fontFamily: 'Helvetica', fontSize: 7.5, color: '#6B7280', marginTop: 4 }}>
          Print at 100% / Actual size. &quot;Fit to page&quot; rescales and the measurement will be wrong.
        </Text>
        {note ? (
          <Text style={{ fontFamily: 'Helvetica', fontSize: 7.5, color: '#A16207', marginTop: 4 }}>{note}</Text>
        ) : null}

        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: '#A67C1B', marginTop: 22 }}>FRONT</Text>
        <View style={{ marginTop: 6 }}>
          <HeritageFront i={inputs} chip={chip} />
        </View>

        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: '#A67C1B', marginTop: 26 }}>BACK</Text>
        <View style={{ marginTop: 6 }}>
          <HeritageBack i={inputs} chip={chip} />
        </View>

        <Text style={{ fontFamily: 'Helvetica', fontSize: 7, color: '#9CA3AF', marginTop: 26 }}>
          Grade chip {chip.fill} / ink {chip.ink} — resolved from GRADE_CHIPS in labelPresets.ts.
          Lab only; production generators still hardcode the grade colour.
        </Text>
      </Page>
    </Document>
  )
}

export default HeritageSlabPdfDoc
