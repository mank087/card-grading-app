/**
 * Vector slab label PDFs — PRODUCTION (Promotion 2 from the Label Lab,
 * June 2026, after the calibration-sheet paper test).
 *
 * Replaces the canvas-raster-into-jsPDF pipeline for SLAB labels with true
 * vector output: text stays crisp at any printer DPI instead of being
 * baked into a 300 DPI JPEG. Page geometry, headers, cut guides, duplex
 * mirroring, bleed, QR, emblems, and CJK-safe text all mirror the raster
 * generators 1:1 so the swap is invisible apart from sharper print.
 *
 * Callers don't use this module directly — slabLabelGenerator.ts and
 * customSlabLabelGenerator.ts try the vector path first and fall back to
 * their raster implementation if anything throws. Foldable/Avery/card-image
 * formats remain raster until they get the same lab validation.
 */

import React from 'react'
import { Document, Page, View, Text, Svg, Rect, Line, Path, Font } from '@react-pdf/renderer'

// Never hyphenate label text: react-pdf's default line breaker splits words
// with a hyphen ("Kurt Warn-\ner" on printed labels). Whole words only.
Font.registerHyphenationCallback((word) => [word])
import {
  CustomSlabLabelBlock,
  CustomSlabBackBlock,
  type SlabBackInputs,
} from '@/lib/labelLab/customSlabPdfBlock'
import { presetSpec, specFromCustomConfig, type LabStyleSpec } from '@/lib/labelLab/labStyleSpecs'
import { evaluateLabelBackground } from '@/lib/labelLab/contrastWCAG'
import type { SlabLabelInputs } from '@/lib/labelLab/slabLabelPdfDoc'
import type { SlabLabelData } from '@/lib/slabLabelGenerator'
import { configBackgroundStops, resolveConfigTextPolarity, type CustomLabelConfig } from '@/lib/labelPresets'
import {
  containsCJK,
  extractAsciiSafe,
  extractAsciiSafePreserveBullets,
} from '@/lib/labelDataGenerator'

// ------- Page geometry (identical to slabLabelGenerator.ts) -------

const INCH = 72
const LABEL_W = 2.8 * INCH      // 201.6
const LABEL_H = 0.8 * INCH      // 57.6
const BLEED = 0.08 * INCH       // 5.76
const CUT_MARGIN = 0.25 * INCH  // 18
const PAGE_W = 8.5 * INCH       // 612
const PAGE_H = 11 * INCH        // 792
const COLS = 2
const ROWS = 5
export const LABELS_PER_PAGE = COLS * ROWS
const CELL_W = LABEL_W + CUT_MARGIN * 2 // 237.6
const CELL_H = LABEL_H + CUT_MARGIN * 2 // 93.6
const GRID_START_X = (PAGE_W - COLS * CELL_W) / 2 // 68.4
const GRID_START_Y = (PAGE_H - ROWS * CELL_H) / 2 // 162
const SINGLE_X = (PAGE_W - LABEL_W) / 2
const SINGLE_Y = (PAGE_H - LABEL_H) / 2

function gridPos(index: number, mirrored: boolean): { x: number; y: number } {
  const col = index % COLS
  const row = Math.floor(index / COLS)
  const useCol = mirrored ? COLS - 1 - col : col
  return {
    x: GRID_START_X + useCol * CELL_W + CUT_MARGIN,
    y: GRID_START_Y + row * CELL_H + CUT_MARGIN,
  }
}

// ------- Data mapping (CJK-safe, grade formatting — mirrors raster) -------

function formatGrade(grade: number | null, isAlteredAuthentic?: boolean): string {
  if (grade !== null && grade !== undefined) return Math.round(grade).toString()
  return isAlteredAuthentic ? 'A' : 'N/A'
}

function mapFrontInputs(data: SlabLabelData): Omit<SlabLabelInputs, 'theme'> {
  const safeName = containsCJK(data.primaryName)
    ? extractAsciiSafe(data.primaryName, 'Card', data.englishName)
    : (data.primaryName || 'Card')
  const safeContext = containsCJK(data.contextLine)
    ? extractAsciiSafePreserveBullets(data.contextLine, '')
    : (data.contextLine || '')
  const rawFeatures = data.featuresLine || (data.features && data.features.length > 0 ? data.features.join(' • ') : '')
  const safeFeatures = rawFeatures && containsCJK(rawFeatures)
    ? extractAsciiSafePreserveBullets(rawFeatures, '')
    : rawFeatures
  const condition = data.isAlteredAuthentic && data.grade === null
    ? 'AUTHENTIC'
    : (data.condition || '')
  return {
    primaryName: safeName,
    contextLine: safeContext,
    featuresLine: safeFeatures || undefined,
    serial: data.serial,
    grade: formatGrade(data.grade, data.isAlteredAuthentic),
    condition,
    whiteLogoDataUrl: data.whiteLogoDataUrl || null,
    colorLogoDataUrl: data.logoDataUrl || null,
  }
}

