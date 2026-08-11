/* eslint-disable jsx-a11y/alt-text */
/**
 * Round 3 "Heritage" slab label — vector PDF, front + back.
 *
 * IN PRODUCTION since Aug 2026: Label Studio renders it via
 * labels/heritageSlabGenerator (which reuses the exported HeritageFront /
 * HeritageBack blocks inside the standard duplex cut-guide document), and the
 * admin Label Lab still renders the captioned proof sheet below. Shared layout
 * math lives in heritageLayout.ts so the Studio's SVG preview cannot drift.
 *
 * What it is:
 *   front — ivory field, patterned left band, dark type, grade CHIP coloured
 *           by grade (GRADE_CHIPS), DCM mark bottom-centre hugging the edge.
 *   back  — same band, QR carrying the DCM mark, emblems rotated 90deg CCW
 *           with the symbol on top, grade + condition centred, sub-grades
 *           right-aligned. No serial: the QR already encodes it.
 *
 * Unlike the modern/traditional generators (which hardcode '#7c3aed'), the
 * grade chip colour resolves from GRADE_CHIPS / GRADE_10_FOIL_STOPS.
 *
 * Units: @react-pdf is points. 2.8" x 0.8" = 201.6 x 57.6pt. Mockups were
 * authored at 1400 x 400px, so `u()` maps mockup px to points.
 */
import React from 'react'
// `Text as SvgText`: the same component renders as SVG <text> inside <Svg>,
// where — unlike ordinary Text — its fill can reference a gradient def.
import { Document, Page, View, Text, Text as SvgText, Image, Svg, Path, Rect, G, Defs, LinearGradient, Stop, ClipPath, Font } from '@react-pdf/renderer'
import { resolveGradeChip, GRADE_CHIP_BLACK, GRADE_10_FOIL_STOPS, type GradeChip } from '@/lib/labelPresets'
import { bandGeometry, BAND_STROKE_HEX, BAND_STROKE_OPACITY, BAND_PATTERNS, type BandPattern } from './bandGeometry'
import { EMBLEMS } from './emblemShapes'
import { heritageTheme, fitHeritageFront, heritageCtxTracking, heritageBackLayout, HERITAGE_CJK_RE } from './heritageLayout'

// Re-exported so consumers keep one import site.
export { BAND_PATTERNS }
export type { BandPattern }

/**
 * CJK support. The base-14 PDF fonts carry no CJK glyphs at all — a Japanese
 * card name set in Helvetica comes out as WinAnsi mojibake, which is what was
 * happening in the lab. Noto Sans JP is registered as a fallback family and
 * selected per text run; fontkit subsets it on embed, so the PDF only carries
 * the glyphs actually used. The ~5MB TTF is only fetched when a CJK card is
 * rendered, and only once per session.
 */
// Never hyphenate label text: react-pdf's default line breaker splits words
// with a hyphen ("Kurt Warn-\ner" on a printed label). Whole words only.
Font.registerHyphenationCallback((word) => [word])

const FONT_BASE = typeof window === 'undefined' ? `${process.cwd()}/public` : ''
Font.register({
  family: 'NotoSansJP',
  fonts: [
    { src: `${FONT_BASE}/fonts/NotoSansJP-Regular.ttf`, fontWeight: 400 },
    { src: `${FONT_BASE}/fonts/NotoSansJP-Bold.ttf`, fontWeight: 700 },
  ],
})


/** Font face for a text run: Helvetica normally, Noto Sans JP when CJK is present. */
const faceFor = (t: string, bold: boolean) =>
  HERITAGE_CJK_RE.test(t)
    ? { fontFamily: 'NotoSansJP', fontWeight: (bold ? 700 : 400) as 700 | 400 }
    : { fontFamily: bold ? 'Helvetica-Bold' : 'Helvetica' }

const INCH = 72
const LABEL_W = 2.8 * INCH        // 201.6
const LABEL_H = 0.8 * INCH        // 57.6
const PAGE_W = 8.5 * INCH
const PAGE_H = 11 * INCH

/** Mockup px (1400x400) -> points. */
const u = (px: number) => (px / 1400) * LABEL_W

const BAND_W = u(90)
const RULE_W = u(6)

