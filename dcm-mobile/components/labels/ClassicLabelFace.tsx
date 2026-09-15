import { View, Text, Image, StyleSheet } from 'react-native'
import {
  CLASSIC_PX as PX,
  CLASSIC_PURPLE,
  CLASSIC_INK,
  CLASSIC_INK_SOFT,
  CLASSIC_FIELD,
  classicField,
  classicQrPlate,
  classicBackMark,
  classicLines,
  classicLeftMaxWidths,
  fitClassicFront,
  fitClassicBack,
  type ClassicLineSource,
} from '@/lib/labels/classicLayout'

/**
 * ClassicLabelFace — the DCM classic grading label ("Traditional", rebuilt
 * Sept 2026) drawn natively.
 *
 * Native mirror of the web SVG preview src/components/labels/
 * ClassicLabelPreview.tsx, sharing the geometry and text fitting through the
 * ported lib/labels/classicLayout.ts (see that file's header). Every value is
 * authored in the same 1400 x 400 design space and multiplied by `s = width /
 * 1400`, so the face is identical at a collection tile and at card-detail size.
 *
 * WHAT THE NATIVE FACE SKIPS: the five faint purple waves across the white
 * field. They are bezier strokes and the binary ships no react-native-svg;
 * at WAVE_OPACITY 0.045 they are a texture, not information, so the field is
 * drawn plain white rather than faked with straight bars. classicWavePaths()
 * is still ported, so a build that gains react-native-svg can draw them
 * without touching the layout.
 *
 * Used by components/grading/SlabCard.tsx (slab preview, collection grid) and
 * components/labels/LabelMockup.tsx (Label Studio holder mockups).
 */

export interface ClassicLabelFaceProps {
  /** Rendered width in px. Height is always width / 3.5. */
  width: number
  side?: 'front' | 'back'
  /** Everything classicLines() reads. */
  data: ClassicLineSource
  /** Back QR target; defaults to the verify URL for the serial. */
  qrUrl?: string | null
  /** Verify URL printed under the cert serial (scheme is stripped). */
  verifyUrl?: string | null
  /** Corner radii, e.g. the slab's top corners. */
  borderTopRadius?: number
  borderBottomRadius?: number
}

/** The design canvas is 2.8" x 0.8". */
export const CLASSIC_ASPECT = PX.W / PX.H

export function classicFaceHeight(width: number): number {
  return width / CLASSIC_ASPECT
}

/**
 * Baseline -> RN top.
 *
 * SVG anchors type on the alphabetic baseline; RN positions a line BOX. With
 * lineHeight = 1.2em the glyph baseline sits at roughly (leading/2 + ascent) =
 * 0.1 + 0.8 = 0.9em below the box top for the system sans on both platforms.
 * The extra 0.2em of leading (vs. a tight lineHeight = 1em) is what stops
 * Android clipping the tall numerals.
 */
const LINE_H = 1.2
const BASELINE_OFFSET = 0.9

/** One line of type on a FIXED BASELINE, positioned in design units. */
function ClassicText({
  text, baseline, size, color, s, left, width, align = 'left', tracking = 0, bold = true,
}: {
  text: string
  /** Design-unit baseline. */
  baseline: number
  /** Design-unit font size. */
  size: number
  color: string
  /** px per design unit. */
  s: number
  /** Design-unit left edge of the text box. */
  left: number
  /** Design-unit width of the text box. */
  width: number
  align?: 'left' | 'right' | 'center'
  tracking?: number
  bold?: boolean
}) {
  if (!text) return null
  const fs = size * s
  return (
    <Text
      // allowFontScaling off: the label is a fixed-geometry document, and the
      // device text-size setting would push rows into the grade column.
      allowFontScaling={false}
      numberOfLines={1}
      ellipsizeMode="clip"
      style={{
        position: 'absolute',
        left: left * s,
        top: baseline * s - fs * BASELINE_OFFSET,
        width: width * s,
        fontSize: fs,
        lineHeight: fs * LINE_H,
        // No fontFamily: the platform system sans covers CJK, so a Japanese
        // card name renders instead of dropping to tofu (same intent as the
        // web face's "Helvetica, Arial, Noto Sans JP" stack).
        fontWeight: bold ? '700' : '400',
        letterSpacing: tracking * s,
        color,
        textAlign: align,
        includeFontPadding: false,
      }}
    >
      {text}
    </Text>
  )
}

/** Purple frame + white field. (Waves intentionally omitted — see header.) */
function ClassicFrame({ s, width, height, borderTopRadius = 0, borderBottomRadius = 0 }: {
  s: number; width: number; height: number; borderTopRadius?: number; borderBottomRadius?: number
}) {
  const f = classicField()
  return (
    <>
      <View
        style={{
          position: 'absolute',
          left: 0, top: 0, width, height,
          backgroundColor: CLASSIC_PURPLE,
          borderTopLeftRadius: borderTopRadius,
          borderTopRightRadius: borderTopRadius,
          borderBottomLeftRadius: borderBottomRadius,
          borderBottomRightRadius: borderBottomRadius,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: f.x * s, top: f.y * s, width: f.w * s, height: f.h * s,
          backgroundColor: CLASSIC_FIELD,
          borderRadius: f.r * s,
        }}
      />
    </>
  )
}