function mapBackInputs(data: SlabLabelData): SlabBackInputs {
  return {
    grade: formatGrade(data.grade, data.isAlteredAuthentic),
    condition: data.isAlteredAuthentic && data.grade === null ? 'AUTHENTIC' : (data.condition || ''),
    qrCodeDataUrl: data.qrCodeDataUrl || null,
    subgrades: data.subScores,
    showFounderEmblem: data.showFounderEmblem,
    showVipEmblem: data.showVipEmblem,
    showCardLoversEmblem: data.showCardLoversEmblem,
  }
}

function specForStyle(style: 'modern' | 'traditional'): LabStyleSpec {
  const spec = presetSpec(style === 'traditional' ? 'traditional' : 'modern-dark')
  if (!spec) throw new Error('Missing preset spec for standard slab style')
  return spec
}

export function isStandardSlabDims(config: CustomLabelConfig): boolean {
  return Math.abs(config.width - 2.8) < 0.001 && Math.abs(config.height - 0.8) < 0.001
}

// ------- Halo routing gate -------

/** WCAG threshold below which the raster text halo is load-bearing. */
const HALO_CONTRAST_THRESHOLD = 4.5

/**
 * True when the resolved text color's WORST-CASE WCAG contrast against the
 * colors text actually sits on drops below 4.5:1. The raster path strokes
 * every text run with a 0.6-alpha black halo that keeps such styles legible
 * (rainbow, card-extension, mid-tone geometric); react-pdf cannot stroke
 * <Text>, so the generator call sites use these gates to keep those styles
 * on the raster path. Solid dark/light styles pass and stay vector.
 */
function stopsNeedTextHalo(stops: string[], discrete: boolean, textHex: string): boolean {
  const report = evaluateLabelBackground({ stops, textHex, discrete, threshold: HALO_CONTRAST_THRESHOLD })
  return report.minChosen < HALO_CONTRAST_THRESHOLD
}

/** Gate for the custom-config generators (single + batch). */
export function customConfigNeedsTextHalo(config: CustomLabelConfig): boolean {
  const { stops, discrete } = configBackgroundStops(config)
  // Same light/dark hex pair specFromCustomConfig resolves the text to.
  const textHex = resolveConfigTextPolarity(config) === 'light' ? '#ffffff' : '#1f2937'
  return stopsNeedTextHalo(stops, discrete, textHex)
}

/** Gate for the standard Modern/Traditional generators — same rule via the preset spec. */
export function standardStyleNeedsTextHalo(style: 'modern' | 'traditional'): boolean {
  const spec = specForStyle(style)
  return stopsNeedTextHalo(spec.contrastStops, spec.contrastDiscrete, spec.textColor)
}

// ------- Page chrome (headers, cut guides — mirrors raster drawing) -------

function PageHeader({
  pageType,
  pageNum,
  totalPages,
  variant,
  dims,
}: {
  pageType: 'front' | 'back'
  pageNum: number
  totalPages: number
  variant: 'standard' | 'custom'
  dims?: string
}) {
  if (variant === 'custom') {
    return (
      <View style={{ position: 'absolute', top: 33, left: 50, right: 50, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 7, color: '#9ca3af' }}>
          {pageType === 'front' ? 'FRONT' : 'BACK'} — Custom Label
        </Text>
        <Text style={{ fontSize: 7, color: '#9ca3af' }}>{dims || '2.8" × 0.8"'}</Text>
      </View>
    )
  }
  const instructions = pageType === 'front'
    ? 'Print duplex (flip on long edge) • Cut along dotted lines'
    : 'BACK SIDE • Print duplex (flip on long edge)'
  return (
    <View
      style={{
        position: 'absolute',
        top: GRID_START_Y - 19,
        left: GRID_START_X,
        width: PAGE_W - GRID_START_X * 2,
        flexDirection: 'row',
        justifyContent: 'space-between',
      }}
    >
      <Text style={{ fontSize: 7, color: '#9ca3af' }}>
        {pageType === 'front' ? 'FRONT' : 'BACK'} — Page {pageNum} of {totalPages}
      </Text>
      <Text style={{ fontSize: 7, color: '#9ca3af' }}>{instructions}</Text>
      <Text style={{ fontSize: 7, color: '#9ca3af' }}>Label: 2.8" × 0.8"</Text>
    </View>
  )
}