/** DCM brand purple — the plate behind the bottom-centre mark. */
const BRAND_PURPLE = '#7C3AED'

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
  /**
   * Which mark to use. Black is the default: the navy house logo carries its
   * own hue and argues with the coloured grade numeral and the purple accents,
   * whereas black belongs to no palette and so cannot clash with one.
   */
  logoColor?: LogoColor
  /** Black mark, generated from the white one (negate RGB, keep alpha). */
  blackLogoDataUrl?: string | null
  /** QR with the mark knocked into the centre, built by the caller. */
  qrDataUrl?: string | null
  /**
   * Print-hardened rendering: paper-white field instead of the ivory tint,
   * inverted gold/silver chips, a keyline, and punchier type. See the theme
   * block below for why each one exists.
   */
  printHardened?: boolean
  /**
   * Per-grade chip colour overrides, keyed by grade ('1'..'10'). Overrides the
   * numeral/label ink (and, for 10, replaces the foil with a solid). Absent
   * grades keep the GRADE_CHIPS defaults.
   */
  gradeColors?: Record<string, string> | null
  showFounder?: boolean
  showCardLover?: boolean
  showVip?: boolean
}

/**
 * How the DCM mark is presented at the bottom edge.
 *
 * On the ivory field a bare navy mark at 200x78 mockup-px is honest but quiet —
 * at 2.8" it reads as a smudge from arm's length, which defeats the point of
 * moving it to the bottom centre in the first place. Each treatment below buys
 * presence a different way, and they cost different amounts of ink.
 */
export type LogoColor = 'black' | 'color' | 'white'

export const LOGO_COLORS: { id: LogoColor; name: string }[] = [
  { id: 'black', name: 'Black' },
  { id: 'color', name: 'Colour' },
  { id: 'white', name: 'White' },
]

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
          <Path key={`s${i}`} d={s.d} fill="none" stroke={BAND_STROKE_HEX} strokeOpacity={BAND_STROKE_OPACITY} strokeWidth={g.strokeWidth} />
        ))}
      </G>
    </Svg>
  )
}

// ---------------------------------------------------------------------------

/** Interpolate along GRADE_10_FOIL_STOPS at t in [0,1]. */
const foilAt = (() => {
  const rgb = GRADE_10_FOIL_STOPS.map(c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)))
  return (t: number) => {
    const x = Math.min(Math.max(t, 0), 1) * (rgb.length - 1)
    const i = Math.min(Math.floor(x), rgb.length - 2)
    const f = x - i
    const mix = rgb[i].map((v, k) => Math.round(v + (rgb[i + 1][k] - v) * f))
    return `#${mix.map(v => v.toString(16).padStart(2, '0')).join('')}`
  }
})()

/**
 * Gem Mint 10 renders as foil, not gold: rainbow sweep through the numeral and
 * the keyline around it, on the black chip.
 *
 * Two @react-pdf limitations shape the drawing (verified empirically — both
 * fail SILENTLY, falling back to a solid):
 *   - gradient `stroke` is not supported on any SVG element, so the keyline is
 *     a gradient-FILLED rounded rect with a black rounded rect painted on top;
 *   - gradient `fill` is not supported on SVG <text>, so the numeral is drawn
 *     once per diagonal strip, each copy clipped to its strip and tinted by
 *     foilAt(). The strips span the DIGIT box, not the chip, so the numeral
 *     carries the full ramp rather than the middle slice of it.
 */
const FOIL_STRIPS = 24

