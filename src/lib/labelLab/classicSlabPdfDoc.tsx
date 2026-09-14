/* eslint-disable jsx-a11y/alt-text */
/**
 * Classic slab label ("Traditional", rebuilt Sept 2026) — vector PDF blocks.
 *
 * Front: purple frame, white field with faint purple waves, four all-caps
 * identification lines on the left, the card number / condition / grade /
 * serial stacked right-aligned on the right, and the DCM mark on a white plate
 * straddling the bottom frame.
 * Back: the same frame, the DCM mark on the left, a centred cert block, and a
 * QR on a white plate. Nothing else — no sub-grades, no emblems.
 *
 * All geometry and every fitting decision lives in classicLayout.ts so the
 * Studio's SVG preview renders the same label. This file only draws.
 *
 * Units: @react-pdf is points; 2.8" x 0.8" = 201.6 x 57.6pt. The design is
 * authored at 1400 x 400 design units (CLASSIC_PX), so `u()` maps them.
 *
 * The `bare` prop exists for the same reason Heritage's does: react-pdf 4.5
 * applies a scale() transform's Y factor TWICE to the transformed node's own
 * background and border, so a panel that paints its own chrome comes out short
 * at non-standard sizes. Bare panels paint no root chrome; the frame itself is
 * a CHILD view here, which scales correctly, so bare and non-bare output are
 * otherwise identical.
 */
import React from 'react'
import { View, Text, Image, Svg, Path, Rect, G, Defs, ClipPath, Font } from '@react-pdf/renderer'
import {
  CLASSIC_PX,
  CLASSIC_PURPLE,
  CLASSIC_INK,
  CLASSIC_INK_SOFT,
  CLASSIC_FIELD,
  CLASSIC_CJK_RE,
  classicField,
  classicWavePaths,
  classicQrPlate,
  classicBackMark,
  classicBaselineTop,
  classicLines,
  classicLeftMaxWidths,
  fitClassicFront,
  fitClassicBack,
  type ClassicLineSource,
  type ClassicLines,
} from './classicLayout'

// Never hyphenate label text: react-pdf's default line breaker splits words
// with a hyphen ("Kurt Warn-\ner" on a printed label). Whole words only.
Font.registerHyphenationCallback((word) => [word])

/**
 * CJK support, registered exactly as Heritage does: the base-14 PDF fonts
 * carry no CJK glyphs, so a Japanese card name set in Helvetica comes out as
 * WinAnsi mojibake. fontkit subsets Noto Sans JP on embed.
 */
const FONT_BASE = typeof window === 'undefined' ? `${process.cwd()}/public` : ''
Font.register({
  family: 'NotoSansJP',
  fonts: [
    { src: `${FONT_BASE}/fonts/NotoSansJP-Regular.ttf`, fontWeight: 400 },
    { src: `${FONT_BASE}/fonts/NotoSansJP-Bold.ttf`, fontWeight: 700 },
  ],
})

const isCJK = (t: string) => CLASSIC_CJK_RE.test(t)

const faceFor = (t: string, bold: boolean) =>
  isCJK(t)
    ? { fontFamily: 'NotoSansJP', fontWeight: (bold ? 700 : 400) as 700 | 400 }
    : { fontFamily: bold ? 'Helvetica-Bold' : 'Helvetica' }

const INCH = 72
const LABEL_W = 2.8 * INCH   // 201.6
const LABEL_H = 0.8 * INCH   // 57.6

/** Design units (1400 x 400) -> points. */
const u = (px: number) => (px / CLASSIC_PX.W) * LABEL_W

export interface ClassicInputs extends ClassicLineSource {
  serial: string
  /** Black DCM mark (or the org's front mark), same rule as Heritage. */
  blackLogoDataUrl?: string | null
  /** QR, error-correction H, built by the caller. */
  qrDataUrl?: string | null
  /** Verify URL printed under the cert serial; defaults to dcmgrading.com. */
  verifyUrl?: string | null
}

/** Pre-resolved lines, so a caller may override what classicLines() derives. */
export function classicInputLines(i: ClassicInputs): ClassicLines {
  return classicLines(i)
}

// ---------------------------------------------------------------------------
// Shared chrome
// ---------------------------------------------------------------------------

/**
 * Purple frame + white field + waves.
 *
 * Drawn entirely as CHILDREN so the block is safe inside a scale transform
 * (see the `bare` note at the top of the file). The waves are clipped to the
 * field, which is what keeps them off the frame and — on the back — out of the
 * QR's quiet zone.
 */
