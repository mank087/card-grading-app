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
import { bandGeometry, BAND_STROKE_COLOR, BAND_PATTERNS, type BandPattern } from './bandGeometry'
import { EMBLEMS } from './emblemShapes'

// Re-exported so consumers keep one import site.
export { BAND_PATTERNS }
export type { BandPattern }

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
/** DCM brand purple — the plate behind the bottom-centre mark. */
const BRAND_PURPLE = '#7C3AED'

/**
 * Screen vs print theme.
 *
 * The ivory field is roughly a 2% tint. A consumer inkjet cannot lay that down
 * as a flat film -- it dithers into sparse isolated dots, so instead of smooth
 * cream you get faint speckle and nozzle banding across 85% of the label, and
 * you pay ink over the whole surface to get something indistinguishable from
 * blank paper at arm's length. Printing NOTHING is perfectly flat by
 * definition, so the hardened theme drops to paper white and lets the stock
 * carry any warmth.
 *
 * The rest follows from the same logic: consumer printers are good at dark
 * saturated solids and bad at light tints and light neutrals, so contrast goes
 * up and every light structural element gets darker.
 */
function theme(hardened: boolean) {
  return hardened
    ? {
        field: '#FFFFFF',        // zero ink: no dither, no banding
        ink: '#1F2937',          // TRADITIONAL.textDark — production's white-ground theme
        inkSoft: '#4B5563',      // TRADITIONAL.textMedium
        rule: '#8A6A14',         // darker gold; thin gold on cream is invisible
        edge: '#141414',         // real keyline, so it reads as a finished object
        edgeWidth: 1,
        divider: '#7C3AED',      // TRADITIONAL.purplePrimary
      }
    : {
        field: IVORY, ink: INK, inkSoft: INK_SOFT,
        rule: GOLD, edge: EDGE, edgeWidth: 0.5, divider: '#D9D2C4',
      }
}


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
  /**
   * Print-hardened rendering: paper-white field instead of the ivory tint,
   * inverted gold/silver chips, a keyline, and punchier type. See the theme
   * block below for why each one exists.
   */
  printHardened?: boolean
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
export type LogoTreatment = 'plate' | 'rules' | 'plain'

export const LOGO_TREATMENTS: { id: LogoTreatment; name: string; note: string }[] = [
  { id: 'plate', name: 'Purple plate', note: 'White mark knocked out of a brand-purple rounded plate.' },
  { id: 'rules', name: 'Colour mark + rules', note: 'The navy mark with a short horizontal rule either side. Almost no extra ink, and it anchors the mark without committing the design to a shape.' },
  { id: 'plain', name: 'Plain (reference)', note: 'Bare navy mark on ivory, kept only for comparison.' },
]

