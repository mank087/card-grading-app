'use client'

/**
 * Heritage label — live Studio preview, pure SVG.
 *
 * The designer's canvas previewer (useLabelPreview -> customSlabLabelGenerator)
 * only knows the modern/traditional layouts, and the PDF renderer is too heavy
 * to run per keystroke in the client. This component redraws the Heritage
 * label from the SAME shared sources the print PDF uses — heritageLayout for
 * geometry/theme/fitting, bandGeometry for the band, GRADE_CHIPS + foil stops
 * for the chip — inside a 1400x400 viewBox, so what you see is what prints.
 *
 * Browser SVG natively supports gradient fill on text, so the grade-10 foil
 * numeral is a one-liner here (the PDF needs strip-clipping for the same
 * effect — see FoilChipBlock in heritageSlabPdfDoc).
 */
import React, { useMemo, useId } from 'react'
import type { SlabLabelData } from '@/lib/slabLabelGenerator'
import { bandGeometry, BAND_STROKE_HEX, BAND_STROKE_OPACITY, type BandPattern } from '@/lib/labelLab/bandGeometry'
import { EMBLEMS, EMBLEM_ORDER } from '@/lib/labelLab/emblemShapes'
import {
  HERITAGE_PX as PX,
  heritageTheme,
  fitHeritageFront,
  heritageRulesFit,
  heritageMarkBox,
  heritageCtxTracking,
  heritageBackLayout,
} from '@/lib/labelLab/heritageLayout'
import { resolveGradeChip, GRADE_CHIP_BLACK, GRADE_10_FOIL_STOPS } from '@/lib/labelPresets'

const FONT = 'Helvetica, Arial, "Noto Sans JP", sans-serif'

interface Props {
  data: SlabLabelData
  side: 'front' | 'back'
  pattern: BandPattern
  bandColors: string[]
  className?: string
  /**
   * Logo image sources. Default to the public paths, which is right for live
   * DOM previews. Rasterization (drawing this SVG into a canvas) must pass
   * data: URLs instead — browsers refuse to load external resources inside an
   * SVG rendered as an image, so path hrefs would silently drop the marks.
   */
  blackLogoHref?: string
  colorLogoHref?: string
  /**
   * Rasterization mode: omit every nested <image> (logos, QR). Engines drop
   * SVG-as-image subresources when the SVG is drawn to a canvas, so the
   * rasterizer suppresses them here and composites the bitmaps natively.
   */
  suppressImages?: boolean
  /** Per-grade chip colour overrides ('1'..'10'); 10 replaces the foil with a solid. */
  gradeColors?: Record<string, string> | null
  /**
   * Front-mark scale, 1 = the historic size. Enterprise stores set this in
   * Brand Setup so a square or stacked logo isn't dwarfed by the wordmark-shaped
   * slot. Growth is clamped per card against the fitted text — see
   * heritageMarkBox — so an oversized value can never print over the serial.
   */
  logoScale?: number
  /**
   * Physical aspect ratio (width/height) to stretch the preview to. The design
   * canvas is 3.5:1 (2.8" × 0.8"); non-standard slots like Zion Mag Pro
   * (2.51" × 0.76" = 3.30:1) mirror the print pipeline's mild anisotropic
   * scale by stretching the SVG. Absent = natural 3.5:1.
   */
  stretchAspect?: number
}

function gradeString(data: SlabLabelData): string {
  if (data.grade !== null && data.grade !== undefined) return Math.round(data.grade).toString()
  return data.isAlteredAuthentic ? 'A' : '—'
}

function Band({ pattern, colors, idPrefix }: { pattern: BandPattern; colors: string[]; idPrefix: string }) {
  const g = useMemo(() => bandGeometry(pattern, colors, PX.BAND_W, PX.H), [pattern, colors])
  const clipId = `${idPrefix}-band-clip`
  const gradId = `${idPrefix}-band-grad`
  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={PX.BAND_W} height={PX.H} />
        </clipPath>
        {g.gradientStops && (
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            {g.gradientStops.map((c, i) => (
              <stop key={i} offset={g.gradientStops!.length > 1 ? i / (g.gradientStops!.length - 1) : 0} stopColor={c} />
            ))}
          </linearGradient>
        )}
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x={0} y={0} width={PX.BAND_W} height={PX.H} fill={g.gradientStops ? `url(#${gradId})` : g.base} />
        {g.fills.map((f, i) => <path key={`f${i}`} d={f.d} fill={f.fill} />)}
        {g.strokes.map((s, i) => (
          <path key={`s${i}`} d={s.d} fill="none" stroke={BAND_STROKE_HEX} strokeOpacity={BAND_STROKE_OPACITY} strokeWidth={g.strokeWidth} />
        ))}
      </g>
    </>
  )
}

