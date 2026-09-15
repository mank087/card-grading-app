'use client'

/**
 * Classic label ("Traditional", rebuilt Sept 2026) — shared SVG preview.
 *
 * The built-in `traditional` slab style is no longer the light gradient chip
 * label; it is the DCM classic grading label. The print PDF draws it from
 * labelLab/classicSlabPdfDoc, and this component redraws the SAME design from
 * the SAME shared source (labelLab/classicLayout) inside a 1400x400 viewBox,
 * so every web surface shows exactly what prints: same coordinates, same
 * fitting (classicLines / classicLeftMaxWidths / fitClassicFront /
 * fitClassicBack), same colours.
 *
 * API mirrors HeritageLabelPreview on purpose — the two are swapped for each
 * other all over the app (card pages, mockups, rasterizers).
 *
 * CUSTOM LABEL SLOTS ARE NOT AFFECTED: a saved custom-N config whose style is
 * 'traditional' keeps the old light design it was designed on. Only the
 * built-in id routes here — see labels/labelStyleResolution.isClassicSelection.
 */
import React, { useEffect, useId, useState } from 'react'
import type { SlabLabelData } from '@/lib/slabLabelGenerator'
import {
  CLASSIC_PX as PX,
  CLASSIC_PURPLE,
  CLASSIC_INK,
  CLASSIC_INK_SOFT,
  CLASSIC_FIELD,
  classicField,
  classicWavePaths,
  classicQrPlate,
  classicBackMark,
  classicLines,
  classicLeftMaxWidths,
  fitClassicFront,
  fitClassicBack,
} from '@/lib/labelLab/classicLayout'
import { designAspect, type OrgLabelDesign } from '@/lib/labels/orgLabelDesign'

/**
 * Same face stack HeritageLabelPreview uses: Helvetica/Arial for latin with
 * Noto Sans JP behind it, so a Japanese card name renders instead of dropping
 * to tofu. (The PDF picks the face explicitly; the browser falls through.)
 */
const FONT = 'Helvetica, Arial, "Noto Sans JP", sans-serif'

export interface ClassicLabelPreviewProps {
  /** Slab label row. Structured label fields (setName, year, designation, …) are honoured when present. */
  data: SlabLabelData
  side: 'front' | 'back'
  className?: string
  /**
   * DCM mark (or the org's mark). Defaults to the public path, which is right
   * for live DOM previews. Rasterization MUST pass a data: URL — browsers
   * refuse external subresources inside an SVG drawn as an image.
   */
  blackLogoHref?: string
  /** Back QR. Falls back to data.qrCodeDataUrl. */
  qrDataUrl?: string | null
  /** Verify URL printed under the cert serial; defaults to dcmgrading.com. */
  verifyUrl?: string | null
  /**
   * Rasterization mode: omit every nested <image>. Engines drop SVG-as-image
   * subresources when the SVG is drawn to a canvas, so the rasterizer
   * suppresses them here and composites the bitmaps natively.
   */
  suppressImages?: boolean
  /**
   * Physical aspect ratio (width/height) to stretch to. The design canvas is
   * 3.5:1 (2.8" x 0.8"); non-standard slots like Zion Mag Pro (3.30:1) mirror
   * the print pipeline's mild anisotropic scale. Absent = natural 3.5:1.
   */
  stretchAspect?: number
  /**
   * Enterprise org design document. Classic has no designer geometry — only
   * the slot aspect is honoured, so a Zion-targeted org design previews at
   * the size it prints. Accepted for API parity with HeritageLabelPreview.
   */
  design?: OrgLabelDesign | null
}

