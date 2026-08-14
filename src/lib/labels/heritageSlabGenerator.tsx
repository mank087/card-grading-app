/**
 * Heritage slab label — PRODUCTION generator (Aug 2026, Promotion 3 from the
 * Label Lab).
 *
 * Reuses the lab-validated HeritageFront / HeritageBack blocks inside the same
 * letter-page duplex document the Modern/Traditional vector generators emit
 * (shared chrome from vectorSlabGenerator), so Heritage prints with identical
 * cut guides and page behaviour.
 *
 * Differences from the modern/traditional mappers, on purpose:
 *  - No CJK stripping: Heritage registers Noto Sans JP and renders Japanese
 *    names as typed, so the extractAsciiSafe() fallback would only lose data.
 *  - The QR is rebuilt here at error-correction H (the Studio's shared QR is
 *    level M) because the DCM mark is composited over the QR centre and H is
 *    what keeps the occluded code scannable.
 *  - Always print-hardened: the Studio output exists to be printed.
 */
import React from 'react'
import { Document, Page, View, Text, Svg, Rect, Line, pdf } from '@react-pdf/renderer'
import {
  HeritageFront,
  HeritageBack,
  type HeritageInputs,
  type BandPattern,
  BAND_PATTERNS,
} from '@/lib/labelLab/heritageSlabPdfDoc'
import { resolveGradeChip } from '@/lib/labelPresets'
import { heritageTheme } from '@/lib/labelLab/heritageLayout'
import {
  PageHeader,
  CornerMarks,
  FrontCutGuides,
  GuidesLayer,
  LabelAt,
  gridPos,
  LABELS_PER_PAGE,
  SINGLE_X,
  SINGLE_Y,
} from '@/lib/labels/vectorSlabGenerator'
import type { SlabLabelData } from '@/lib/slabLabelGenerator'
import { loadBlackLogoAsBase64 } from '@/lib/foldableLabelGenerator'

export interface HeritageRenderOptions {
  /** Band palette, already resolved (resolveHeritageBandColors). */
  bandColors: string[]
  pattern: BandPattern
  /** Per-grade chip colour overrides ('1'..'10'), or null for defaults. */
  gradeColors?: Record<string, string> | null
  /**
   * Org-branding override for the FRONT-label mark (black-variant data URL).
   * The QR-centre disc follows data.logoDataUrl, which enterprise callers
   * also set to the org's colour logo — the scan still resolves to the DCM
   * verify page, which carries the verification trust. Absent = DCM mark.
   */
  logoBlack?: string
  /**
   * Mark size multiplier from the org's Brand Setup. The PDF clamps it per
   * card against the fitted text (heritageMarkBox), so a large store logo
   * can never print over the serial.
   */
  logoScale?: number
}

/** 'diamond' unless the config carries a valid pattern id. */
export function resolveHeritagePattern(id: string | undefined | null): BandPattern {
  return (BAND_PATTERNS.find(p => p.id === id)?.id ?? 'diamond') as BandPattern
}

function roundSub(v: number | undefined): number | null {
  if (v == null || !isFinite(v)) return null
  return Math.round(v * 2) / 2
}

async function buildHeritageInputs(
  data: SlabLabelData,
  opts: HeritageRenderOptions,
  /** Batch callers preload the black mark once instead of per card. */
  preloadedBlackLogo?: string | null,
): Promise<HeritageInputs> {
  const [qrDataUrl, blackLogoDataUrl] = await Promise.all([
    (async () => {
      try {
        const QRCode = (await import('qrcode')).default
        return await QRCode.toDataURL(`https://dcmgrading.com/verify/${data.serial}`, {
          errorCorrectionLevel: 'H', margin: 1, width: 560,
          color: { dark: '#141414', light: '#ffffff' },
        })
      } catch {
        return data.qrCodeDataUrl || null
      }
    })(),
    opts.logoBlack
      ? Promise.resolve(opts.logoBlack)
      : preloadedBlackLogo !== undefined
        ? Promise.resolve(preloadedBlackLogo)
        : loadBlackLogoAsBase64().catch(() => null),
  ])

  const grade = data.grade !== null && data.grade !== undefined
    ? Math.round(data.grade).toString()
    : (data.isAlteredAuthentic ? 'A' : '—')

  return {
    primaryName: data.primaryName || 'Card',
    contextLine: data.contextLine || '',
    serial: data.serial,
    grade,
    condition: data.isAlteredAuthentic && data.grade === null ? 'Authentic' : (data.condition || ''),
    subgrades: {
      centering: roundSub(data.subScores?.centering),
      corners: roundSub(data.subScores?.corners),
      edges: roundSub(data.subScores?.edges),
      surface: roundSub(data.subScores?.surface),
    },
    bandColors: opts.bandColors,
    pattern: opts.pattern,
    gradeColors: opts.gradeColors ?? null,
    colorLogoDataUrl: data.logoDataUrl || null,
    whiteLogoDataUrl: data.whiteLogoDataUrl || null,
    blackLogoDataUrl,
    logoTreatment: 'rules',
    logoColor: 'black',
    logoScale: opts.logoScale ?? 1,
    qrDataUrl,
    printHardened: true,
    showFounder: data.showFounderEmblem,
    showCardLover: data.showCardLoversEmblem,
    showVip: data.showVipEmblem,
  }
}