function GradeChip({ grade, hardened, idPrefix, gradeColors }: { grade: string; hardened: boolean; idPrefix: string; gradeColors?: Record<string, string> | null }) {
  const chip = resolveGradeChip(grade, hardened)
  const override = gradeColors?.[String(chip.grade)]
  const { CHIP_X: x, CHIP_Y: y, CHIP_W: w, CHIP_H: h, CHIP_R: r, CHIP_BORDER: bw } = PX
  const numeral = chip.grade === 0 ? 'A' : String(chip.grade)
  const labelSize = chip.label.length > 8 ? 28 : 32
  if (chip.grade === 10) {
    const foilId = `${idPrefix}-foil`
    const numSize = 150
    const baseline = y + h * 0.4 + numSize * 0.36
    if (override) {
      // Custom grade-10 colour: solid keyline + numeral, still on black.
      return (
        <>
          <rect x={x + bw / 2} y={y + bw / 2} width={w - bw} height={h - bw} rx={r} ry={r}
            fill={GRADE_CHIP_BLACK} stroke={override} strokeWidth={bw} />
          <text x={x + w / 2} y={baseline} textAnchor="middle" fill={override}
            fontFamily={FONT} fontWeight={700} fontSize={numSize}>
            {numeral}
          </text>
          <text x={x + w / 2} y={baseline + 44} textAnchor="middle" fill="#F4EFE4"
            fontFamily={FONT} fontWeight={700} fontSize={labelSize} letterSpacing={4}>
            {chip.label}
          </text>
        </>
      )
    }
    return (
      <>
        <defs>
          <linearGradient id={foilId} x1="0" y1="0" x2="1" y2="1">
            {GRADE_10_FOIL_STOPS.map((c, i) => (
              <stop key={i} offset={i / (GRADE_10_FOIL_STOPS.length - 1)} stopColor={c} />
            ))}
          </linearGradient>
        </defs>
        <rect x={x + bw / 2} y={y + bw / 2} width={w - bw} height={h - bw} rx={r} ry={r}
          fill={GRADE_CHIP_BLACK} stroke={`url(#${foilId})`} strokeWidth={bw} />
        <text x={x + w / 2} y={baseline} textAnchor="middle" fill={`url(#${foilId})`}
          fontFamily={FONT} fontWeight={700} fontSize={numSize}>
          {numeral}
        </text>
        <text x={x + w / 2} y={baseline + 44} textAnchor="middle" fill="#F4EFE4"
          fontFamily={FONT} fontWeight={700} fontSize={labelSize} letterSpacing={4}>
          {chip.label}
        </text>
      </>
    )
  }
  const ink = override || chip.ink
  const isBig = numeral.length > 1
  const numSize = isBig ? 150 : 168
  const contentH = numSize + 6 + labelSize
  const top = y + (h - contentH) / 2
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx={r} ry={r} fill={chip.fill} />
      <text x={x + w / 2} y={top + numSize * 0.8} textAnchor="middle" fill={ink}
        fontFamily={FONT} fontWeight={700} fontSize={numSize}>
        {numeral}
      </text>
      <text x={x + w / 2} y={top + numSize + 6 + labelSize * 0.8} textAnchor="middle" fill={ink}
        fontFamily={FONT} fontWeight={700} fontSize={labelSize} letterSpacing={4}>
        {chip.label}
      </text>
    </>
  )
}