/** Purple frame + white field + the five clipped waves. */
function ClassicFrame({ uid }: { uid: string }) {
  const f = classicField()
  return (
    <>
      <rect x={0} y={0} width={PX.W} height={PX.H} fill={CLASSIC_PURPLE} />
      <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={f.r} ry={f.r} fill={CLASSIC_FIELD} />
      <defs>
        <clipPath id={`${uid}-field`}>
          <rect x={f.x} y={f.y} width={f.w} height={f.h} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${uid}-field)`}>
        {classicWavePaths().map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={CLASSIC_PURPLE}
            strokeOpacity={PX.WAVE_OPACITY}
            strokeWidth={PX.WAVE_WIDTH}
            strokeLinecap="round"
          />
        ))}
      </g>
    </>
  )
}

/**
 * One line of type on a FIXED BASELINE. SVG's default alphabetic baseline IS
 * the design baseline, so — unlike the PDF, which has to convert through the
 * font ascent (classicBaselineTop) — the y attribute is used as authored.
 */
function Line({
  text, baseline, size, fill, x, anchor = 'start', tracking = 0, bold = true,
}: {
  text: string
  baseline: number
  size: number
  fill: string
  x: number
  anchor?: 'start' | 'middle' | 'end'
  tracking?: number
  bold?: boolean
}) {
  if (!text) return null
  return (
    <text
      x={x}
      y={baseline}
      textAnchor={anchor}
      fontFamily={FONT}
      fontWeight={bold ? 700 : 400}
      fontSize={size}
      fill={fill}
      letterSpacing={tracking || undefined}
    >
      {text}
    </text>
  )
}

function FrontSide({ data, uid, blackLogoHref, suppressImages }: {
  data: ClassicLabelPreviewProps['data']; uid: string; blackLogoHref?: string; suppressImages?: boolean
}) {
  const lines = classicLines(data)
  const maxWidths = classicLeftMaxWidths(lines.right)
  const fit = fitClassicFront(lines.left, { maxWidths })

  return (
    <>
      <ClassicFrame uid={uid} />

      {/* Left identification column — four fixed baselines, never wrapped,
          never allowed under the right column or the logo plate. */}
      {fit.rows.map((row, i) => (
        <Line
          key={`l${i}`}
          text={row}
          baseline={PX.LEFT_BASELINES[i]}
          size={fit.sizes[i]}
          fill={CLASSIC_INK}
          x={PX.LEFT_X}
          tracking={PX.LEFT_TRACK}
        />
      ))}

      {/* Right grade column — right-aligned at RIGHT_X, fixed sizes, no tracking. */}
      <Line text={lines.right.number} baseline={PX.NUM_BASELINE} size={PX.NUM_SIZE} fill={CLASSIC_INK} x={PX.RIGHT_X} anchor="end" />
      <Line text={lines.right.descriptor} baseline={PX.DESC_BASELINE} size={PX.DESC_SIZE} fill={CLASSIC_PURPLE} x={PX.RIGHT_X} anchor="end" />
      <Line text={lines.right.grade} baseline={PX.GRADE_BASELINE} size={PX.GRADE_SIZE} fill={CLASSIC_PURPLE} x={PX.RIGHT_X} anchor="end" />
      <Line text={lines.right.serial} baseline={PX.SERIAL_BASELINE} size={PX.SERIAL_SIZE} fill={CLASSIC_INK} x={PX.RIGHT_X} anchor="end" />

      {/* Logo plate, bottom centre, straddling the frame. */}
      <rect
        x={PX.PLATE_X + PX.PLATE_STROKE / 2}
        y={PX.PLATE_Y + PX.PLATE_STROKE / 2}
        width={PX.PLATE_W - PX.PLATE_STROKE}
        height={PX.PLATE_H - PX.PLATE_STROKE}
        rx={PX.PLATE_R}
        ry={PX.PLATE_R}
        fill={CLASSIC_FIELD}
        stroke={CLASSIC_PURPLE}
        strokeWidth={PX.PLATE_STROKE}
      />
      {!suppressImages && blackLogoHref ? (
        <image
          href={blackLogoHref}
          x={PX.MARK_X}
          y={PX.MARK_Y}
          width={PX.MARK_W}
          height={PX.MARK_H}
          preserveAspectRatio="xMidYMid meet"
        />
      ) : null}
    </>
  )
}

function BackSide({ data, uid, blackLogoHref, qrDataUrl, verifyUrl, suppressImages }: {
  data: ClassicLabelPreviewProps['data']; uid: string; blackLogoHref?: string
  qrDataUrl?: string | null; verifyUrl?: string | null; suppressImages?: boolean
}) {
  const serial = data.serial || ''
  const verify = (verifyUrl || `dcmgrading.com/verify/${serial}`).replace(/^https?:\/\//, '')
  const back = fitClassicBack(serial, verify)
  const mark = classicBackMark()
  const plate = classicQrPlate()
  const qr = qrDataUrl || data.qrCodeDataUrl || ''

  return (
    <>
      <ClassicFrame uid={uid} />

      {/* DCM mark, left, vertically centred. */}
      {!suppressImages && blackLogoHref ? (
        <image
          href={blackLogoHref}
          x={mark.x}
          y={mark.y}
          width={mark.w}
          height={mark.h}
          preserveAspectRatio="xMidYMid meet"
        />
      ) : null}

      <Line text="DCM CERT" baseline={PX.CERT_BASELINE} size={PX.CERT_SIZE} fill={CLASSIC_PURPLE} x={PX.BACK_CENTER_X} anchor="middle" tracking={PX.CERT_TRACK} />
      <Line text={serial} baseline={PX.BACK_SERIAL_BASELINE} size={back.serialSize} fill={CLASSIC_INK} x={PX.BACK_CENTER_X} anchor="middle" />
      <Line text={verify} baseline={PX.VERIFY_BASELINE} size={back.urlSize} fill={CLASSIC_INK_SOFT} x={PX.BACK_CENTER_X} anchor="middle" bold={false} />

      {/* QR on a white plate, so the waves never touch the code. */}
      <rect x={plate.x} y={plate.y} width={plate.w} height={plate.h} fill={CLASSIC_FIELD} />
      {!suppressImages && qr ? (
        <image href={qr} x={PX.QR_X} y={PX.QR_Y} width={PX.QR_BOX} height={PX.QR_BOX} />
      ) : null}
    </>
  )
}

export function ClassicLabelPreview({
  data,
  side,
  className,
  blackLogoHref = '/DCM-logo-black.png',
  qrDataUrl = null,
  verifyUrl = null,
  suppressImages = false,
  stretchAspect,
  design = null,
}: ClassicLabelPreviewProps) {
  // Unique per instance: several previews render on one page (desktop slab,
  // hidden mobile block, gallery tile), and duplicated clip ids make url(#...)
  // resolve to the FIRST one in the document — if that copy sits in a
  // display:none subtree, Chromium paints nothing at all.
  const uid = 'c' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const aspect = stretchAspect ?? designAspect(design)
  return (
    <svg
      viewBox={`0 0 ${PX.W} ${PX.H}`}
      className={className}
      preserveAspectRatio={aspect ? 'none' : undefined}
      style={
        aspect
          ? { display: 'block', width: '100%', height: 'auto', aspectRatio: String(aspect) }
          : { display: 'block', width: '100%', height: 'auto' }
      }
      role="img"
      aria-label={`Classic label preview - ${side}`}
    >
      {side === 'front'
        ? <FrontSide data={data} uid={uid} blackLogoHref={blackLogoHref} suppressImages={suppressImages} />
        : <BackSide data={data} uid={uid} blackLogoHref={blackLogoHref} qrDataUrl={qrDataUrl} verifyUrl={verifyUrl} suppressImages={suppressImages} />}
    </svg>
  )
}

/**
 * QR for the Classic back, as a data URL.
 *
 * The back plate takes an <image>, not a live <QRCodeCanvas>, so every surface
 * that previews the back needs the same code the printed label carries:
 * error-correction H, 1-module quiet zone, drawn in the label's ink. Returns
 * '' until it resolves (the plate simply prints empty), and re-runs when the
 * target URL changes.
 */
export function useClassicQrDataUrl(url: string | null | undefined): string {
  const [dataUrl, setDataUrl] = useState('')
  useEffect(() => {
    if (!url) { setDataUrl(''); return }
    let cancelled = false
    import('qrcode')
      .then(q => q.default.toDataURL(url, {
        errorCorrectionLevel: 'H', margin: 1, width: 560,
        color: { dark: CLASSIC_INK, light: '#ffffff' },
      }))
      .then(u => { if (!cancelled) setDataUrl(u) })
      .catch(() => { if (!cancelled) setDataUrl('') })
    return () => { cancelled = true }
  }, [url])
  return dataUrl
}

export default ClassicLabelPreview