/** Heritage is a light label — guides print black, like Traditional. */
const GUIDE_COLOR = '#000000'

function HeritageProductionDoc({ inputs }: { inputs: HeritageInputs }) {
  const chip = resolveGradeChip(inputs.grade, !!inputs.printHardened)
  return (
    <Document>
      <Page size="LETTER" style={{ backgroundColor: '#FFFFFF' }}>
        <PageHeader pageType="front" pageNum={1} totalPages={1} variant="custom" dims={'2.8" × 0.8" — Heritage'} />
        {/* Duplex instruction — matches the standard vector sheet's PageHeader wording. */}
        <View style={{ position: 'absolute', top: 33, left: 50, right: 50, alignItems: 'center' }}>
          <Text style={{ fontSize: 7, color: '#9ca3af' }}>Print duplex (flip on long edge) • Cut along dotted lines</Text>
        </View>
        <PanelBleed x={SINGLE_X} y={SINGLE_Y} inputs={inputs} />
        <LabelAt x={SINGLE_X} y={SINGLE_Y}>
          <HeritageFront i={inputs} chip={chip} />
        </LabelAt>
        <GuidesLayer>
          <FrontCutGuides x={SINGLE_X} y={SINGLE_Y} color={GUIDE_COLOR} />
        </GuidesLayer>
      </Page>
      <Page size="LETTER" style={{ backgroundColor: '#FFFFFF' }}>
        <PageHeader pageType="back" pageNum={1} totalPages={1} variant="custom" dims={'2.8" × 0.8" — Heritage'} />
        <View style={{ position: 'absolute', top: 33, left: 50, right: 50, alignItems: 'center' }}>
          <Text style={{ fontSize: 7, color: '#9ca3af' }}>BACK SIDE • Print duplex (flip on long edge)</Text>
        </View>
        <PanelBleed x={SINGLE_X} y={SINGLE_Y} inputs={inputs} />
        <LabelAt x={SINGLE_X} y={SINGLE_Y}>
          <HeritageBack i={inputs} chip={chip} />
        </LabelAt>
        <GuidesLayer>
          <CornerMarks x={SINGLE_X} y={SINGLE_Y} color={GUIDE_COLOR} />
        </GuidesLayer>
      </Page>
    </Document>
  )
}

/** Single Heritage label, front + back pages with cut guides. */
export async function generateHeritageSlabLabelVector(
  data: SlabLabelData,
  opts: HeritageRenderOptions,
): Promise<Blob> {
  const inputs = await buildHeritageInputs(data, opts)
  return pdf(<HeritageProductionDoc inputs={inputs} /> as any).toBlob()
}