function ClassicFrame({ id }: { id: string }) {
  const f = classicField()
  return (
    <>
      <View style={{ position: 'absolute', left: 0, top: 0, width: LABEL_W, height: LABEL_H, backgroundColor: CLASSIC_PURPLE }} />
      <View style={{
        position: 'absolute', left: u(f.x), top: u(f.y), width: u(f.w), height: u(f.h),
        backgroundColor: CLASSIC_FIELD, borderRadius: u(f.r),
      }} />
      <Svg
        style={{ position: 'absolute', left: 0, top: 0, width: LABEL_W, height: LABEL_H }}
        viewBox={`0 0 ${CLASSIC_PX.W} ${CLASSIC_PX.H}`}
      >
        <Defs>
          <ClipPath id={`cfield-${id}`}>
            <Rect x={f.x} y={f.y} width={f.w} height={f.h} />
          </ClipPath>
        </Defs>
        <G clipPath={`url(#cfield-${id})`}>
          {classicWavePaths().map((d, i) => (
            <Path
              key={i}
              d={d}
              fill="none"
              stroke={CLASSIC_PURPLE}
              strokeOpacity={CLASSIC_PX.WAVE_OPACITY}
              strokeWidth={CLASSIC_PX.WAVE_WIDTH}
              strokeLinecap="round"
            />
          ))}
        </G>
      </Svg>
    </>
  )
}

/**
 * One line of type on a FIXED BASELINE.
 *
 * react-pdf lays a Text block out from its top edge, so every baseline in the
 * design is converted through classicBaselineTop (the font ascent rule). The
 * box is given generous width and `overflow: hidden` is never needed because
 * the fitter already guaranteed the row fits.
 */
function BaselineText({
  text, baseline, size, color, left, right, tracking = 0, bold = true,
}: {
  text: string
  baseline: number
  size: number
  color: string
  /** Left-aligned at this design x, OR right-aligned ending at `right`. */
  left?: number
  right?: number
  tracking?: number
  bold?: boolean
}) {
  if (!text) return null
  const top = classicBaselineTop(baseline, size, isCJK(text))
  const style = {
    ...faceFor(text, bold),
    fontSize: u(size),
    color,
    lineHeight: 1,
    letterSpacing: tracking ? u(tracking) : 0,
  } as const
  if (right !== undefined) {
    // Right-aligned inside a box that ends at `right`. letterSpacing is 0 on
    // the right column on purpose: react-pdf adds the spacing after the LAST
    // glyph too, which would nudge a right-aligned run off its edge, and the
    // column's widths are what the left column is fitted against.
    return (
      <View style={{ position: 'absolute', left: 0, top: u(top), width: u(right), alignItems: 'flex-end' }}>
        <Text style={style}>{text}</Text>
      </View>
    )
  }
  return (
    <View style={{ position: 'absolute', left: u(left ?? 0), top: u(top), width: u(CLASSIC_PX.W) }}>
      <Text style={style}>{text}</Text>
    </View>
  )
}