/** QR as an image, same service the rest of the native slab surfaces use. */
function buildQrImageUrl(target: string, sizePx: number): string {
  const px = Math.max(40, Math.min(480, Math.round(sizePx)))
  return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(target)}&size=${px}x${px}&format=png&ecc=H&margin=0`
}

function ClassicFront({ s, data }: { s: number; data: ClassicLineSource }) {
  const lines = classicLines(data)
  const maxWidths = classicLeftMaxWidths(lines.right)
  const fit = fitClassicFront(lines.left, { maxWidths })

  return (
    <>
      {/* Left identification column — four fixed baselines, never wrapped,
          never allowed under the right column or the logo plate. */}
      {fit.rows.map((row, i) => (
        <ClassicText
          key={`l${i}`}
          text={row}
          baseline={PX.LEFT_BASELINES[i]}
          size={fit.sizes[i]}
          color={CLASSIC_INK}
          s={s}
          left={PX.LEFT_X}
          width={maxWidths[i]}
          tracking={PX.LEFT_TRACK}
        />
      ))}

      {/* Right grade column — right-aligned at RIGHT_X, fixed sizes. */}
      <ClassicText text={lines.right.number} baseline={PX.NUM_BASELINE} size={PX.NUM_SIZE} color={CLASSIC_INK} s={s} left={0} width={PX.RIGHT_X} align="right" />
      <ClassicText text={lines.right.descriptor} baseline={PX.DESC_BASELINE} size={PX.DESC_SIZE} color={CLASSIC_PURPLE} s={s} left={0} width={PX.RIGHT_X} align="right" />
      <ClassicText text={lines.right.grade} baseline={PX.GRADE_BASELINE} size={PX.GRADE_SIZE} color={CLASSIC_PURPLE} s={s} left={0} width={PX.RIGHT_X} align="right" />
      <ClassicText text={lines.right.serial} baseline={PX.SERIAL_BASELINE} size={PX.SERIAL_SIZE} color={CLASSIC_INK} s={s} left={0} width={PX.RIGHT_X} align="right" />

      {/* Logo plate, bottom centre, straddling the frame. RN draws borders
          INSIDE the box, so the plate uses the authored rect directly rather
          than the SVG's half-stroke inset. */}
      <View
        style={{
          position: 'absolute',
          left: PX.PLATE_X * s,
          top: PX.PLATE_Y * s,
          width: PX.PLATE_W * s,
          height: PX.PLATE_H * s,
          borderRadius: PX.PLATE_R * s,
          backgroundColor: CLASSIC_FIELD,
          borderWidth: Math.max(StyleSheet.hairlineWidth, PX.PLATE_STROKE * s),
          borderColor: CLASSIC_PURPLE,
        }}
      />
      <Image
        source={require('@/assets/images/dcm-logo.png')}
        style={{
          position: 'absolute',
          left: PX.MARK_X * s,
          top: PX.MARK_Y * s,
          width: PX.MARK_W * s,
          height: PX.MARK_H * s,
        }}
        resizeMode="contain"
        tintColor={CLASSIC_INK}
      />
    </>
  )
}

function ClassicBack({ s, data, qrUrl, verifyUrl }: {
  s: number; data: ClassicLineSource; qrUrl?: string | null; verifyUrl?: string | null
}) {
  const serial = (data.serial || '').trim()
  const verify = (verifyUrl || `dcmgrading.com/verify/${serial}`).replace(/^https?:\/\//, '')
  const back = fitClassicBack(serial, verify)
  const mark = classicBackMark()
  const plate = classicQrPlate()
  const qrTarget = qrUrl || (serial ? `https://dcmgrading.com/verify/${serial}` : '')

  return (
    <>
      {/* DCM mark, left, vertically centred. */}
      <Image
        source={require('@/assets/images/dcm-logo.png')}
        style={{ position: 'absolute', left: mark.x * s, top: mark.y * s, width: mark.w * s, height: mark.h * s }}
        resizeMode="contain"
        tintColor={CLASSIC_INK}
      />

      <ClassicText text="DCM CERT" baseline={PX.CERT_BASELINE} size={PX.CERT_SIZE} color={CLASSIC_PURPLE} s={s} left={PX.BACK_CENTER_X - back.half} width={back.half * 2} align="center" tracking={PX.CERT_TRACK} />
      <ClassicText text={serial} baseline={PX.BACK_SERIAL_BASELINE} size={back.serialSize} color={CLASSIC_INK} s={s} left={PX.BACK_CENTER_X - back.half} width={back.half * 2} align="center" />
      <ClassicText text={verify} baseline={PX.VERIFY_BASELINE} size={back.urlSize} color={CLASSIC_INK_SOFT} s={s} left={PX.BACK_CENTER_X - back.half} width={back.half * 2} align="center" bold={false} />

      {/* QR on a white plate. */}
      <View
        style={{
          position: 'absolute',
          left: plate.x * s, top: plate.y * s, width: plate.w * s, height: plate.h * s,
          backgroundColor: CLASSIC_FIELD,
        }}
      />
      {qrTarget ? (
        <Image
          source={{ uri: buildQrImageUrl(qrTarget, PX.QR_BOX * s * 2) }}
          style={{ position: 'absolute', left: PX.QR_X * s, top: PX.QR_Y * s, width: PX.QR_BOX * s, height: PX.QR_BOX * s }}
          resizeMode="contain"
        />
      ) : null}
    </>
  )
}

export default function ClassicLabelFace({
  width,
  side = 'front',
  data,
  qrUrl = null,
  verifyUrl = null,
  borderTopRadius = 0,
  borderBottomRadius = 0,
}: ClassicLabelFaceProps) {
  if (!(width > 0)) return null
  const s = width / PX.W
  const height = classicFaceHeight(width)

  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      <ClassicFrame s={s} width={width} height={height} borderTopRadius={borderTopRadius} borderBottomRadius={borderBottomRadius} />
      {side === 'front'
        ? <ClassicFront s={s} data={data} />
        : <ClassicBack s={s} data={data} qrUrl={qrUrl} verifyUrl={verifyUrl} />}
    </View>
  )
}