function FoilChipBlock({ chip, size, solid }: { chip: GradeChip; size: number; solid?: string | null }) {
  const w = size
  const h = size * (252 / 240)
  const bw = u(6)
  const r = u(28)
  const numSize = u(150)
  const baseline = h * 0.40 + numSize * 0.36
  // Matches GradeChipBlock's knockout floor: 28/32, ~4pt at true size.
  const labelSize = u(chip.label.length > 8 ? 28 : 32)
  // Digit box for the sweep, in diagonal coordinates c = x + y.
  const numW = numSize * 1.3
  const c0 = (w - numW) / 2 + (baseline - numSize * 0.72)
  const c1 = (w + numW) / 2 + baseline
  // A custom grade-10 colour replaces the foil: solid keyline + solid numeral,
  // still on the black chip so the top grade keeps its structural border.
  if (solid) {
    return (
      <Svg width={w} height={h}>
        <Rect x={bw / 2} y={bw / 2} width={w - bw} height={h - bw} rx={r} ry={r}
          fill={GRADE_CHIP_BLACK} stroke={solid} strokeWidth={bw} />
        <SvgText x={w / 2} y={baseline} textAnchor="middle" fill={solid}
          style={{ fontFamily: 'Helvetica-Bold', fontSize: numSize }}>
          {String(chip.grade)}
        </SvgText>
        <SvgText x={w / 2} y={baseline + u(44)} textAnchor="middle" fill="#F4EFE4"
          style={{ fontFamily: 'Helvetica-Bold', fontSize: labelSize, letterSpacing: u(4) }}>
          {chip.label}
        </SvgText>
      </Svg>
    )
  }
  const strips = Array.from({ length: FOIL_STRIPS }, (_, s) => ({
    lo: c0 + ((c1 - c0) * s) / FOIL_STRIPS,
    hi: c0 + ((c1 - c0) * (s + 1)) / FOIL_STRIPS + 0.5,
    color: foilAt((s + 0.5) / FOIL_STRIPS),
  }))
  return (
    <Svg width={w} height={h}>
      <Defs>
        <LinearGradient id="foil-ring" x1="0" y1="0" x2="1" y2="1">
          {GRADE_10_FOIL_STOPS.map((c, i) => (
            <Stop key={i} offset={i / (GRADE_10_FOIL_STOPS.length - 1)} stopColor={c} />
          ))}
        </LinearGradient>
        {strips.map((s, i) => (
          <ClipPath key={i} id={`foil-strip-${i}`}>
            <Path d={`M ${s.lo} 0 L ${s.hi} 0 L 0 ${s.hi} L 0 ${s.lo} Z`} />
          </ClipPath>
        ))}
      </Defs>
      <Rect x={0} y={0} width={w} height={h} rx={r} ry={r} fill="url(#foil-ring)" />
      <Rect x={bw} y={bw} width={w - 2 * bw} height={h - 2 * bw} rx={r - bw} ry={r - bw} fill={GRADE_CHIP_BLACK} />
      {strips.map((s, i) => (
        <G key={i} clipPath={`url(#foil-strip-${i})`}>
          <SvgText
            x={w / 2} y={baseline} textAnchor="middle" fill={s.color}
            style={{ fontFamily: 'Helvetica-Bold', fontSize: numSize }}
          >
            {String(chip.grade)}
          </SvgText>
        </G>
      ))}
      <SvgText
        x={w / 2} y={baseline + u(44)} textAnchor="middle"
        fill="#F4EFE4" style={{ fontFamily: 'Helvetica-Bold', fontSize: labelSize, letterSpacing: u(4) }}
      >
        {chip.label}
      </SvgText>
    </Svg>
  )
}

