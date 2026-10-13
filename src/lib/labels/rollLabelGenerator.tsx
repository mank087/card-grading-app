/**
 * Slab labels for ROLL label printers (Oct 2026).
 *
 * Every other slab PDF is an 8.5" × 11" letter sheet. A roll printer (the
 * customer case: iDPRT SP320, 203 dpi direct thermal, 3" × 1" die-cut rolls)
 * treats the whole letter page as ONE label and shrinks it to fit, so the
 * slab label came out at ~20% size. This module emits a PDF in which every
 * page IS one roll label:
 *
 *   '3x1'     — page 3" × 1" (216 × 72 pt); the slab label is drawn at its
 *               TRUE 2.8" × 0.8" size, centred (0.1" margin each side), with
 *               small trim ticks in the margin.
 *   '2.8x0.8' — page exactly the slab label (201.6 × 57.6 pt), no margin, for
 *               rolls that already match the slab insert.
 *
 * Page order: for each card, its front page then its back page (styles
 * without a back emit only the front). Labels are drawn by the same blocks the
 * letter-sheet generators use (CustomSlabLabelBlock / ClassicFront /
 * HeritageFront …) at native size — never scaled, so the react-pdf
 * scale-transform gotcha (heritageSlabGenerator ScaledPanel) cannot apply.
 *
 * `mono` (default on in the UI): black-on-white for black-only direct-thermal
 * heads. Colour fields and tints only print as dither speckle at 203 dpi.
 * Vector inks become pure black in every style. Raster marks cannot be
 * filtered (@react-pdf has no image filter support), so the front mark is
 * swapped for the BLACK DCM mark (or the caller's org mark via logoBlack); the
 * QR codes are already black-on-white.
 */
import React from 'react'
import { Document, Page, View, Svg, Line, pdf } from '@react-pdf/renderer'
import { CustomSlabLabelBlock, CustomSlabBackBlock } from '@/lib/labelLab/customSlabPdfBlock'
import { specFromCustomConfig } from '@/lib/labelLab/labStyleSpecs'
import { ClassicFront, ClassicBack } from '@/lib/labelLab/classicSlabPdfDoc'
import { HeritageFront, HeritageBack, heritageChip, type HeritageInputs, type BandPattern } from '@/lib/labelLab/heritageSlabPdfDoc'
import {
  mapFrontInputs,
  mapBackInputs,
  specForStyle,
  buildClassicBatch,
  type ClassicRenderOptions,
} from '@/lib/labels/vectorSlabGenerator'
import { buildBatchInputs, type HeritageBatchItem } from '@/lib/labels/heritageSlabGenerator'
import {
  rollPageGeometry,
  readStoredRollOffset,
  DEFAULT_ROLL_SIZE,
  type RollOffsetMm,
  type RollSize,
  type RollOptions,
  type RollPageGeometry,
} from '@/lib/labels/rollLabelPrefs'
import type { SlabLabelData } from '@/lib/slabLabelGenerator'
import type { CustomLabelConfig } from '@/lib/labelPresets'

export * from '@/lib/labels/rollLabelPrefs'

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export interface RollLabel {
  key: string
  front: React.ReactNode
  /** Absent/null for a style with no back — only the front page is emitted. */
  back?: React.ReactNode | null
}

/** Short black ticks in the page margin at each label corner (3 × 1 only). */
function TrimTicks({ g }: { g: RollPageGeometry }) {
  const gap = 1.5
  const len = Math.min(5, g.labelX - gap - 0.5, g.labelY - gap - 0.5)
  if (len <= 0.5) return null
  const x0 = g.labelX, x1 = g.labelX + g.labelW
  const y0 = g.labelY, y1 = g.labelY + g.labelH
  const lines: [number, number, number, number][] = [
    [x0 - gap - len, y0, x0 - gap, y0], [x0, y0 - gap - len, x0, y0 - gap],
    [x1 + gap, y0, x1 + gap + len, y0], [x1, y0 - gap - len, x1, y0 - gap],
    [x0 - gap - len, y1, x0 - gap, y1], [x0, y1 + gap, x0, y1 + gap + len],
    [x1 + gap, y1, x1 + gap + len, y1], [x1, y1 + gap, x1, y1 + gap + len],
  ]
  return (
    <Svg style={{ position: 'absolute', left: 0, top: 0, width: g.pageW, height: g.pageH }} viewBox={`0 0 ${g.pageW} ${g.pageH}`}>
      {lines.map((l, i) => (
        <Line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke="#000000" strokeWidth={0.5} />
      ))}
    </Svg>
  )
}

function RollPage({ g, children }: { g: RollPageGeometry; children: React.ReactNode }) {
  const hasMargin = g.labelX > 0.01 || g.labelY > 0.01
  return (
    // size as {width, height} with NO orientation prop: react-pdf only swaps
    // the axes for orientation="landscape", so this page is 3" wide × 1" tall
    // exactly as the roll feeds. Do NOT add wrap={false}: on a <Page> it
    // makes react-pdf size the page height to its content (all absolute here,
    // so the page collapses to 0 pt tall).
    <Page size={{ width: g.pageW, height: g.pageH }} style={{ backgroundColor: '#FFFFFF' }}>
      <View
        style={{ position: 'absolute', left: g.labelX, top: g.labelY, width: g.labelW, height: g.labelH, overflow: 'hidden' }}
      >
        {children}
      </View>
      {hasMargin ? <TrimTicks g={g} /> : null}
    </Page>
  )
}