function FrontSide({ data, pattern, bandColors, blackLogoHref, uid, gradeColors, suppressImages, logoScale }: { data: SlabLabelData; pattern: BandPattern; bandColors: string[]; blackLogoHref: string; uid: string; gradeColors?: Record<string, string> | null; suppressImages?: boolean; logoScale: number }) {
  const T = heritageTheme(true)
  const fit = fitHeritageFront(data.primaryName || 'Card', data.contextLine || '', data.serial)
  const { name, ctx } = fit

  // Text stack — same arithmetic as the PDF's flow layout, made explicit.
  const nameYs = name.rows.map((_, i) => PX.TEXT_Y + i * name.size * 1.06)
  const ctxTop = PX.TEXT_Y + name.rows.length * name.size * 1.06 + Math.max(name.size * 0.28, 18)
  const ctxYs = ctx.rows.map((_, i) => ctxTop + i * ctx.size * 1.2)
  const dividerY = ctxTop + ctx.rows.length * ctx.size * 1.2 + 24
  const serialY = dividerY + 6 + 18

  // Bottom-centre mark ('rules' treatment, black mark — the Studio defaults).
  // Enterprise stores can scale their mark; heritageMarkBox clamps the growth
  // against THIS card's fitted text so a big logo can never reach the serial.
  const mark = heritageMarkBox(logoScale, fit)
  // Bars grow outward with the mark, so re-check them against the serial.
  const rulesOk = heritageRulesFit(fit, mark)

  return (
    <>
      <Band pattern={pattern} colors={bandColors} idPrefix={uid + "f"} />
      <rect x={PX.BAND_W} y={0} width={PX.RULE_W} height={PX.H} fill={T.rule} />

      {name.rows.map((row, i) => (
        <text key={`n${i}`} x={PX.TEXT_X} y={nameYs[i]} dominantBaseline="hanging"
          fontFamily={FONT} fontWeight={700} fontSize={name.size} fill={T.ink}>
          {row}
        </text>
      ))}
      {ctx.rows.map((row, i) => (
        <text key={`c${i}`} x={PX.TEXT_X} y={ctxYs[i]} dominantBaseline="hanging"
          fontFamily={FONT} fontSize={ctx.size} fill={T.inkSoft} letterSpacing={heritageCtxTracking(ctx.size)}>
          {row}
        </text>
      ))}
      <rect x={PX.TEXT_X} y={dividerY} width={PX.TEXT_BOX} height={6} fill={T.divider} />
      <text x={PX.TEXT_X} y={serialY} dominantBaseline="hanging"
        fontFamily={FONT} fontSize={34} fill={T.inkSoft} letterSpacing={2}>
        Serial: {data.serial}
      </text>

      <GradeChip grade={gradeString(data)} hardened idPrefix={uid + "f"} gradeColors={gradeColors} />

      {rulesOk && (
        <>
          <rect x={mark.ruleLeft} y={mark.ruleY} width={mark.ruleLen} height={6} fill="#101014" />
          <rect x={mark.ruleRight} y={mark.ruleY} width={mark.ruleLen} height={6} fill="#101014" />
        </>
      )}
      {!suppressImages && <image
        href={blackLogoHref}
        x={mark.x}
        y={mark.y}
        width={mark.w}
        height={mark.h}
        preserveAspectRatio="xMidYMid meet"
      />}
    </>
  )
}