function CornerMarks({ x, y, color }: { x: number; y: number; color: string }) {
  const L = 8
  const lines: [number, number, number, number][] = [
    [x - L, y, x, y], [x, y - L, x, y],
    [x + LABEL_W, y, x + LABEL_W + L, y], [x + LABEL_W, y - L, x + LABEL_W, y],
    [x - L, y + LABEL_H, x, y + LABEL_H], [x, y + LABEL_H, x, y + LABEL_H + L],
    [x + LABEL_W, y + LABEL_H, x + LABEL_W + L, y + LABEL_H], [x + LABEL_W, y + LABEL_H, x + LABEL_W, y + LABEL_H + L],
  ]
  return (
    <>
      {lines.map((l, i) => (
        <Line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke={color} strokeWidth={0.5} />
      ))}
    </>
  )
}

function ScissorGlyph({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <Path
      d="M 0 -2 L 2 -4 M 0 2 L 2 4 M 1 0 L 7 0"
      stroke={color}
      strokeWidth={0.6}
      fill="none"
      transform={`translate(${x} ${y})`}
    />
  )
}

function FrontCutGuides({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <>
      <Rect
        x={x}
        y={y}
        width={LABEL_W}
        height={LABEL_H}
        fill="none"
        stroke={color}
        strokeWidth={0.5}
        strokeDasharray="3 3"
      />
      <ScissorGlyph x={x - 9} y={y + 2} color={color} />
      <ScissorGlyph x={x + LABEL_W + 2} y={y + 2} color={color} />
      <ScissorGlyph x={x - 9} y={y + LABEL_H + 2} color={color} />
      <ScissorGlyph x={x + LABEL_W + 2} y={y + LABEL_H + 2} color={color} />
      <CornerMarks x={x} y={y} color={color} />
    </>
  )
}

/** Full-page SVG layer for guides (one Svg per page keeps the tree small). */
function GuidesLayer({ children }: { children: React.ReactNode }) {
  return (
    <Svg
      style={{ position: 'absolute', top: 0, left: 0, width: PAGE_W, height: PAGE_H }}
      viewBox={`0 0 ${PAGE_W} ${PAGE_H}`}
    >
      {children}
    </Svg>
  )
}

function LabelAt({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <View style={{ position: 'absolute', left: x, top: y, width: LABEL_W, height: LABEL_H }}>
      {children}
    </View>
  )
}

// ------- Documents -------

interface VectorEntry {
  front: Omit<SlabLabelInputs, 'theme'>
  back: SlabBackInputs
}