/** The DCM mark on its plate, bottom centre, straddling the frame. */
function ClassicPlate({ src }: { src?: string | null }) {
  const P = CLASSIC_PX
  return (
    <>
      <View style={{
        position: 'absolute', left: u(P.PLATE_X), top: u(P.PLATE_Y),
        width: u(P.PLATE_W), height: u(P.PLATE_H),
        backgroundColor: CLASSIC_FIELD, borderRadius: u(P.PLATE_R),
        borderWidth: u(P.PLATE_STROKE), borderColor: CLASSIC_PURPLE, borderStyle: 'solid',
      }} />
      {src ? (
        <View style={{
          position: 'absolute', left: u(P.MARK_X), top: u(P.MARK_Y),
          width: u(P.MARK_W), height: u(P.MARK_H),
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Image src={src} style={{ width: u(P.MARK_W), height: u(P.MARK_H), objectFit: 'contain' }} />
        </View>
      ) : null}
    </>
  )
}

const panelStyle = (bare: boolean) =>
  bare
    ? ({ width: LABEL_W, height: LABEL_H, position: 'relative' } as const)
    : ({ width: LABEL_W, height: LABEL_H, position: 'relative', backgroundColor: CLASSIC_PURPLE } as const)

// ---------------------------------------------------------------------------
// Front
// ---------------------------------------------------------------------------

export function ClassicFront({ i, bare = false, idSuffix = 'f' }: { i: ClassicInputs; bare?: boolean; idSuffix?: string }) {
  const P = CLASSIC_PX
  const lines = classicInputLines(i)
  const maxWidths = classicLeftMaxWidths(lines.right)
  const fit = fitClassicFront(lines.left, { maxWidths })

  return (
    <View style={panelStyle(bare)}>
      <ClassicFrame id={idSuffix} />

      {/* Left identification column — four fixed baselines, never wrapped,
          never allowed under the right column or the logo plate. */}
      {fit.rows.map((row, idx) => (
        <BaselineText
          key={`l${idx}`}
          text={row}
          baseline={P.LEFT_BASELINES[idx]}
          size={fit.sizes[idx]}
          color={CLASSIC_INK}
          left={P.LEFT_X}
          tracking={P.LEFT_TRACK}
        />
      ))}

      {/* Right grade column — right-aligned at RIGHT_X, fixed sizes. */}
      <BaselineText text={lines.right.number} baseline={P.NUM_BASELINE} size={P.NUM_SIZE} color={CLASSIC_INK} right={P.RIGHT_X} />
      <BaselineText text={lines.right.descriptor} baseline={P.DESC_BASELINE} size={P.DESC_SIZE} color={CLASSIC_PURPLE} right={P.RIGHT_X} />
      <BaselineText text={lines.right.grade} baseline={P.GRADE_BASELINE} size={P.GRADE_SIZE} color={CLASSIC_PURPLE} right={P.RIGHT_X} />
      <BaselineText text={lines.right.serial} baseline={P.SERIAL_BASELINE} size={P.SERIAL_SIZE} color={CLASSIC_INK} right={P.RIGHT_X} />

      <ClassicPlate src={i.blackLogoDataUrl} />
    </View>
  )
}

// ---------------------------------------------------------------------------
// Back
// ---------------------------------------------------------------------------

export function ClassicBack({ i, bare = false, idSuffix = 'b' }: { i: ClassicInputs; bare?: boolean; idSuffix?: string }) {
  const P = CLASSIC_PX
  const serial = i.serial || ''
  const verify = (i.verifyUrl || `dcmgrading.com/verify/${serial}`).replace(/^https?:\/\//, '')
  const back = fitClassicBack(serial, verify)
  const mark = classicBackMark()
  const plate = classicQrPlate()

  /** Centred on BACK_CENTER_X within the symmetric window the fitter solved. */
  const centred = (text: string, baseline: number, size: number, color: string, tracking: number, bold: boolean) => {
    if (!text) return null
    const top = classicBaselineTop(baseline, size, isCJK(text))
    return (
      <View style={{
        position: 'absolute', left: u(P.BACK_CENTER_X - back.half), top: u(top),
        width: u(back.half * 2), alignItems: 'center',
      }}>
        <Text style={{
          ...faceFor(text, bold), fontSize: u(size), color, lineHeight: 1,
          letterSpacing: tracking ? u(tracking) : 0,
        }}>
          {text}
        </Text>
      </View>
    )
  }

  return (
    <View style={panelStyle(bare)}>
      <ClassicFrame id={idSuffix} />

      {/* DCM mark, left, vertically centred. */}
      {i.blackLogoDataUrl ? (
        <View style={{ position: 'absolute', left: u(mark.x), top: u(mark.y), width: u(mark.w), height: u(mark.h), alignItems: 'center', justifyContent: 'center' }}>
          <Image src={i.blackLogoDataUrl} style={{ width: u(mark.w), height: u(mark.h), objectFit: 'contain' }} />
        </View>
      ) : null}

      {centred('DCM CERT', P.CERT_BASELINE, P.CERT_SIZE, CLASSIC_PURPLE, P.CERT_TRACK, true)}
      {centred(serial, P.BACK_SERIAL_BASELINE, back.serialSize, CLASSIC_INK, 0, true)}
      {centred(verify, P.VERIFY_BASELINE, back.urlSize, CLASSIC_INK_SOFT, 0, false)}

      {/* QR on a white plate, so the waves never touch the code. */}
      <View style={{ position: 'absolute', left: u(plate.x), top: u(plate.y), width: u(plate.w), height: u(plate.h), backgroundColor: CLASSIC_FIELD }} />
      {i.qrDataUrl ? (
        <Image src={i.qrDataUrl} style={{ position: 'absolute', left: u(P.QR_X), top: u(P.QR_Y), width: u(P.QR_BOX), height: u(P.QR_BOX) }} />
      ) : null}
    </View>
  )
}
