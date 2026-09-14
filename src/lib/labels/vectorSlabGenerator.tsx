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
import { ClassicFront, ClassicBack, type ClassicInputs } from '@/lib/labelLab/classicSlabPdfDoc'
import { CLASSIC_PURPLE } from '@/lib/labelLab/classicLayout'
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
//
// Sheet geometry (grid, cell pitch, margins) now lives in labels/sheetGeometry
// so the 10-per-sheet and 20-per-sheet layouts share one implementation. The
// constants below stay for the single-label and fold-over layouts, which the
// density option does not touch.

import {
  resolveSheetGeometry,
  labelPos,
  STANDARD_SLAB_GEOMETRY,
  type SheetGeometry,
  type SheetDensity,
} from '@/lib/labels/sheetGeometry'

const INCH = 72
const LABEL_W = 2.8 * INCH      // 201.6
const LABEL_H = 0.8 * INCH      // 57.6
const BLEED = 0.08 * INCH       // 5.76
const CUT_MARGIN = 0.25 * INCH  // 18
const PAGE_W = 8.5 * INCH       // 612
const PAGE_H = 11 * INCH        // 792
/** Standard sheet capacity (10). Dense sheets read geometry.labelsPerPage. */
export const LABELS_PER_PAGE = STANDARD_SLAB_GEOMETRY.labelsPerPage
const SINGLE_X = (PAGE_W - LABEL_W) / 2
const SINGLE_Y = (PAGE_H - LABEL_H) / 2

/**
 * Grid position of a label. `geometry` defaults to the standard 2.8" × 0.8"
 * 2×5 sheet, so every existing caller (including heritageSlabGenerator) keeps
 * the exact positions it always had.
 */
function gridPos(
  index: number,
  mirrored: boolean,
  geometry: SheetGeometry = STANDARD_SLAB_GEOMETRY,
): { x: number; y: number } {
  return labelPos(geometry, index, mirrored)
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
    // Enterprise mark size (Brand Setup); the PDF caps it against the label.
    logoScale: data.logoScale,
  }
}

function mapBackInputs(data: SlabLabelData): SlabBackInputs {
  return {
    grade: formatGrade(data.grade, data.isAlteredAuthentic),
    condition: data.isAlteredAuthentic && data.grade === null ? 'AUTHENTIC' : (data.condition || ''),
    serial: data.serial || null,
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
  geometry = STANDARD_SLAB_GEOMETRY,
}: {
  pageType: 'front' | 'back'
  pageNum: number
  totalPages: number
  variant: 'standard' | 'custom'
  dims?: string
  geometry?: SheetGeometry
}) {
  if (variant === 'custom') {
    return (
      <View style={{ position: 'absolute', top: 33, left: 50, right: 50, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 7, color: '#9ca3af' }}>
          {pageType === 'front' ? 'FRONT' : 'BACK'} — Custom Label
        </Text>
        <Text style={{ fontSize: 7, color: '#9ca3af' }}>{dims || geometry.summary}</Text>
      </View>
    )
  }
  const instructions = pageType === 'front'
    ? 'Print duplex (flip on long edge) • Cut along dotted lines'
    : 'BACK SIDE • Print duplex (flip on long edge)'
  // Standard sheets keep their historic header position and wording so the
  // 10-up PDF is byte-identical to what shipped before the density option.
  // Dense sheets have only 3/8" of paper above the first label, so the header
  // rides just under the page edge and carries the full geometry summary
  // ("20 per sheet · …") — the owner needs to see which sheet they printed.
  const isStandardSheet = geometry.density === 'standard'
  const headerTop = isStandardSheet
    ? geometry.gridStartY - 19
    : Math.max(8, geometry.firstLabelY - 19)
  const dimsText = isStandardSheet ? 'Label: 2.8" × 0.8"' : geometry.summary
  return (
    <View
      style={{
        position: 'absolute',
        top: headerTop,
        left: geometry.gridStartX,
        width: PAGE_W - geometry.gridStartX * 2,
        flexDirection: 'row',
        justifyContent: 'space-between',
      }}
    >
      <Text style={{ fontSize: 7, color: '#9ca3af' }}>
        {pageType === 'front' ? 'FRONT' : 'BACK'} — Page {pageNum} of {totalPages}
      </Text>
      <Text style={{ fontSize: 7, color: '#9ca3af' }}>{instructions}</Text>
      <Text style={{ fontSize: 7, color: '#9ca3af' }}>{dimsText}</Text>
    </View>
  )
}