// ---------------------------------------------------------------------------
// Band patterns. Geometry mirrors the approved Round 3 mockups, which in turn
// re-cut customSlabLabelGenerator's patterns for a tall narrow strip.
// ---------------------------------------------------------------------------
function BandArt({
  pattern, colors, id, w, h,
}: { pattern: BandPattern; colors: string[]; id: string; w?: number; h?: number }) {
  const W = w ?? BAND_W
  const H = h ?? LABEL_H
  const g = bandGeometry(pattern, colors, W, H)

  if (g.gradientStops) {
    const stops = g.gradientStops
    return (
      <Svg width={W} height={H} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Defs>
          <LinearGradient id={`bg-${id}`} x1="0" y1="0" x2="0" y2="1">
            {stops.map((c, i) => (
              <Stop key={i} offset={stops.length > 1 ? i / (stops.length - 1) : 0} stopColor={c} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={W} height={H} fill={`url(#bg-${id})`} />
      </Svg>
    )
  }

  return (
    <Svg width={W} height={H} style={{ position: 'absolute', top: 0, left: 0 }}>
      <Defs>
        <ClipPath id={`clip-${id}`}>
          <Rect x={0} y={0} width={W} height={H} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#clip-${id})`}>
        <Rect x={0} y={0} width={W} height={H} fill={g.base} />
        {g.fills.map((f, i) => <Path key={`f${i}`} d={f.d} fill={f.fill} />)}
        {g.strokes.map((s, i) => (
          <Path key={`s${i}`} d={s.d} fill="none" stroke={BAND_STROKE_COLOR} strokeWidth={g.strokeWidth} />
        ))}
      </G>
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

/**
 * The bottom-centre mark and whatever is doing the work of making it visible.
 *
 * Everything is sized off one box so the treatments are directly comparable —
 * only the backing changes, never the mark's size or position.
 */
function LogoBlock({ i }: { i: HeritageInputs }) {
  const T = theme(!!i.printHardened)
  const t = i.logoTreatment ?? 'rules'
  const MARK_W = u(215), MARK_H = u(80)

  if (t === 'plain' || t === 'rules') {
    const left = (LABEL_W - MARK_W) / 2
    const top = LABEL_H - MARK_H - u(10)
    // Short rules flanking the mark. Deliberately SHORT rather than running to
    // the edges: a full-width rule turns into a second horizontal divider and
    // starts arguing with the one above the serial.
    const ruleLen = u(110)
    const gap = u(18)
    const ruleY = top + MARK_H / 2
    return (
      <>
        {t === 'rules' ? (
          <>
            <View style={{ position: 'absolute', left: left - gap - ruleLen, top: ruleY, width: ruleLen, height: u(5), backgroundColor: BRAND_PURPLE, opacity: 1 }} />
            <View style={{ position: 'absolute', left: left + MARK_W + gap, top: ruleY, width: ruleLen, height: u(5), backgroundColor: T.rule, opacity: 0.9 }} />
          </>
        ) : null}
        <View style={{ position: 'absolute', left, top, width: MARK_W, height: MARK_H, alignItems: 'center', justifyContent: 'center' }}>
          {i.colorLogoDataUrl ? <Image src={i.colorLogoDataUrl} style={{ width: MARK_W * 0.78, height: MARK_H * 0.78, objectFit: 'contain' }} /> : null}
        </View>
      </>
    )
  }

  // Brand-purple rounded plate, white mark. Sized tighter than the first pass:
  // the plate should read as a fitted badge around the mark, not as a bar that
  // happens to contain it.
  const plateW = u(172), plateH = u(64)
  const src = i.whiteLogoDataUrl ?? i.colorLogoDataUrl
  return (
    <View
      style={{
        position: 'absolute', left: (LABEL_W - plateW) / 2, top: LABEL_H - plateH - u(8),
        width: plateW, height: plateH, backgroundColor: BRAND_PURPLE, borderRadius: u(16),
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      {src ? <Image src={src} style={{ width: plateW * 0.80, height: plateH * 0.74, objectFit: 'contain' }} /> : null}
    </View>
  )
}

function HeritageFront({ i, chip }: { i: HeritageInputs; chip: GradeChip }) {
  const T = theme(!!i.printHardened)
  return (
    <View style={{ width: LABEL_W, height: LABEL_H, backgroundColor: T.field, position: 'relative', border: `${T.edgeWidth}pt solid ${T.edge}` }}>
      <View style={{ position: 'absolute', top: 0, left: 0, width: BAND_W, height: LABEL_H }}>
        <BandArt pattern={i.pattern} colors={i.bandColors} id="f" />
      </View>
      <View style={{ position: 'absolute', top: 0, left: BAND_W, width: RULE_W, height: LABEL_H, backgroundColor: T.rule }} />

      {/* Text block */}
      <View style={{ position: 'absolute', left: u(150), top: u(56), width: u(920) }}>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: u(84), color: T.ink }}>{i.primaryName}</Text>
        <Text style={{ fontFamily: 'Helvetica', fontSize: u(29), color: T.inkSoft, letterSpacing: u(4), marginTop: u(22) }}>
          {i.contextLine.toUpperCase()}
        </Text>
        <View style={{ height: 0.9, backgroundColor: T.divider, marginTop: u(30), width: u(940) }} />
        <Text style={{ fontFamily: 'Helvetica', fontSize: u(34), color: T.inkSoft, letterSpacing: u(2), marginTop: u(22) }}>
          Serial: {i.serial}
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

function Emblem({ id, left }: { id: keyof typeof EMBLEMS; left: number }) {
  const e = EMBLEMS[id]
  const trackLeft = (EMBLEM_SLOT - EMBLEM_TRACK) / 2
  const glyph = u(46)
  return (
    <View style={{ position: 'absolute', left, top: u(40), width: EMBLEM_SLOT, height: u(320) }}>
      {/* Drawn, not typed: Helvetica has no star/heart/diamond glyph, so a
          <Text> renders blank — which is what was happening here. */}
      <View style={{ width: EMBLEM_SLOT, alignItems: 'center' }}>
        <Svg width={glyph} height={glyph} viewBox="0 0 100 100">
          <Path d={e.path} fill={e.color} />
        </Svg>
      </View>
      <View
        style={{
          position: 'absolute', top: u(74), left: trackLeft,
          width: EMBLEM_TRACK, height: u(34),
          transform: 'rotate(-90deg)',
        }}
      >
        {/* right-aligned so the word ENDS at the mark, i.e. tops align once
            rotated — bottom-aligning leaves the tops ragged across emblems. */}
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: u(27), color: e.color, letterSpacing: u(3), textAlign: 'right' }}>
          {e.word}
        </Text>
      </View>
    </View>
  )
}

function HeritageBack({ i, chip }: { i: HeritageInputs; chip: GradeChip }) {
  const T = theme(!!i.printHardened)
  const sg = i.subgrades
  const row = (label: string, v: number | null) =>
    v == null ? null : (
      <Text key={label} style={{ fontFamily: 'Helvetica', fontSize: u(30), color: T.inkSoft, textAlign: 'right', marginBottom: u(20) }}>
        {label}: {v}
      </Text>
    )
  return (
    <View style={{ width: LABEL_W, height: LABEL_H, backgroundColor: T.field, position: 'relative', border: `${T.edgeWidth}pt solid ${T.edge}` }}>
      <View style={{ position: 'absolute', top: 0, left: 0, width: BAND_W, height: LABEL_H }}>
        <BandArt pattern={i.pattern} colors={i.bandColors} id="b" />
      </View>
      <View style={{ position: 'absolute', top: 0, left: BAND_W, width: RULE_W, height: LABEL_H, backgroundColor: T.rule }} />

      {/* QR carrying the mark. Caller builds it at error-correction H. */}
      {i.qrDataUrl ? (
        <View style={{ position: 'absolute', left: u(132), top: u(52), width: u(296), height: u(296), backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#D9D2C4', alignItems: 'center', justifyContent: 'center' }}>
          <Image src={i.qrDataUrl} style={{ width: u(280), height: u(280) }} />
        </View>
      ) : null}

      {i.showFounder ? <Emblem id="founder" left={u(458)} /> : null}
      {i.showCardLover ? <Emblem id="cardLover" left={u(532)} /> : null}
      {i.showVip ? <Emblem id="vip" left={u(606)} /> : null}

      {/* Grade + condition, centred. No serial — the QR encodes it. */}
      <View style={{ position: 'absolute', left: u(700), top: u(60), width: u(360), alignItems: 'center' }}>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: u(150), color: T.ink, lineHeight: 1 }}>
          {chip.grade === 0 ? 'A' : chip.grade}
        </Text>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: u(34), color: T.ink, letterSpacing: u(7), marginTop: u(14) }}>
          {(i.condition || chip.label).toUpperCase()}
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
  const chip = resolveGradeChip(inputs.grade, !!inputs.printHardened)
  const patternName = BAND_PATTERNS.find(p => p.id === inputs.pattern)?.name ?? inputs.pattern

  return (
    <Document>
      <Page size={[PAGE_W, PAGE_H]} style={{ paddingTop: 40, paddingHorizontal: 40, backgroundColor: '#FFFFFF' }}>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: '#141414' }}>
          Heritage (Round 3) — {patternName}{inputs.printHardened ? ' — PRINT-HARDENED' : ''} — true size 2.8&quot; x 0.8&quot;
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