function SlabVectorDoc({
  entries,
  spec,
  variant,
  guideColor,
}: {
  entries: VectorEntry[]
  spec: LabStyleSpec
  variant: 'standard' | 'custom'
  guideColor: string
}) {
  // Single label: centered layout (symmetric — works with any duplex setting)
  if (entries.length === 1) {
    const e = entries[0]
    return (
      <Document>
        <Page size="LETTER" style={{ backgroundColor: '#FFFFFF' }}>
          <PageHeader pageType="front" pageNum={1} totalPages={1} variant={variant} />
          <LabelAt x={SINGLE_X} y={SINGLE_Y}>
            <CustomSlabLabelBlock inputs={e.front} spec={spec} idSuffix="sf" bleedPt={BLEED} />
          </LabelAt>
          <GuidesLayer>
            <FrontCutGuides x={SINGLE_X} y={SINGLE_Y} color={guideColor} />
          </GuidesLayer>
        </Page>
        <Page size="LETTER" style={{ backgroundColor: '#FFFFFF' }}>
          <PageHeader pageType="back" pageNum={1} totalPages={1} variant={variant} />
          <LabelAt x={SINGLE_X} y={SINGLE_Y}>
            <CustomSlabBackBlock inputs={e.back} spec={spec} idSuffix="sb" bleedPt={BLEED} />
          </LabelAt>
          <GuidesLayer>
            <CornerMarks x={SINGLE_X} y={SINGLE_Y} color={guideColor} />
          </GuidesLayer>
        </Page>
      </Document>
    )
  }

  // Batch: 2×5 grid, duplex pairs (front sheet then X-mirrored back sheet)
  const totalSheets = Math.ceil(entries.length / LABELS_PER_PAGE)
  const pages: React.ReactElement[] = []
  for (let sheet = 0; sheet < totalSheets; sheet++) {
    const slice = entries.slice(sheet * LABELS_PER_PAGE, (sheet + 1) * LABELS_PER_PAGE)
    pages.push(
      <Page key={`f-${sheet}`} size="LETTER" style={{ backgroundColor: '#FFFFFF' }}>
        <PageHeader pageType="front" pageNum={sheet + 1} totalPages={totalSheets} variant={variant} />
        {slice.map((e, i) => {
          const { x, y } = gridPos(i, false)
          return (
            <LabelAt key={i} x={x} y={y}>
              <CustomSlabLabelBlock inputs={e.front} spec={spec} idSuffix={`f${sheet}-${i}`} bleedPt={BLEED} />
            </LabelAt>
          )
        })}
        <GuidesLayer>
          {slice.map((_, i) => {
            const { x, y } = gridPos(i, false)
            return <FrontCutGuides key={i} x={x} y={y} color={guideColor} />
          })}
        </GuidesLayer>
      </Page>,
    )
    pages.push(
      <Page key={`b-${sheet}`} size="LETTER" style={{ backgroundColor: '#FFFFFF' }}>
        <PageHeader pageType="back" pageNum={sheet + 1} totalPages={totalSheets} variant={variant} />
        {slice.map((e, i) => {
          const { x, y } = gridPos(i, true)
          return (
            <LabelAt key={i} x={x} y={y}>
              <CustomSlabBackBlock inputs={e.back} spec={spec} idSuffix={`b${sheet}-${i}`} bleedPt={BLEED} />
            </LabelAt>
          )
        })}
        <GuidesLayer>
          {slice.map((_, i) => {
            const { x, y } = gridPos(i, true)
            return <CornerMarks key={i} x={x} y={y} color={guideColor} />
          })}
        </GuidesLayer>
      </Page>,
    )
  }
  return <Document>{pages}</Document>
}

// ------- Fold-over (vector) -------
//
// Geometry mirrors the raster fold-over (slabLabelGenerator
// generateFoldOverSlabLabel): BACK panel on top rotated 180°, FRONT below,
// flush at the fold seam. The blocks paint bleed on every side, so each panel
// is wrapped in an overflow-hidden box that keeps bleed on its three OUTER
// edges and crops the fold side — the vector equivalent of the raster path's
// cropBleedEdge (uncropped fold-side bleed would paint over the other panel).

const FOLD_H = LABEL_H * 2

function FoldPanel({
  x, y, cropEdge, children,
}: { x: number; y: number; cropEdge: 'top' | 'bottom'; children: React.ReactNode }) {
  return (
    <View
      style={{
        position: 'absolute',
        left: x - BLEED,
        top: cropEdge === 'bottom' ? y - BLEED : y,
        width: LABEL_W + BLEED * 2,
        height: LABEL_H + BLEED,
        overflow: 'hidden',
      }}
    >
      <View style={{ position: 'absolute', left: BLEED, top: cropEdge === 'bottom' ? BLEED : 0, width: LABEL_W, height: LABEL_H }}>
        {children}
      </View>
    </View>
  )
}

/** Dashed cut outline around the fold pair + grey fold ticks at the seam. */
function FoldCutGuides({ x, y, color }: { x: number; y: number; color: string }) {
  const foldY = y + LABEL_H
  return (
    <>
      <Rect x={x} y={y} width={LABEL_W} height={FOLD_H} fill="none" stroke={color} strokeWidth={0.5} strokeDasharray="3 3" />
      <Line x1={x - 16} y1={foldY} x2={x - 4} y2={foldY} stroke="#bbbbbb" strokeWidth={0.8} />
      <Line x1={x + LABEL_W + 4} y1={foldY} x2={x + LABEL_W + 16} y2={foldY} stroke="#bbbbbb" strokeWidth={0.8} />
      <ScissorGlyph x={x - 9} y={y + 2} color={color} />
      <ScissorGlyph x={x + LABEL_W + 2} y={y + 2} color={color} />
    </>
  )
}