function CornerMarks({
  x, y, color, w = LABEL_W, h = LABEL_H,
}: { x: number; y: number; color: string; w?: number; h?: number }) {
  const L = 8
  const lines: [number, number, number, number][] = [
    [x - L, y, x, y], [x, y - L, x, y],
    [x + w, y, x + w + L, y], [x + w, y - L, x + w, y],
    [x - L, y + h, x, y + h], [x, y + h, x, y + h + L],
    [x + w, y + h, x + w + L, y + h], [x + w, y + h, x + w, y + h + L],
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

function FrontCutGuides({
  x, y, color, w = LABEL_W, h = LABEL_H,
}: { x: number; y: number; color: string; w?: number; h?: number }) {
  return (
    <>
      <Rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="none"
        stroke={color}
        strokeWidth={0.5}
        strokeDasharray="3 3"
      />
      <ScissorGlyph x={x - 9} y={y + 2} color={color} />
      <ScissorGlyph x={x + w + 2} y={y + 2} color={color} />
      <ScissorGlyph x={x - 9} y={y + h + 2} color={color} />
      <ScissorGlyph x={x + w + 2} y={y + h + 2} color={color} />
      <CornerMarks x={x} y={y} color={color} w={w} h={h} />
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

function LabelAt({
  x, y, children, w = LABEL_W, h = LABEL_H,
}: { x: number; y: number; children: React.ReactNode; w?: number; h?: number }) {
  return (
    <View style={{ position: 'absolute', left: x, top: y, width: w, height: h }}>
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
  geometry = STANDARD_SLAB_GEOMETRY,
}: {
  entries: VectorEntry[]
  spec: LabStyleSpec
  variant: 'standard' | 'custom'
  guideColor: string
  /** Sheet layout. Defaults to today's 10-per-sheet 2.8" × 0.8" grid. */
  geometry?: SheetGeometry
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

  // Batch: 2-column duplex pairs (front sheet then X-mirrored back sheet).
  // 5 rows at standard density, 10 at dense — the mirrored back sheet reads
  // the same geometry, so it mirrors with the real row count.
  const perPage = geometry.labelsPerPage
  const totalSheets = Math.ceil(entries.length / perPage)
  const pages: React.ReactElement[] = []
  for (let sheet = 0; sheet < totalSheets; sheet++) {
    const slice = entries.slice(sheet * perPage, (sheet + 1) * perPage)
    pages.push(
      <Page key={`f-${sheet}`} size="LETTER" style={{ backgroundColor: '#FFFFFF' }}>
        <PageHeader pageType="front" pageNum={sheet + 1} totalPages={totalSheets} variant={variant} geometry={geometry} />
        {slice.map((e, i) => {
          const { x, y } = gridPos(i, false, geometry)
          return (
            <LabelAt key={i} x={x} y={y} w={geometry.labelW} h={geometry.labelH}>
              <CustomSlabLabelBlock inputs={e.front} spec={spec} idSuffix={`f${sheet}-${i}`} bleedPt={BLEED} />
            </LabelAt>
          )
        })}
        <GuidesLayer>
          {slice.map((_, i) => {
            const { x, y } = gridPos(i, false, geometry)
            return <FrontCutGuides key={i} x={x} y={y} color={guideColor} w={geometry.labelW} h={geometry.labelH} />
          })}
        </GuidesLayer>
      </Page>,
    )
    pages.push(
      <Page key={`b-${sheet}`} size="LETTER" style={{ backgroundColor: '#FFFFFF' }}>
        <PageHeader pageType="back" pageNum={sheet + 1} totalPages={totalSheets} variant={variant} geometry={geometry} />
        {slice.map((e, i) => {
          const { x, y } = gridPos(i, true, geometry)
          return (
            <LabelAt key={i} x={x} y={y} w={geometry.labelW} h={geometry.labelH}>
              <CustomSlabBackBlock inputs={e.back} spec={spec} idSuffix={`b${sheet}-${i}`} bleedPt={BLEED} />
            </LabelAt>
          )
        })}
        <GuidesLayer>
          {slice.map((_, i) => {
            const { x, y } = gridPos(i, true, geometry)
            return <CornerMarks key={i} x={x} y={y} color={guideColor} w={geometry.labelW} h={geometry.labelH} />
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
  opts: ClassicRenderOptions = {},
): Promise<Blob> {
  if (style === 'traditional') return renderDocToBlob(await buildClassicFoldOverDoc([data], opts))
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
  opts: ClassicRenderOptions = {},
): Promise<Blob> {
  if (style === 'traditional') return renderDocToBlob(await buildClassicFoldOverDoc(dataArray, opts))
  const spec = specForStyle(style)
  const guideColor = style === 'modern' ? '#999999' : '#000000'
  const entries = dataArray.map(d => ({ front: mapFrontInputs(d), back: mapBackInputs(d) }))
  return renderDocToBlob(
    <SlabFoldOverDoc entries={entries} spec={spec} guideColor={guideColor} />,
  )
}

// ---------------------------------------------------------------------------
// Classic label — the rebuilt BUILT-IN 'traditional' style (Sept 2026)
// ---------------------------------------------------------------------------
//
// The built-in `traditional` id now renders the DCM-branded classic grading
// label (purple frame, white field, four identification lines, right-hand
// grade column, mark on a plate straddling the bottom frame) from the
// ClassicFront / ClassicBack blocks in labelLab/classicSlabPdfDoc.
//
// CUSTOM LABEL SLOTS ARE NOT AFFECTED. A CustomLabelConfig whose style is
// 'traditional' still resolves its spec through specFromCustomConfig() and
// still renders through CustomSlabLabelBlock — customers designed on that and
// keep it. Only specForStyle()'s callers (the built-in Modern/Traditional
// generators) route here, and only for 'traditional'. 'modern' is untouched.

/** Physical label size. Anything other than 2.8" x 0.8" renders scaled. */
export interface ClassicDims { widthIn: number; heightIn: number }

const CLASSIC_STD: ClassicDims = { widthIn: 2.8, heightIn: 0.8 }
const isClassicStd = (d: ClassicDims) =>
  Math.abs(d.widthIn - CLASSIC_STD.widthIn) < 0.001 && Math.abs(d.heightIn - CLASSIC_STD.heightIn) < 0.001
const resolveClassicDims = (d?: ClassicDims): ClassicDims =>
  d && d.widthIn > 0 && d.heightIn > 0 ? d : CLASSIC_STD
const classicDimsLabel = (d: ClassicDims) => `${d.widthIn}" × ${d.heightIn}"`

/** Classic is a light label — guides print black, as Traditional always has. */
const CLASSIC_GUIDE = '#000000'

export interface ClassicRenderOptions {
  /** Non-standard physical size (e.g. Zion Mag Pro 2.51" × 0.76"). */
  dims?: ClassicDims
  /** Pre-loaded black mark; batch callers load it once. Org mark when set. */
  logoBlack?: string | null
  /** Per-card QR target; dcmgrading.com/verify/{serial} when absent. */
  qrUrl?: string
}

/**
 * Map a SlabLabelData row onto the Classic blocks.
 *
 * No CJK stripping: classicSlabPdfDoc registers Noto Sans JP and renders
 * Japanese names as typed, so extractAsciiSafe() would only lose data. The QR
 * is rebuilt at error-correction H to match Heritage's printed codes.
 */
async function buildClassicInputs(
  data: SlabLabelData,
  opts: ClassicRenderOptions = {},
  preloadedBlackLogo?: string | null,
): Promise<ClassicInputs> {
  const verifyUrl = opts.qrUrl || `https://dcmgrading.com/verify/${data.serial}`
  const [qrDataUrl, blackLogoDataUrl] = await Promise.all([
    (async () => {
      try {
        const QRCode = (await import('qrcode')).default
        return await QRCode.toDataURL(verifyUrl, {
          errorCorrectionLevel: 'H', margin: 1, width: 560,
          color: { dark: '#141026', light: '#ffffff' },
        })
      } catch {
        return data.qrCodeDataUrl || null
      }
    })(),
    opts.logoBlack !== undefined
      ? Promise.resolve(opts.logoBlack)
      : preloadedBlackLogo !== undefined
        ? Promise.resolve(preloadedBlackLogo)
        : (await import('@/lib/foldableLabelGenerator')).loadBlackLogoAsBase64().catch(() => null),
  ])

  const d = data as SlabLabelData & {
    designation?: string | null
    setName?: string | null
    subset?: string | null
    cardNumber?: string | null
    formattedCardNumber?: string | null
    year?: string | null
    autographType?: string | null
  }

  return {
    primaryName: data.primaryName || 'Card',
    contextLine: data.contextLine || '',
    features: data.features,
    featuresLine: data.featuresLine,
    serial: data.serial,
    grade: data.grade,
    gradeFormatted: data.gradeFormatted,
    condition: data.condition,
    isAlteredAuthentic: data.isAlteredAuthentic,
    // Structured fields when the caller has them (labelDataGenerator carries
    // all of these); otherwise classicLines() parses the context line.
    designation: d.designation ?? null,
    setName: d.setName ?? null,
    subset: d.subset ?? null,
    cardNumber: d.cardNumber ?? null,
    formattedCardNumber: d.formattedCardNumber ?? null,
    year: d.year ?? null,
    autographType: d.autographType ?? null,
    blackLogoDataUrl,
    qrDataUrl,
    verifyUrl,
  }
}

/**
 * A standard-authored Classic panel scaled to the target physical size.
 *
 * Same hard-won rule as heritageSlabGenerator's ScaledPanel: react-pdf 4.5
 * applies a scale(sx, sy) transform correctly to a node's CHILDREN but shrinks
 * the node's OWN background and border by the Y factor twice. So the outer
 * chrome is painted HERE, unscaled, at the true label size, and the panel
 * renders `bare` inside the transform. (Classic draws its purple frame as a
 * child view, so the only thing this backdrop has to supply is the purple
 * behind any sub-pixel seam at the edges.) Standard-size panels are untouched.
 */
function ClassicScaledPanel({ d, children }: { d: ClassicDims; children: React.ReactNode }) {
  if (isClassicStd(d)) return <>{children}</>
  const sx = d.widthIn / CLASSIC_STD.widthIn
  const sy = d.heightIn / CLASSIC_STD.heightIn
  return (
    <View style={{ width: d.widthIn * INCH, height: d.heightIn * INCH, overflow: 'hidden', backgroundColor: CLASSIC_PURPLE }}>
      <View style={{ width: LABEL_W, height: LABEL_H, transform: `scale(${sx}, ${sy})`, transformOrigin: '0 0' }}>
        {React.Children.map(children, child =>
          React.isValidElement(child) ? React.cloneElement(child as React.ReactElement<{ bare?: boolean }>, { bare: true }) : child,
        )}
      </View>
    </View>
  )
}

/** Absolutely-positioned, size-aware Classic label slot. */
function ClassicLabelAt({ x, y, d, children }: { x: number; y: number; d: ClassicDims; children: React.ReactNode }) {
  return (
    <View style={{ position: 'absolute', left: x, top: y, width: d.widthIn * INCH, height: d.heightIn * INCH }}>
      <ClassicScaledPanel d={d}>{children}</ClassicScaledPanel>
    </View>
  )
}

/**
 * Print bleed. The Classic frame is purple on all four edges, so — unlike the
 * Heritage band, which only touches one — the bleed underlay is simply purple
 * on whichever outer edges the panel has. `seam` names the fold-over edge that
 * must stay flush so the bleed cannot paint over the facing panel.
 */
function ClassicBleed({ x, y, d, seam = null, pairH }: {
  x: number; y: number; d: ClassicDims; seam?: 'top' | 'bottom' | null; pairH?: number
}) {
  const B = BLEED
  const w = d.widthIn * INCH
  const h = pairH ?? d.heightIn * INCH
  const top = seam === 'top' ? y : y - B
  const bottom = seam === 'bottom' ? y + h : y + h + B
  return (
    <View style={{
      position: 'absolute', left: x - B, top, width: w + B * 2, height: bottom - top,
      backgroundColor: CLASSIC_PURPLE,
    }} />
  )
}

/** Size-aware cut guides: dashed rect (front) or corner ticks (back). */
function ClassicDimsGuides({ x, y, d, cornersOnly }: { x: number; y: number; d: ClassicDims; cornersOnly?: boolean }) {
  const w = d.widthIn * INCH
  const h = d.heightIn * INCH
  const m = 8
  if (!cornersOnly) {
    return <Rect x={x} y={y} width={w} height={h} fill="none" stroke={CLASSIC_GUIDE} strokeWidth={0.5} strokeDasharray="3 3" />
  }
  return (
    <>
      <Line x1={x - m} y1={y} x2={x} y2={y} stroke={CLASSIC_GUIDE} strokeWidth={0.5} />
      <Line x1={x} y1={y - m} x2={x} y2={y} stroke={CLASSIC_GUIDE} strokeWidth={0.5} />
      <Line x1={x + w} y1={y} x2={x + w + m} y2={y} stroke={CLASSIC_GUIDE} strokeWidth={0.5} />
      <Line x1={x + w} y1={y - m} x2={x + w} y2={y} stroke={CLASSIC_GUIDE} strokeWidth={0.5} />
      <Line x1={x - m} y1={y + h} x2={x} y2={y + h} stroke={CLASSIC_GUIDE} strokeWidth={0.5} />
      <Line x1={x} y1={y + h} x2={x} y2={y + h + m} stroke={CLASSIC_GUIDE} strokeWidth={0.5} />
      <Line x1={x + w} y1={y + h} x2={x + w + m} y2={y + h} stroke={CLASSIC_GUIDE} strokeWidth={0.5} />
      <Line x1={x + w} y1={y + h} x2={x + w} y2={y + h + m} stroke={CLASSIC_GUIDE} strokeWidth={0.5} />
    </>
  )
}

function ClassicDuplexDoc({ entries, d, geometry }: {
  entries: ClassicInputs[]; d: ClassicDims; geometry?: SheetGeometry
}) {
  const std = isClassicStd(d)
  const header = `${classicDimsLabel(d)} — Traditional`

  // Single label: centred on the page (symmetric, so duplex mirroring is exact).
  if (entries.length === 1) {
    const i = entries[0]
    const x = std ? SINGLE_X : (PAGE_W - d.widthIn * INCH) / 2
    const y = std ? SINGLE_Y : (PAGE_H - d.heightIn * INCH) / 2
    return (
      <Document>
        <Page size="LETTER" style={{ backgroundColor: '#FFFFFF' }}>
          {std
            ? <PageHeader pageType="front" pageNum={1} totalPages={1} variant="standard" />
            : <PageHeader pageType="front" pageNum={1} totalPages={1} variant="custom" dims={header} />}
          <ClassicBleed x={x} y={y} d={d} />
          <ClassicLabelAt x={x} y={y} d={d}>
            <ClassicFront i={i} idSuffix="sf" />
          </ClassicLabelAt>
          <GuidesLayer>
            {std ? <FrontCutGuides x={x} y={y} color={CLASSIC_GUIDE} /> : <ClassicDimsGuides x={x} y={y} d={d} />}
          </GuidesLayer>
        </Page>
        <Page size="LETTER" style={{ backgroundColor: '#FFFFFF' }}>
          {std
            ? <PageHeader pageType="back" pageNum={1} totalPages={1} variant="standard" />
            : <PageHeader pageType="back" pageNum={1} totalPages={1} variant="custom" dims={header} />}
          <ClassicBleed x={x} y={y} d={d} />
          <ClassicLabelAt x={x} y={y} d={d}>
            <ClassicBack i={i} idSuffix="sb" />
          </ClassicLabelAt>
          <GuidesLayer>
            {std ? <CornerMarks x={x} y={y} color={CLASSIC_GUIDE} /> : <ClassicDimsGuides x={x} y={y} d={d} cornersOnly />}
          </GuidesLayer>
        </Page>
      </Document>
    )
  }

  // Batch: 2-column duplex pairs (front sheet then X-mirrored back sheet).
  const geo = geometry ?? STANDARD_SLAB_GEOMETRY
  // Non-standard labels centre inside the standard grid cell; the cells are
  // page-symmetric, so long-edge-flip duplex mirroring stays exact.
  const offX = std ? 0 : (geo.labelW - d.widthIn * INCH) / 2
  const offY = std ? 0 : (geo.labelH - d.heightIn * INCH) / 2
  const perPage = geo.labelsPerPage
  const totalSheets = Math.ceil(entries.length / perPage)
  const pages: React.ReactElement[] = []
  for (let sheet = 0; sheet < totalSheets; sheet++) {
    const slice = entries.slice(sheet * perPage, (sheet + 1) * perPage)
    for (const side of ['front', 'back'] as const) {
      const mirrored = side === 'back'
      pages.push(
        <Page key={`${side}-${sheet}`} size="LETTER" style={{ backgroundColor: '#FFFFFF' }}>
          {std
            ? <PageHeader pageType={side} pageNum={sheet + 1} totalPages={totalSheets} variant="standard" geometry={geo} />
            : <PageHeader pageType={side} pageNum={sheet + 1} totalPages={totalSheets} variant="custom" dims={header} geometry={geo} />}
          {slice.map((i, idx) => {
            const { x, y } = gridPos(idx, mirrored, geo)
            return (
              <React.Fragment key={idx}>
                <ClassicBleed x={x + offX} y={y + offY} d={d} />
                <ClassicLabelAt x={x + offX} y={y + offY} d={d}>
                  {side === 'front'
                    ? <ClassicFront i={i} idSuffix={`f${sheet}-${idx}`} />
                    : <ClassicBack i={i} idSuffix={`b${sheet}-${idx}`} />}
                </ClassicLabelAt>
              </React.Fragment>
            )
          })}
          <GuidesLayer>
            {slice.map((_, idx) => {
              const { x, y } = gridPos(idx, mirrored, geo)
              if (!std) return <ClassicDimsGuides key={idx} x={x + offX} y={y + offY} d={d} cornersOnly={mirrored} />
              return mirrored
                ? <CornerMarks key={idx} x={x} y={y} color={CLASSIC_GUIDE} w={geo.labelW} h={geo.labelH} />
                : <FrontCutGuides key={idx} x={x} y={y} color={CLASSIC_GUIDE} w={geo.labelW} h={geo.labelH} />
            })}
          </GuidesLayer>
        </Page>,
      )
    }
  }
  return <Document>{pages}</Document>
}

/** One fold pair: rotated back over front, at (x, y) = top-left of the pair. */
function ClassicFoldPair({ i, x, y, d, idSuffix }: { i: ClassicInputs; x: number; y: number; d: ClassicDims; idSuffix: string }) {
  const w = d.widthIn * INCH
  const h = d.heightIn * INCH
  return (
    <>
      {/* Purple bleed on the pair's outer edges only; the seam stays flush. */}
      <ClassicBleed x={x} y={y} d={d} pairH={h * 2} />
      <View style={{ position: 'absolute', left: x, top: y, width: w, height: h, transform: 'rotate(180deg)' }}>
        <ClassicScaledPanel d={d}>
          <ClassicBack i={i} idSuffix={`${idSuffix}b`} />
        </ClassicScaledPanel>
      </View>
      <View style={{ position: 'absolute', left: x, top: y + h, width: w, height: h }}>
        <ClassicScaledPanel d={d}>
          <ClassicFront i={i} idSuffix={`${idSuffix}f`} />
        </ClassicScaledPanel>
      </View>
    </>
  )
}

/** Dashed cut outline around the pair + fold ticks at the seam. */
function ClassicFoldGuides({ x, y, d }: { x: number; y: number; d: ClassicDims }) {
  const w = d.widthIn * INCH
  const h = d.heightIn * INCH
  const foldY = y + h
  return (
    <>
      <Rect x={x} y={y} width={w} height={h * 2} fill="none" stroke={CLASSIC_GUIDE} strokeWidth={0.5} strokeDasharray="3 3" />
      <Line x1={x - 16} y1={foldY} x2={x - 4} y2={foldY} stroke="#bbbbbb" strokeWidth={0.8} />
      <Line x1={x + w + 4} y1={foldY} x2={x + w + 16} y2={foldY} stroke="#bbbbbb" strokeWidth={0.8} />
      <ScissorGlyph x={x - 9} y={y + 2} color={CLASSIC_GUIDE} />
      <ScissorGlyph x={x + w + 2} y={y + 2} color={CLASSIC_GUIDE} />
    </>
  )
}

function ClassicFoldOverDoc({ entries, d }: { entries: ClassicInputs[]; d: ClassicDims }) {
  const std = isClassicStd(d)
  const w = d.widthIn * INCH
  const pairH = d.heightIn * INCH * 2
  const header = std
    ? '2.8" × 1.6" fold-over — Traditional'
    : `${d.widthIn}" × ${(d.heightIn * 2).toFixed(2)}" fold-over — Traditional`

  if (entries.length === 1) {
    const x = (PAGE_W - w) / 2
    const y = (PAGE_H - pairH) / 2
    return (
      <Document>
        <Page size="LETTER" style={{ backgroundColor: '#FFFFFF' }}>
          <PageHeader pageType="front" pageNum={1} totalPages={1} variant="custom" dims={header} />
          <ClassicFoldPair i={entries[0]} x={x} y={y} d={d} idSuffix="fo" />
          <GuidesLayer>
            <ClassicFoldGuides x={x} y={y} d={d} />
          </GuidesLayer>
          <Text style={{ position: 'absolute', left: x, top: y + pairH + 8, fontSize: 7, color: '#9ca3af' }}>
            {d.widthIn}&quot; × {(d.heightIn * 2).toFixed(2)}&quot; total — fold top panel behind front
          </Text>
        </Page>
      </Document>
    )
  }

  // Non-standard pairs centre inside the standard fold cell.
  const offX = std ? 0 : (LABEL_W - w) / 2
  const offY = std ? 0 : (FOLD_H - pairH) / 2
  const totalSheets = Math.ceil(entries.length / FOLD_PER_PAGE)
  const pages: React.ReactElement[] = []
  for (let sheet = 0; sheet < totalSheets; sheet++) {
    const slice = entries.slice(sheet * FOLD_PER_PAGE, (sheet + 1) * FOLD_PER_PAGE)
    pages.push(
      <Page key={sheet} size="LETTER" style={{ backgroundColor: '#FFFFFF' }}>
        <PageHeader pageType="front" pageNum={sheet + 1} totalPages={totalSheets} variant="custom" dims={header} />
        {slice.map((i, idx) => {
          const x = FOLD_GRID_X + (idx % FOLD_COLS) * FOLD_CELL_W + offX
          const y = FOLD_GRID_Y + Math.floor(idx / FOLD_COLS) * FOLD_CELL_H + offY
          return <ClassicFoldPair key={idx} i={i} x={x} y={y} d={d} idSuffix={`fo${sheet}-${idx}`} />
        })}
        <GuidesLayer>
          {slice.map((_, idx) => {
            const x = FOLD_GRID_X + (idx % FOLD_COLS) * FOLD_CELL_W + offX
            const y = FOLD_GRID_Y + Math.floor(idx / FOLD_COLS) * FOLD_CELL_H + offY
            return <ClassicFoldGuides key={idx} x={x} y={y} d={d} />
          })}
        </GuidesLayer>
      </Page>,
    )
  }
  return <Document>{pages}</Document>
}

/** Batch inputs, with the DCM mark loaded once for the whole sheet. */
async function buildClassicBatch(dataArray: SlabLabelData[], opts: ClassicRenderOptions): Promise<ClassicInputs[]> {
  const dcmBlack = opts.logoBlack !== undefined
    ? opts.logoBlack
    : await (await import('@/lib/foldableLabelGenerator')).loadBlackLogoAsBase64().catch(() => null)
  return Promise.all(dataArray.map(d => buildClassicInputs(d, opts, dcmBlack)))
}

/** Node-safe Classic batch duplex document (no Blob) — used by proof scripts. */
export async function buildBatchClassicSlabLabelsDoc(
  dataArray: SlabLabelData[],
  opts: ClassicRenderOptions = {},
  density: SheetDensity = 'standard',
): Promise<React.ReactElement> {
  const d = resolveClassicDims(opts.dims)
  const entries = await buildClassicBatch(dataArray, opts)
  const geometry = density === 'dense'
    ? resolveSheetGeometry({ labelWIn: d.widthIn, labelHIn: d.heightIn, density: 'dense' })
    : STANDARD_SLAB_GEOMETRY
  return <ClassicDuplexDoc entries={entries} d={d} geometry={geometry} />
}

/** Node-safe Classic single duplex document. */
export async function buildClassicSlabLabelDoc(
  data: SlabLabelData,
  opts: ClassicRenderOptions = {},
): Promise<React.ReactElement> {
  const d = resolveClassicDims(opts.dims)
  const i = await buildClassicInputs(data, opts)
  return <ClassicDuplexDoc entries={[i]} d={d} />
}

/** Node-safe Classic fold-over document (one or many). */
export async function buildClassicFoldOverDoc(
  dataArray: SlabLabelData[],
  opts: ClassicRenderOptions = {},
): Promise<React.ReactElement> {
  const d = resolveClassicDims(opts.dims)
  const entries = await buildClassicBatch(dataArray, opts)
  return <ClassicFoldOverDoc entries={entries} d={d} />
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
  opts: ClassicRenderOptions = {},
): Promise<Blob> {
  // The built-in Traditional id is the Classic label (Sept 2026). Custom
  // label slots configured with style 'traditional' do NOT come through here —
  // they resolve their spec via specFromCustomConfig and keep the old block.
  if (style === 'traditional') return renderDocToBlob(await buildClassicSlabLabelDoc(data, opts))
  const spec = specForStyle(style)
  const guideColor = style === 'modern' ? '#ffffff' : '#000000'
  const entries = [{ front: mapFrontInputs(data), back: mapBackInputs(data) }]
  return renderDocToBlob(
    <SlabVectorDoc entries={entries} spec={spec} variant="standard" guideColor={guideColor} />,
  )
}

/**
 * Standard slab batch document (node-safe — returns the react-pdf element, no
 * Blob). `scripts/label-sheet-sample.ts` renders it with renderToBuffer.
 *
 * NOTE: this synchronous builder still emits the LEGACY traditional spec,
 * because the Classic label has to await a QR and the DCM mark. Callers that
 * want the production Traditional output use buildBatchClassicSlabLabelsDoc.
 */
export function buildBatchSlabLabelsDoc(
  dataArray: SlabLabelData[],
  style: 'modern' | 'traditional',
  density: SheetDensity = 'standard',
): React.ReactElement {
  const spec = specForStyle(style)
  const guideColor = style === 'modern' ? '#ffffff' : '#000000'
  const entries = dataArray.map(d => ({ front: mapFrontInputs(d), back: mapBackInputs(d) }))
  const geometry = resolveSheetGeometry({ labelWIn: 2.8, labelHIn: 0.8, density })
  return (
    <SlabVectorDoc entries={entries} spec={spec} variant="standard" guideColor={guideColor} geometry={geometry} />
  )
}

/**
 * Standard slab batch — duplex sheets with mirrored backs.
 * `density` 'standard' = 2×5 (10 per sheet, the default and unchanged),
 * 'dense' = 2×10 (20 per sheet, 3/8" top and bottom margins).
 */
export async function generateBatchSlabLabelsVector(
  dataArray: SlabLabelData[],
  style: 'modern' | 'traditional',
  density: SheetDensity = 'standard',
  opts: ClassicRenderOptions = {},
): Promise<Blob> {
  if (style === 'traditional') {
    return renderDocToBlob(await buildBatchClassicSlabLabelsDoc(dataArray, opts, density))
  }
  return renderDocToBlob(buildBatchSlabLabelsDoc(dataArray, style, density))
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

/**
 * Custom-style slab batch document (node-safe). The vector batch is authored
 * at the standard 2.8" × 0.8" slot; non-standard configs (Zion Mag Pro) still
 * take the raster path in customSlabLabelGenerator, which renders at the
 * config's true size — see the Aug 2026 customer report.
 */
export function buildBatchCustomSlabLabelsDoc(
  dataArray: SlabLabelData[],
  config: CustomLabelConfig,
  density: SheetDensity = 'standard',
): React.ReactElement {
  const spec = specFromCustomConfig({ ...config, width: 2.8, height: 0.8 })
  const guideColor = config.style === 'modern' ? '#ffffff' : '#000000'
  const entries = dataArray.map(d => ({ front: mapFrontInputs(d), back: mapBackInputs(d) }))
  const geometry = resolveSheetGeometry({ labelWIn: 2.8, labelHIn: 0.8, density })
  return (
    <SlabVectorDoc entries={entries} spec={spec} variant="custom" guideColor={guideColor} geometry={geometry} />
  )
}

/** Custom-style slab batch (batch always uses standard dimensions). */
export async function generateBatchCustomSlabLabelsVector(
  dataArray: SlabLabelData[],
  config: CustomLabelConfig,
  density: SheetDensity = 'standard',
): Promise<Blob> {
  return renderDocToBlob(buildBatchCustomSlabLabelsDoc(dataArray, config, density))
}