/** One label per page: card 1 front, card 1 back, card 2 front, … */
export function RollLabelDoc({ labels, size = DEFAULT_ROLL_SIZE, offsetMm }: { labels: RollLabel[]; size?: RollSize; offsetMm?: RollOffsetMm }) {
  // The owner's saved position nudge (browser only; 0/0 on the server and in tests).
  const g = rollPageGeometry(size, offsetMm ?? readStoredRollOffset())
  const pages: React.ReactElement[] = []
  for (const l of labels) {
    pages.push(<RollPage key={`${l.key}-f`} g={g}>{l.front}</RollPage>)
    if (l.back) pages.push(<RollPage key={`${l.key}-b`} g={g}>{l.back}</RollPage>)
  }
  return <Document>{pages}</Document>
}

// ---------------------------------------------------------------------------
// Style builders (node-safe — return the react-pdf element)
// ---------------------------------------------------------------------------

/**
 * The black front mark for a thermal print: the caller's (org) black mark
 * when given, else the black DCM mark. null when nothing loads — the block
 * then keeps whatever mark the data carried.
 */
async function resolveBlackMark(logoBlack: string | null | undefined): Promise<string | null> {
  if (logoBlack !== undefined) return logoBlack
  try {
    const { loadBlackLogoAsBase64 } = await import('@/lib/foldableLabelGenerator')
    return await loadBlackLogoAsBase64()
  } catch {
    return null
  }
}

/** Modern / Traditional (Traditional = the Classic label, as on the letter sheets). */
export async function buildRollSlabLabelsDoc(
  dataArray: SlabLabelData[],
  style: 'modern' | 'traditional',
  opts: RollOptions & ClassicRenderOptions = {},
): Promise<React.ReactElement> {
  const mono = opts.mono ?? true
  if (style === 'traditional') {
    const entries = await buildClassicBatch(dataArray, opts)
    const labels: RollLabel[] = entries.map((i, n) => ({
      key: `c${n}`,
      front: <ClassicFront i={i} idSuffix={`rf${n}`} mono={mono} />,
      back: <ClassicBack i={i} idSuffix={`rb${n}`} mono={mono} />,
    }))
    return <RollLabelDoc labels={labels} size={opts.size} />
  }
  const spec = specForStyle(style)
  const black = mono ? await resolveBlackMark(opts.logoBlack) : null
  const labels: RollLabel[] = dataArray.map((d, n) => {
    const front = mapFrontInputs(d)
    return {
      key: `m${n}`,
      front: (
        <CustomSlabLabelBlock
          inputs={mono && black ? { ...front, colorLogoDataUrl: black } : front}
          spec={spec}
          idSuffix={`rf${n}`}
          mono={mono}
        />
      ),
      back: <CustomSlabBackBlock inputs={mapBackInputs(d)} spec={spec} idSuffix={`rb${n}`} mono={mono} />,
    }
  })
  return <RollLabelDoc labels={labels} size={opts.size} />
}

/**
 * Saved custom style (non-heritage). Always drawn at the standard 2.8" × 0.8"
 * like the vector batch; the roll output is the slab insert size.
 */
export async function buildRollCustomSlabLabelsDoc(
  dataArray: SlabLabelData[],
  config: CustomLabelConfig,
  opts: RollOptions & { logoBlack?: string | null } = {},
): Promise<React.ReactElement> {
  const mono = opts.mono ?? true
  const spec = specFromCustomConfig({ ...config, width: 2.8, height: 0.8 })
  const black = mono ? await resolveBlackMark(opts.logoBlack) : null
  const labels: RollLabel[] = dataArray.map((d, n) => {
    const front = mapFrontInputs(d)
    return {
      key: `x${n}`,
      front: (
        <CustomSlabLabelBlock
          inputs={mono && black ? { ...front, colorLogoDataUrl: black } : front}
          spec={spec}
          idSuffix={`rf${n}`}
          mono={mono}
        />
      ),
      back: <CustomSlabBackBlock inputs={mapBackInputs(d)} spec={spec} idSuffix={`rb${n}`} mono={mono} />,
    }
  })
  return <RollLabelDoc labels={labels} size={opts.size} />
}

/**
 * Heritage (built-in or a saved heritage custom style). Drawn at the standard
 * 2.8" × 0.8"; a non-standard org design size (Zion Mag Pro) is not offered on
 * roll output — roll labels are the slab insert size.
 */
export async function buildRollHeritageLabelsDoc(
  items: HeritageBatchItem[],
  pattern: BandPattern,
  gradeColors?: Record<string, string> | null,
  opts: RollOptions = {},
): Promise<React.ReactElement> {
  const mono = opts.mono ?? true
  const built = await buildBatchInputs(items, pattern, gradeColors)
  const entries: HeritageInputs[] = mono
    ? built.map(i => ({
        ...i,
        mono: true,
        // The back's QR-centre disc reads colorLogoDataUrl; use the black mark.
        colorLogoDataUrl: i.blackLogoDataUrl ?? i.colorLogoDataUrl,
        logoColor: 'black',
      }))
    : built
  const labels: RollLabel[] = entries.map((i, n) => {
    const chip = heritageChip(i)
    return {
      key: `h${n}`,
      front: <HeritageFront i={i} chip={chip} />,
      back: <HeritageBack i={i} chip={chip} />,
    }
  })
  return <RollLabelDoc labels={labels} size={opts.size} />
}

// ---------------------------------------------------------------------------
// Browser helpers
// ---------------------------------------------------------------------------

export async function rollDocToBlob(doc: React.ReactElement): Promise<Blob> {
  return pdf(doc as any).toBlob()
}

export function rollFilename(base: string, size: RollSize = DEFAULT_ROLL_SIZE): string {
  return `${base}-Roll-${size}.pdf`
}

export function downloadRollBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