// Fold-over batch grid — same cell math as the raster generateBatchFoldOverSlabLabels.
const FOLD_ROW_MARGIN = 0.15 * INCH
const FOLD_COL_MARGIN = 0.2 * INCH
const FOLD_CELL_W = LABEL_W + FOLD_COL_MARGIN
const FOLD_CELL_H = FOLD_H + FOLD_ROW_MARGIN
const FOLD_COLS = 2
const FOLD_ROWS = Math.floor((PAGE_H - 1 * INCH) / FOLD_CELL_H)
export const FOLD_PER_PAGE = FOLD_COLS * FOLD_ROWS
const FOLD_GRID_X = (PAGE_W - FOLD_COLS * FOLD_CELL_W + FOLD_COL_MARGIN) / 2
const FOLD_GRID_Y = (PAGE_H - FOLD_ROWS * FOLD_CELL_H + FOLD_ROW_MARGIN) / 2

function FoldPairAt({ e, spec, x, y, idSuffix }: { e: VectorEntry; spec: LabStyleSpec; x: number; y: number; idSuffix: string }) {
  return (
    <>
      <FoldPanel x={x} y={y} cropEdge="bottom">
        <View style={{ width: LABEL_W, height: LABEL_H, transform: 'rotate(180deg)' }}>
          <CustomSlabBackBlock inputs={e.back} spec={spec} idSuffix={`${idSuffix}b`} bleedPt={BLEED} />
        </View>
      </FoldPanel>
      <FoldPanel x={x} y={y + LABEL_H} cropEdge="top">
        <CustomSlabLabelBlock inputs={e.front} spec={spec} idSuffix={`${idSuffix}f`} bleedPt={BLEED} />
      </FoldPanel>
    </>
  )
}

function SlabFoldOverDoc({
  entries, spec, guideColor,
}: { entries: VectorEntry[]; spec: LabStyleSpec; guideColor: string }) {
  // Single label: centered pair.
  if (entries.length === 1) {
    const x = (PAGE_W - LABEL_W) / 2
    const y = (PAGE_H - FOLD_H) / 2
    return (
      <Document>
        <Page size="LETTER" style={{ backgroundColor: '#FFFFFF' }}>
          <PageHeader pageType="front" pageNum={1} totalPages={1} variant="custom" dims={'2.8" × 1.6" fold-over'} />
          <FoldPairAt e={entries[0]} spec={spec} x={x} y={y} idSuffix="fo" />
          <GuidesLayer>
            <FoldCutGuides x={x} y={y} color={guideColor} />
          </GuidesLayer>
          <Text style={{ position: 'absolute', left: x, top: y + FOLD_H + 8, fontSize: 7, color: '#9ca3af' }}>
            2.8&quot; × 1.6&quot; total — fold top panel behind front
          </Text>
        </Page>
      </Document>
    )
  }
  // Batch: 2-column fold grid, single-sided pages.
  const totalSheets = Math.ceil(entries.length / FOLD_PER_PAGE)
  const pages: React.ReactElement[] = []
  for (let sheet = 0; sheet < totalSheets; sheet++) {
    const slice = entries.slice(sheet * FOLD_PER_PAGE, (sheet + 1) * FOLD_PER_PAGE)
    pages.push(
      <Page key={sheet} size="LETTER" style={{ backgroundColor: '#FFFFFF' }}>
        <PageHeader pageType="front" pageNum={sheet + 1} totalPages={totalSheets} variant="custom" dims={'2.8" × 1.6" fold-over'} />
        {slice.map((e, i) => {
          const x = FOLD_GRID_X + (i % FOLD_COLS) * FOLD_CELL_W
          const y = FOLD_GRID_Y + Math.floor(i / FOLD_COLS) * FOLD_CELL_H
          return <FoldPairAt key={i} e={e} spec={spec} x={x} y={y} idSuffix={`fo${sheet}-${i}`} />
        })}
        <GuidesLayer>
          {slice.map((_, i) => {
            const x = FOLD_GRID_X + (i % FOLD_COLS) * FOLD_CELL_W
            const y = FOLD_GRID_Y + Math.floor(i / FOLD_COLS) * FOLD_CELL_H
            return <FoldCutGuides key={i} x={x} y={y} color={guideColor} />
          })}
        </GuidesLayer>
      </Page>,
    )
  }
  return <Document>{pages}</Document>
}

