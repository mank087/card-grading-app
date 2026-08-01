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
  | 'gradient' | 'split' | 'mosaic' | 'stripes' | 'lightning' | 'shattered' | 'fractured'

export const BAND_PATTERNS: { id: BandPattern; name: string; note: string }[] = [
  { id: 'gradient',  name: 'Gradient',         note: 'Quietest. Vertical multi-stop.' },
  { id: 'split',     name: 'Split',            note: 'Hard stack, no blend.' },
  { id: 'mosaic',    name: 'Mosaic tiles',     note: '2 x 9 flat tiles. No gradients — nothing to band in print.' },
  { id: 'stripes',   name: 'Diagonal stripes', note: '45deg across the strip.' },
  { id: 'lightning', name: 'Lightning bolt',   note: 'Single zigzag down the band.' },
  { id: 'shattered', name: 'Shattered glass',  note: 'Ten shards. Most detail — first to lose definition in print.' },
  { id: 'fractured', name: 'Fractured',        note: 'Five stacked regions, angled cuts.' },
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
  /** DCM mark, dark version — the ivory field never needs the white one. */
  colorLogoDataUrl?: string | null
  /** QR with the mark knocked into the centre, built by the caller. */
  qrDataUrl?: string | null
  showFounder?: boolean
  showCardLover?: boolean
  showVip?: boolean
}

const pickFrom = (p: string[]) => (i: number) => p[i % p.length] || '#7C3AED'

// ---------------------------------------------------------------------------
// Band patterns. Geometry mirrors the approved Round 3 mockups, which in turn
// re-cut customSlabLabelGenerator's patterns for a tall narrow strip.
// ---------------------------------------------------------------------------
function BandArt({ pattern, colors, id }: { pattern: BandPattern; colors: string[]; id: string }) {
  const q = pickFrom(colors)
  const W = BAND_W, H = LABEL_H
  // Divider weight scaled for the strip; 2.5px across a full label is a
  // hairline, inside a 90px band it is a fat rule.
  const dw = u(2)
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

  if (pattern === 'stripes') {
    const n = 9, h = H / n, skew = W
    for (let i = -1; i <= n; i++) {
      const y0 = i * h
      shapes.push(
        <Path key={`s${i}`} d={`M 0 ${y0} L ${W} ${y0 - skew} L ${W} ${y0 - skew + h} L 0 ${y0 + h} Z`} fill={q(i + 1)} />
      )
    }
    for (let i = 0; i <= n; i++) {
      const y0 = i * h
      shapes.push(<Path key={`sd${i}`} d={`M 0 ${y0} L ${W} ${y0 - skew}`} strokeWidth={dw} stroke={dc} fill="none" />)
    }
  }

  if (pattern === 'lightning') {
    const z: [number, number][] = [
      [W * 0.62, 0], [W * 0.28, H * 0.22], [W * 0.70, H * 0.44],
      [W * 0.30, H * 0.66], [W * 0.66, H * 0.86], [W * 0.40, H],
    ]
    const zig = z.map(([x, y]) => `L ${x} ${y}`).join(' ')
    shapes.push(<Rect key="base" x={0} y={0} width={W} height={H} fill={q(0)} />)
    shapes.push(<Path key="l" d={`M 0 0 L ${z[0][0]} ${z[0][1]} ${zig} L 0 ${H} Z`} fill={q(0)} />)
    shapes.push(<Path key="r" d={`M ${W} 0 L ${z[0][0]} ${z[0][1]} ${zig} L ${W} ${H} Z`} fill={q(1)} />)
    shapes.push(<Path key="d" d={`M ${z[0][0]} ${z[0][1]} ${zig}`} strokeWidth={dw} stroke={dc} fill="none" />)
  }

  if (pattern === 'shattered') {
    const cx = W * 0.45, cy = H * 0.38
    const pts: [number, number][] = [
      [0, 0], [W, 0], [W, H * 0.25], [W, H * 0.5], [W, H * 0.75], [W, H],
      [0, H], [0, H * 0.72], [0, H * 0.45], [0, H * 0.2],
    ]
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length]
      const d = `M ${cx} ${cy} L ${ax} ${ay} L ${bx} ${by} Z`
      shapes.push(<Path key={`f${i}`} d={d} fill={q(i)} />)
      shapes.push(<Path key={`o${i}`} d={d} strokeWidth={dw} stroke={dc} fill="none" />)
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
      {i.colorLogoDataUrl ? (
        <View style={{ position: 'absolute', left: (LABEL_W - u(200)) / 2, top: LABEL_H - u(78) - u(10), width: u(200), height: u(78), alignItems: 'center', justifyContent: 'center' }}>
          <Image src={i.colorLogoDataUrl} style={{ width: u(200), height: u(78), objectFit: 'contain' }} />
        </View>
      ) : null}
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