export async function downloadHeritageSlabLabel(
  data: SlabLabelData,
  opts: HeritageRenderOptions,
  filename?: string,
): Promise<void> {
  const blob = await generateHeritageSlabLabelVector(data, opts)
  triggerDownload(blob, filename || `DCM-Heritage-Label-${data.serial}.pdf`)
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Fold-over — single-sided printing. Geometry mirrors the raster fold-over in
// slabLabelGenerator (generateFoldOverSlabLabel): BACK panel on top rotated
// 180°, FRONT below, fold line at the seam; fold the top panel down behind
// the front and the back comes out right-side up. Vector needs no bleed
// cropping — the panels are drawn flush at the seam to begin with.
// ---------------------------------------------------------------------------

const INCH = 72
const LABEL_W = 2.8 * INCH   // 201.6
const LABEL_H = 0.8 * INCH   // 57.6
const PAGE_W = 8.5 * INCH
const PAGE_H = 11 * INCH
const FOLD_H = LABEL_H * 2

// Print bleed matching the modern fold-over (slabLabelGenerator BLEED_IN
// 0.08"): the heritage panels draw their field flush at the cut line, so a
// slightly wide cut used to leave unprinted paper — and the ink block itself
// measured 0.16" smaller than the modern label's, which printed "smaller" to
// anyone trimming along the ink edge (reported Aug 12). The underlays extend
// the field — and the band colour along the band edge — past the cut on the
// pair's outer edges only; the fold seam stays flush.
const FOLD_BLEED = 0.08 * INCH
const BAND_W_PT = (90 / 1400) * LABEL_W // heritageSlabPdfDoc BAND_W = u(90)

/** Field + band-edge bleed underlay for ONE heritage panel at (x, y) — the
 *  band sits on the panel's left in both front and back blocks. Used by the
 *  single and batch-duplex docs; FoldPair composes its own pair-shaped bleed
 *  because the rotated back panel moves its band to the pair's other edge. */
function PanelBleed({ x, y, inputs }: { x: number; y: number; inputs: HeritageInputs }) {
  const B = FOLD_BLEED
  const field = heritageTheme(!!inputs.printHardened).field
  const band = inputs.bandColors?.[0] || '#101014'
  return (
    <>
      <View style={{ position: 'absolute', left: x - B, top: y - B, width: LABEL_W + B * 2, height: LABEL_H + B * 2, backgroundColor: field }} />
      <View style={{ position: 'absolute', left: x - B, top: y - B, width: B, height: LABEL_H + B * 2, backgroundColor: band }} />
      <View style={{ position: 'absolute', left: x, top: y - B, width: BAND_W_PT, height: B, backgroundColor: band }} />
      <View style={{ position: 'absolute', left: x, top: y + LABEL_H, width: BAND_W_PT, height: B, backgroundColor: band }} />
    </>
  )
}

/** One fold pair: rotated back over front, at (x, y) = top-left of the pair. */
function FoldPair({ inputs, x, y }: { inputs: HeritageInputs; x: number; y: number }) {
  const chip = resolveGradeChip(inputs.grade, !!inputs.printHardened)
  const B = FOLD_BLEED
  const field = heritageTheme(!!inputs.printHardened).field
  const band = inputs.bandColors?.[0] || '#101014'
  return (
    <>
      {/* field bleed under the whole pair (left/right/top/bottom overhang) */}
      <View style={{ position: 'absolute', left: x - B, top: y - B, width: LABEL_W + B * 2, height: FOLD_H + B * 2, backgroundColor: field }} />
      {/* band-colour bleed: front band sits on the pair's bottom-left edge;
          the 180°-rotated back puts its band on the top-right edge */}
      <View style={{ position: 'absolute', left: x - B, top: y + LABEL_H, width: B, height: LABEL_H + B, backgroundColor: band }} />
      <View style={{ position: 'absolute', left: x - B, top: y + FOLD_H, width: B + BAND_W_PT, height: B, backgroundColor: band }} />
      <View style={{ position: 'absolute', left: x + LABEL_W, top: y - B, width: B, height: LABEL_H + B, backgroundColor: band }} />
      <View style={{ position: 'absolute', left: x + LABEL_W - BAND_W_PT, top: y - B, width: B + BAND_W_PT, height: B, backgroundColor: band }} />
      <View style={{ position: 'absolute', left: x, top: y, width: LABEL_W, height: LABEL_H, transform: 'rotate(180deg)' }}>
        <HeritageBack i={inputs} chip={chip} />
      </View>
      <View style={{ position: 'absolute', left: x, top: y + LABEL_H, width: LABEL_W, height: LABEL_H }}>
        <HeritageFront i={inputs} chip={chip} />
      </View>
    </>
  )
}

/** Dashed cut outline around the pair + fold ticks at the seam (outside). */
function FoldGuides({ x, y }: { x: number; y: number }) {
  const foldY = y + LABEL_H
  return (
    <>
      <Rect x={x} y={y} width={LABEL_W} height={FOLD_H} fill="none"
        stroke={GUIDE_COLOR} strokeWidth={0.5} strokeDasharray="3 3" />
      <Line x1={x - 16} y1={foldY} x2={x - 4} y2={foldY} stroke="#bbbbbb" strokeWidth={0.8} />
      <Line x1={x + LABEL_W + 4} y1={foldY} x2={x + LABEL_W + 16} y2={foldY} stroke="#bbbbbb" strokeWidth={0.8} />
    </>
  )
}

function HeritageFoldOverDoc({ inputs }: { inputs: HeritageInputs }) {
  const x = (PAGE_W - LABEL_W) / 2
  const y = (PAGE_H - FOLD_H) / 2
  return (
    <Document>
      <Page size="LETTER" style={{ backgroundColor: '#FFFFFF' }}>
        <PageHeader pageType="front" pageNum={1} totalPages={1} variant="custom" dims={'2.8" × 1.6" — Heritage fold-over'} />
        <FoldPair inputs={inputs} x={x} y={y} />
        <GuidesLayer>
          <FoldGuides x={x} y={y} />
        </GuidesLayer>
        <Text style={{ position: 'absolute', left: x, top: y + FOLD_H + 8, fontSize: 7, color: '#9ca3af' }}>
          2.8&quot; × 1.6&quot; total — fold top panel behind front
        </Text>
      </Page>
    </Document>
  )
}

/** Single fold-over label (single-sided page, no duplex needed). */
export async function generateHeritageFoldOverLabelVector(
  data: SlabLabelData,
  opts: HeritageRenderOptions,
): Promise<Blob> {
  const inputs = await buildHeritageInputs(data, opts)
  return pdf(<HeritageFoldOverDoc inputs={inputs} /> as any).toBlob()
}

export async function downloadHeritageFoldOverLabel(
  data: SlabLabelData,
  opts: HeritageRenderOptions,
  filename?: string,
): Promise<void> {
  const blob = await generateHeritageFoldOverLabelVector(data, opts)
  triggerDownload(blob, filename || `DCM-Heritage-FoldOver-${data.serial}.pdf`)
}

// ---------------------------------------------------------------------------
// Batch — duplex 2×5 sheets (X-mirrored backs, same grid as the standard
// vector batch) and fold-over sheets (grid mirrors the raster batch fold-over
// in slabLabelGenerator: 2 cols × 5 rows of 2.8" × 1.6" pairs).
// ---------------------------------------------------------------------------

export interface HeritageBatchItem {
  data: SlabLabelData
  /** Per-card band palette (resolveHeritageBandColors(card.card_colors)). */
  bandColors: string[]
  /** Per-card org front mark (black-variant data URL); DCM when absent. */
  logoBlack?: string
}

async function buildBatchInputs(items: HeritageBatchItem[], pattern: BandPattern, gradeColors?: Record<string, string> | null): Promise<HeritageInputs[]> {
  const dcmBlack = await loadBlackLogoAsBase64().catch(() => null)
  return Promise.all(
    items.map(it => buildHeritageInputs(it.data, { bandColors: it.bandColors, pattern, gradeColors }, it.logoBlack ?? dcmBlack)),
  )
}

function HeritageBatchDuplexDoc({ entries }: { entries: HeritageInputs[] }) {
  const totalSheets = Math.ceil(entries.length / LABELS_PER_PAGE)
  const pages: React.ReactElement[] = []
  for (let sheet = 0; sheet < totalSheets; sheet++) {
    const slice = entries.slice(sheet * LABELS_PER_PAGE, (sheet + 1) * LABELS_PER_PAGE)
    pages.push(
      <Page key={`f-${sheet}`} size="LETTER" style={{ backgroundColor: '#FFFFFF' }}>
        <PageHeader pageType="front" pageNum={sheet + 1} totalPages={totalSheets} variant="standard" />
        {slice.map((inputs, i) => {
          const { x, y } = gridPos(i, false)
          const chip = resolveGradeChip(inputs.grade, !!inputs.printHardened)
          return (
            <React.Fragment key={i}>
              <PanelBleed x={x} y={y} inputs={inputs} />
              <LabelAt x={x} y={y}>
                <HeritageFront i={inputs} chip={chip} />
              </LabelAt>
            </React.Fragment>
          )
        })}
        <GuidesLayer>
          {slice.map((_, i) => {
            const { x, y } = gridPos(i, false)
            return <FrontCutGuides key={i} x={x} y={y} color={GUIDE_COLOR} />
          })}
        </GuidesLayer>
      </Page>,
    )
    pages.push(
      <Page key={`b-${sheet}`} size="LETTER" style={{ backgroundColor: '#FFFFFF' }}>
        <PageHeader pageType="back" pageNum={sheet + 1} totalPages={totalSheets} variant="standard" />
        {slice.map((inputs, i) => {
          const { x, y } = gridPos(i, true)
          const chip = resolveGradeChip(inputs.grade, !!inputs.printHardened)
          return (
            <React.Fragment key={i}>
              <PanelBleed x={x} y={y} inputs={inputs} />
              <LabelAt x={x} y={y}>
                <HeritageBack i={inputs} chip={chip} />
              </LabelAt>
            </React.Fragment>
          )
        })}
        <GuidesLayer>
          {slice.map((_, i) => {
            const { x, y } = gridPos(i, true)
            return <CornerMarks key={i} x={x} y={y} color={GUIDE_COLOR} />
          })}
        </GuidesLayer>
      </Page>,
    )
  }
  return <Document>{pages}</Document>
}

// Fold-over grid — same cell math as generateBatchFoldOverSlabLabels.
const FOLD_ROW_MARGIN = 0.15 * INCH
const FOLD_COL_MARGIN = 0.2 * INCH
const FOLD_CELL_W = LABEL_W + FOLD_COL_MARGIN
const FOLD_CELL_H = FOLD_H + FOLD_ROW_MARGIN
const FOLD_COLS = 2
const FOLD_ROWS = Math.floor((PAGE_H - 1 * INCH) / FOLD_CELL_H)
const FOLD_PER_PAGE = FOLD_COLS * FOLD_ROWS
const FOLD_GRID_X = (PAGE_W - FOLD_COLS * FOLD_CELL_W + FOLD_COL_MARGIN) / 2
const FOLD_GRID_Y = (PAGE_H - FOLD_ROWS * FOLD_CELL_H + FOLD_ROW_MARGIN) / 2

function HeritageBatchFoldOverDoc({ entries }: { entries: HeritageInputs[] }) {
  const totalSheets = Math.ceil(entries.length / FOLD_PER_PAGE)
  const pages: React.ReactElement[] = []
  for (let sheet = 0; sheet < totalSheets; sheet++) {
    const slice = entries.slice(sheet * FOLD_PER_PAGE, (sheet + 1) * FOLD_PER_PAGE)
    pages.push(
      <Page key={sheet} size="LETTER" style={{ backgroundColor: '#FFFFFF' }}>
        <PageHeader pageType="front" pageNum={sheet + 1} totalPages={totalSheets} variant="custom" dims={'2.8" × 1.6" fold-over — Heritage'} />
        {slice.map((inputs, i) => {
          const x = FOLD_GRID_X + (i % FOLD_COLS) * FOLD_CELL_W
          const y = FOLD_GRID_Y + Math.floor(i / FOLD_COLS) * FOLD_CELL_H
          return <FoldPair key={i} inputs={inputs} x={x} y={y} />
        })}
        <GuidesLayer>
          {slice.map((_, i) => {
            const x = FOLD_GRID_X + (i % FOLD_COLS) * FOLD_CELL_W
            const y = FOLD_GRID_Y + Math.floor(i / FOLD_COLS) * FOLD_CELL_H
            return <FoldGuides key={i} x={x} y={y} />
          })}
        </GuidesLayer>
      </Page>,
    )
  }
  return <Document>{pages}</Document>
}

/** Batch duplex sheets (2×5 grid, mirrored backs). */
export async function generateBatchHeritageSlabLabelsVector(
  items: HeritageBatchItem[],
  pattern: BandPattern,
  gradeColors?: Record<string, string> | null,
): Promise<Blob> {
  const entries = await buildBatchInputs(items, pattern, gradeColors)
  return pdf(<HeritageBatchDuplexDoc entries={entries} /> as any).toBlob()
}

/** Batch fold-over sheets (single-sided). */
export async function generateBatchHeritageFoldOverLabelsVector(
  items: HeritageBatchItem[],
  pattern: BandPattern,
  gradeColors?: Record<string, string> | null,
): Promise<Blob> {
  const entries = await buildBatchInputs(items, pattern, gradeColors)
  return pdf(<HeritageBatchFoldOverDoc entries={entries} /> as any).toBlob()
}