/** Standard slab fold-over (Modern/Traditional), single label, one page. */
export async function generateFoldOverSlabLabelVector(
  data: SlabLabelData,
  style: 'modern' | 'traditional',
): Promise<Blob> {
  const spec = specForStyle(style)
  const guideColor = style === 'modern' ? '#999999' : '#000000'
  const entries = [{ front: mapFrontInputs(data), back: mapBackInputs(data) }]
  return renderDocToBlob(
    <SlabFoldOverDoc entries={entries} spec={spec} guideColor={guideColor} />,
  )
}

/** Standard slab fold-over batch — single-sided fold grid. */
export async function generateBatchFoldOverSlabLabelsVector(
  dataArray: SlabLabelData[],
  style: 'modern' | 'traditional',
): Promise<Blob> {
  const spec = specForStyle(style)
  const guideColor = style === 'modern' ? '#999999' : '#000000'
  const entries = dataArray.map(d => ({ front: mapFrontInputs(d), back: mapBackInputs(d) }))
  return renderDocToBlob(
    <SlabFoldOverDoc entries={entries} spec={spec} guideColor={guideColor} />,
  )
}

// ------- Public generators -------

// Page chrome + geometry shared with the Heritage generator
// (labels/heritageSlabGenerator), so all slab styles print with identical
// sheets, guides, and duplex behaviour.
export { PageHeader, CornerMarks, FrontCutGuides, GuidesLayer, LabelAt, gridPos, SINGLE_X, SINGLE_Y }

async function renderDocToBlob(doc: React.ReactElement): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer')
  return pdf(doc as any).toBlob()
}

/** Standard slab (Modern/Traditional), single label, front + back. */
export async function generateSlabLabelVector(
  data: SlabLabelData,
  style: 'modern' | 'traditional',
): Promise<Blob> {
  const spec = specForStyle(style)
  const guideColor = style === 'modern' ? '#ffffff' : '#000000'
  const entries = [{ front: mapFrontInputs(data), back: mapBackInputs(data) }]
  return renderDocToBlob(
    <SlabVectorDoc entries={entries} spec={spec} variant="standard" guideColor={guideColor} />,
  )
}

/** Standard slab batch — 2×5 duplex sheets with mirrored backs. */
export async function generateBatchSlabLabelsVector(
  dataArray: SlabLabelData[],
  style: 'modern' | 'traditional',
): Promise<Blob> {
  const spec = specForStyle(style)
  const guideColor = style === 'modern' ? '#ffffff' : '#000000'
  const entries = dataArray.map(d => ({ front: mapFrontInputs(d), back: mapBackInputs(d) }))
  return renderDocToBlob(
    <SlabVectorDoc entries={entries} spec={spec} variant="standard" guideColor={guideColor} />,
  )
}

/**
 * Custom-style slab, single label. Throws for non-standard dimensions —
 * the caller falls back to the raster path (vector geometry is validated
 * for 2.8" × 0.8" only).
 */
export async function generateCustomSlabLabelVector(
  data: SlabLabelData,
  config: CustomLabelConfig,
): Promise<Blob> {
  if (!isStandardSlabDims(config)) {
    throw new Error('Vector slab path supports standard 2.8x0.8 dimensions only')
  }
  const spec = specFromCustomConfig(config)
  const guideColor = config.style === 'modern' ? '#ffffff' : '#000000'
  const entries = [{ front: mapFrontInputs(data), back: mapBackInputs(data) }]
  return renderDocToBlob(
    <SlabVectorDoc entries={entries} spec={spec} variant="custom" guideColor={guideColor} />,
  )
}

/** Custom-style slab batch (batch always uses standard dimensions). */
export async function generateBatchCustomSlabLabelsVector(
  dataArray: SlabLabelData[],
  config: CustomLabelConfig,
): Promise<Blob> {
  const spec = specFromCustomConfig({ ...config, width: 2.8, height: 0.8 })
  const guideColor = config.style === 'modern' ? '#ffffff' : '#000000'
  const entries = dataArray.map(d => ({ front: mapFrontInputs(d), back: mapBackInputs(d) }))
  return renderDocToBlob(
    <SlabVectorDoc entries={entries} spec={spec} variant="custom" guideColor={guideColor} />,
  )
}