function BackSide({ data, pattern, bandColors, colorLogoHref, uid, suppressImages }: { data: SlabLabelData; pattern: BandPattern; bandColors: string[]; colorLogoHref: string; uid: string; suppressImages?: boolean }) {
  const T = heritageTheme(true)
  const grade = gradeString(data)
  const chip = resolveGradeChip(grade, true)
  const condition = ((data.isAlteredAuthentic && data.grade === null ? 'Authentic' : data.condition) || chip.label).toUpperCase()

  const emblemFlags: Record<(typeof EMBLEM_ORDER)[number], boolean | undefined> = {
    founder: data.showFounderEmblem,
    cardLover: data.showCardLoversEmblem,
    vip: data.showVipEmblem,
  }

  const subs: [string, number | undefined][] = [
    ['Centering', data.subScores?.centering],
    ['Corners', data.subScores?.corners],
    ['Edges', data.subScores?.edges],
    ['Surface', data.subScores?.surface],
  ]
  const shownSubs = subs.filter(([, v]) => v != null && isFinite(v)) as [string, number][]

  // Shared layout: emblems compact leftward, the grade column centres in the
  // free span, the condition shrinks to fit instead of running under anything.
  const shownEmblems = EMBLEM_ORDER.filter(id => emblemFlags[id])
  const L = heritageBackLayout({
    showFounder: data.showFounderEmblem,
    showCardLover: data.showCardLoversEmblem,
    showVip: data.showVipEmblem,
    hasSubgrades: shownSubs.length > 0,
    condition,
  })

  return (
    <>
      <Band pattern={pattern} colors={bandColors} idPrefix={uid + "b"} />
      <rect x={PX.BAND_W} y={0} width={PX.RULE_W} height={PX.H} fill={T.rule} />

      {/* QR + DCM mark on a white disc, as printed */}
      {data.qrCodeDataUrl ? (
        <>
          <rect x={PX.QR_X} y={PX.QR_Y} width={PX.QR_BOX} height={PX.QR_BOX} fill="#FFFFFF" stroke="#D9D2C4" strokeWidth={2} />
          {!suppressImages && <image href={data.qrCodeDataUrl} x={PX.QR_X + 8} y={PX.QR_Y + 8} width={PX.QR_IMG} height={PX.QR_IMG} />}
          <circle cx={PX.QR_X + PX.QR_BOX / 2} cy={PX.QR_Y + PX.QR_BOX / 2} r={PX.QR_LOGO_DISC / 2} fill="#FFFFFF" />
          {!suppressImages && <image
            href={colorLogoHref}
            x={PX.QR_X + (PX.QR_BOX - PX.QR_LOGO) / 2}
            y={PX.QR_Y + (PX.QR_BOX - PX.QR_LOGO) / 2}
            width={PX.QR_LOGO}
            height={PX.QR_LOGO}
            preserveAspectRatio="xMidYMid meet"
          />}
        </>
      ) : null}

      {/* Emblems — glyph on top, word rotated 90° CCW reading bottom-to-top,
          starting just below the glyph (heritageLayout EMBLEM_WORD_CENTER). */}
      {shownEmblems.map((id, slot) => {
        const e = EMBLEMS[id]
        const x = L.emblemXs[slot]
        const glyphX = x + (PX.EMBLEM_SLOT - PX.EMBLEM_GLYPH) / 2
        const cx = x + PX.EMBLEM_SLOT / 2
        const wordEndY = PX.EMBLEM_TOP + PX.EMBLEM_WORD_CENTER - PX.EMBLEM_TRACK / 2
        return (
          <g key={id}>
            <g transform={`translate(${glyphX} ${PX.EMBLEM_TOP}) scale(${PX.EMBLEM_GLYPH / 100})`}>
              <path d={e.path} fill={e.color} />
            </g>
            <text
              transform={`rotate(-90 ${cx} ${wordEndY})`}
              x={cx} y={wordEndY}
              textAnchor="end" dominantBaseline="central"
              fontFamily={FONT} fontWeight={700} fontSize={30} letterSpacing={3} fill={e.color}
            >
              {e.word}
            </text>
          </g>
        )
      })}

      {/* Grade + condition, centred in the free span */}
      <text x={L.centerX} y={PX.GRADE_Y + 150 * 0.8} textAnchor="middle"
        fontFamily={FONT} fontWeight={700} fontSize={150} fill={T.ink}>
        {chip.grade === 0 ? 'A' : grade}
      </text>
      <text x={L.centerX} y={PX.GRADE_Y + 150 + 14 + L.condSize * 0.8} textAnchor="middle"
        fontFamily={FONT} fontWeight={700} fontSize={L.condSize} letterSpacing={L.condTracking} fill={T.ink}>
        {condition}
      </text>

      {/* Sub-grades, right-aligned */}
      {shownSubs.map(([label, v], i) => (
        <text key={label} x={PX.W - PX.SUBS_RIGHT} y={PX.SUBS_TOP + i * 56 + 24} textAnchor="end"
          fontFamily={FONT} fontSize={30} fill={T.inkSoft}>
          {label}: {Math.round(v * 2) / 2}
        </text>
      ))}
    </>
  )
}

export function HeritageLabelPreview({ data, side, pattern, bandColors, className, blackLogoHref = '/DCM-logo-black.png', colorLogoHref = '/DCM-logo.png', gradeColors = null, suppressImages = false, logoScale = 1, stretchAspect }: Props) {
  // Unique per instance: several previews render on one page (desktop slab,
  // hidden mobile block, gallery tile), and duplicated gradient/clip ids make
  // url(#...) resolve to the FIRST one in the document — if that copy sits in
  // a display:none subtree, Chromium paints nothing, which is exactly how the
  // grade-10 foil numeral and ring disappeared.
  const uid = 'h' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const T = heritageTheme(true)
  return (
    <svg
      viewBox={`0 0 ${PX.W} ${PX.H}`}
      className={className}
      preserveAspectRatio={stretchAspect ? 'none' : undefined}
      style={
        stretchAspect
          ? { display: 'block', width: '100%', height: 'auto', aspectRatio: String(stretchAspect) }
          : { display: 'block', width: '100%', height: 'auto' }
      }
      role="img"
      aria-label={`Heritage label preview — ${side}`}
    >
      <rect x={0} y={0} width={PX.W} height={PX.H} fill={T.field} stroke={T.edge} strokeWidth={T.edgeWidth * 7} />
      {side === 'front'
        ? <FrontSide data={data} pattern={pattern} bandColors={bandColors} blackLogoHref={blackLogoHref} uid={uid} gradeColors={gradeColors} suppressImages={suppressImages} logoScale={logoScale} />
        : <BackSide data={data} pattern={pattern} bandColors={bandColors} colorLogoHref={colorLogoHref} uid={uid} suppressImages={suppressImages} />}
    </svg>
  )
}

export default HeritageLabelPreview