function GradeChipBlock({ chip, size, inkOverride }: { chip: GradeChip; size: number; inkOverride?: string | null }) {
  if (chip.grade === 10) return <FoilChipBlock chip={chip} size={size} solid={inkOverride} />
  const ink = inkOverride || chip.ink
  const isBig = String(chip.grade).length > 1 || chip.grade === 0
  return (
    <View
      style={{
        width: size, height: size * (252 / 240), borderRadius: u(28),
        backgroundColor: chip.fill, alignItems: 'center', justifyContent: 'center',
        // No border here, ever: grade 10 alone carries a keyline (the foil
        // ring in FoilChipBlock), and it only signals Gem Mint while it is
        // scarce. The old faint rgba() keyline also rendered with a green
        // cast in @react-pdf, which is what finally killed it.
      }}
    >
      <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: u(isBig ? 150 : 168), color: ink, lineHeight: 1 }}>
        {chip.grade === 0 ? 'A' : chip.grade}
      </Text>
      {/* 28/32 (4.0/4.6pt), up from 26/30, and no opacity: this is KNOCKOUT
          type — light on a dark chip — which fills in on inkjet below ~4pt,
          and dimming it to 90% only helps it disappear. */}
      <Text
        style={{
          fontFamily: 'Helvetica-Bold', fontSize: u(chip.label.length > 8 ? 28 : 32),
          color: ink, letterSpacing: u(4), marginTop: u(6),
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
function LogoBlock({ i, showRules = true }: { i: HeritageInputs; showRules?: boolean }) {
  const t = i.logoTreatment ?? 'rules'
  const c = i.logoColor ?? 'black'
  // 260x96 with the mark at 0.85 of the box (was 238x88 at 0.78) — about 20%
  // more visible mark. The box top moves up only 16 mockup-px, which the
  // densest fitted text stack still clears.
  const MARK_W = u(260), MARK_H = u(96)

  const src =
    c === 'white' ? (i.whiteLogoDataUrl ?? i.colorLogoDataUrl)
    : c === 'color' ? i.colorLogoDataUrl
    : (i.blackLogoDataUrl ?? i.colorLogoDataUrl)

  if (t === 'plain' || t === 'rules') {
    const left = (LABEL_W - MARK_W) / 2
    const top = LABEL_H - MARK_H - u(8)
    // Accent lines in the same ink as the mark so the group reads as one
    // object. Short on purpose — a full-width rule becomes a second divider and
    // argues with the one above the serial.
    const ruleLen = u(112)
    const gap = u(20)
    // Bar height is u(6), so back the top off by half of it — otherwise the
    // bars hang below the mark's centreline instead of sitting on it.
    const ruleY = top + MARK_H / 2 - u(3)
    const ink = c === 'white' ? '#FFFFFF' : c === 'black' ? '#101014' : BRAND_PURPLE
    return (
      <>
        {t === 'rules' && showRules ? (
          <>
            <View style={{ position: 'absolute', left: left - gap - ruleLen, top: ruleY, width: ruleLen, height: u(6), backgroundColor: ink }} />
            <View style={{ position: 'absolute', left: left + MARK_W + gap, top: ruleY, width: ruleLen, height: u(6), backgroundColor: ink }} />
          </>
        ) : null}
        <View style={{ position: 'absolute', left, top, width: MARK_W, height: MARK_H, alignItems: 'center', justifyContent: 'center' }}>
          {src ? <Image src={src} style={{ width: MARK_W * 0.85, height: MARK_H * 0.85, objectFit: 'contain' }} /> : null}
        </View>
      </>
    )
  }

  const plateW = u(172), plateH = u(64)
  return (
    <View
      style={{
        position: 'absolute', left: (LABEL_W - plateW) / 2, top: LABEL_H - plateH - u(8),
        width: plateW, height: plateH, backgroundColor: BRAND_PURPLE, borderRadius: u(16),
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      {i.whiteLogoDataUrl ? <Image src={i.whiteLogoDataUrl} style={{ width: plateW * 0.80, height: plateH * 0.74, objectFit: 'contain' }} /> : null}
    </View>
  )
}

/**
 * Exported for the production generator (heritageSlabGenerator) and reused by
 * the lab doc below. Fitting, the accent-bar yield rule, and the theme all come
 * from heritageLayout so the Studio's SVG preview renders the same geometry.
 */
export function HeritageFront({ i, chip }: { i: HeritageInputs; chip: GradeChip }) {
  const T = heritageTheme(!!i.printHardened)
  const { name, ctx, rulesOk } = fitHeritageFront(i.primaryName, i.contextLine, i.serial)
  return (
    <View style={{ width: LABEL_W, height: LABEL_H, backgroundColor: T.field, position: 'relative', border: `${T.edgeWidth}pt solid ${T.edge}` }}>
      <View style={{ position: 'absolute', top: 0, left: 0, width: BAND_W, height: LABEL_H }}>
        <BandArt pattern={i.pattern} colors={i.bandColors} id="f" />
      </View>
      <View style={{ position: 'absolute', top: 0, left: BAND_W, width: RULE_W, height: LABEL_H, backgroundColor: T.rule }} />

      {/* Text block — fitted, never truncated. Real card names run to 119
          characters and set lines to 128; both used to run under the chip. */}
      <View style={{ position: 'absolute', left: u(150), top: u(50), width: u(940) }}>
        {name.rows.map((r, ri) => (
          <Text key={`n${ri}`} style={{ ...faceFor(r, true), fontSize: u(name.size), color: T.ink, lineHeight: 1.06 }}>
            {r}
          </Text>
        ))}
        {ctx.rows.map((r, ri) => (
          <Text
            key={`c${ri}`}
            style={{
              ...faceFor(r, false), fontSize: u(ctx.size), color: T.inkSoft,
              letterSpacing: u(heritageCtxTracking(ctx.size)), lineHeight: 1.2,
              marginTop: ri === 0 ? u(Math.max(name.size * 0.28, 18)) : 0,
            }}
          >
            {r}
          </Text>
        ))}
        <View style={{ height: 0.9, backgroundColor: T.divider, marginTop: u(24), width: u(940) }} />
        <Text style={{ fontFamily: 'Helvetica', fontSize: u(34), color: T.inkSoft, letterSpacing: u(2), marginTop: u(18) }}>
          Serial: {i.serial}
        </Text>
      </View>

      {/* Grade chip */}
      <View style={{ position: 'absolute', left: u(1130), top: u(64) }}>
        <GradeChipBlock chip={chip} size={u(240)} inkOverride={i.gradeColors?.[String(chip.grade)]} />
      </View>

      {/* Mark, bottom-centre, hugging the edge */}
      <LogoBlock i={i} showRules={rulesOk} />
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
      {/* Track centre at u(180): rotation maps the track's right edge to the
          TOP of the rotated box, so a right-aligned word's first letter lands
          at centre - TRACK/2 = u(60) — just below the glyph, whatever the word
          length. The previous top of u(74) put the centre at u(91), which sent
          long words 29px ABOVE the container and straight through the glyph. */}
      <View
        style={{
          position: 'absolute', top: u(180) - u(34) / 2, left: trackLeft,
          width: EMBLEM_TRACK, height: u(34),
          transform: 'rotate(-90deg)',
        }}
      >
        {/* right-aligned so the word ENDS at the mark, i.e. tops align once
            rotated — bottom-aligning leaves the tops ragged across emblems. */}
        {/* 30 (4.3pt) — 27 was under the ~4pt small-caps floor, and these are
            coloured, not black, so they need the extra size to hold on paper. */}
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: u(30), color: e.color, letterSpacing: u(3), textAlign: 'right' }}>
          {e.word}
        </Text>
      </View>
    </View>
  )
}

export function HeritageBack({ i, chip }: { i: HeritageInputs; chip: GradeChip }) {
  const T = heritageTheme(!!i.printHardened)
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

      {/* QR carrying the mark: the DCM logo sits on a white disc at the QR's
          centre, matching production (generateQRCodeWithLogo: logo ~20% of the
          QR, disc slightly larger). Error-correction H absorbs the occlusion.
          Composited here rather than baked into the raster so it stays sharp
          and works for any caller that passes a plain QR. */}
      {i.qrDataUrl ? (
        <View style={{ position: 'absolute', left: u(132), top: u(52), width: u(296), height: u(296), backgroundColor: '#FFFFFF', borderWidth: 0.5, borderColor: '#D9D2C4', alignItems: 'center', justifyContent: 'center' }}>
          <Image src={i.qrDataUrl} style={{ width: u(280), height: u(280) }} />
          {i.colorLogoDataUrl ? (
            <>
              <View style={{ position: 'absolute', left: u(113), top: u(113), width: u(70), height: u(70), borderRadius: u(35), backgroundColor: '#FFFFFF' }} />
              <View style={{ position: 'absolute', left: u(120), top: u(120), width: u(56), height: u(56), alignItems: 'center', justifyContent: 'center' }}>
                <Image src={i.colorLogoDataUrl} style={{ width: u(56), height: u(56), objectFit: 'contain' }} />
              </View>
            </>
          ) : null}
        </View>
      ) : null}

      {(() => {
        // Shared layout: emblems compact leftward, the grade column centres
        // in the space between the left cluster and the sub-grades, and the
        // condition shrinks to fit rather than running under either.
        const condition = (i.condition || chip.label).toUpperCase()
        const hasSubgrades = [sg.centering, sg.corners, sg.edges, sg.surface].some(v => v != null)
        const L = heritageBackLayout({
          showFounder: i.showFounder,
          showCardLover: i.showCardLover,
          showVip: i.showVip,
          hasSubgrades,
          condition,
        })
        const shownEmblems = ([
          ['founder', i.showFounder],
          ['cardLover', i.showCardLover],
          ['vip', i.showVip],
        ] as const).filter(([, on]) => on).map(([id]) => id)
        return (
          <>
            {shownEmblems.map((id, idx) => (
              <Emblem key={id} id={id} left={u(L.emblemXs[idx])} />
            ))}

            {/* Grade + condition, centred in the free span. No serial — the
                QR encodes it. */}
            <View style={{ position: 'absolute', left: u(L.left), top: u(60), width: u(L.right - L.left), alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: u(150), color: T.ink, lineHeight: 1 }}>
                {chip.grade === 0 ? 'A' : chip.grade}
              </Text>
              <Text style={{ ...faceFor(condition, true), fontSize: u(L.condSize), color: T.ink, letterSpacing: u(L.condTracking), marginTop: u(14) }}>
                {condition}
              </Text>
            </View>
          </>
        )
      })()}

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
