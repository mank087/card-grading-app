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
  /**
   * Target URL for the printed QR code. Enterprise callers pass the org's
   * branded card page (cardQrUrl) — the ORG serial on those labels doesn't
   * resolve at /verify/[serial]. Absent = DCM verify page for the serial.
   */
  qrUrl?: string
  /**
   * Physical label size. Absent = the standard 2.8" × 0.8" slot. Non-standard
   * sizes (Zion Mag Pro 2.51" × 0.76") render the SAME standard-authored
   * Heritage blocks through a scale transform — every element (text, band,
   * QR, badges, chip) keeps its exact layout, just smaller. Zion's aspect is
   * 3.30:1 vs the design's 3.5:1, so the scale is mildly anisotropic
   * (×0.896 w, ×0.95 h ⇒ ~6% relative vertical stretch) — imperceptible at
   * label sizes and well inside QR tolerance.
   */
  dims?: HeritageDims
}

export interface HeritageDims {
  widthIn: number
  heightIn: number
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
        return await QRCode.toDataURL(opts.qrUrl || `https://dcmgrading.com/verify/${data.serial}`, {
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

function HeritageProductionDoc({ inputs, d }: { inputs: HeritageInputs; d: HeritageDims }) {
  const chip = resolveGradeChip(inputs.grade, !!inputs.printHardened)
  const std = isStdDims(d)
  // Centre the (possibly non-standard) label on the page; at standard size
  // this equals SINGLE_X/SINGLE_Y. Centring keeps duplex mirroring exact.
  const x = std ? SINGLE_X : (PAGE_W - d.widthIn * INCH) / 2
  const y = std ? SINGLE_Y : (PAGE_H - d.heightIn * INCH) / 2
  const header = `${dimsLabel(d)} — Heritage`
  return (
    <Document>
      <Page size="LETTER" style={{ backgroundColor: '#FFFFFF' }}>
        <PageHeader pageType="front" pageNum={1} totalPages={1} variant="custom" dims={header} />
        {/* Duplex instruction — matches the standard vector sheet's PageHeader wording. */}
        <View style={{ position: 'absolute', top: 33, left: 50, right: 50, alignItems: 'center' }}>
          <Text style={{ fontSize: 7, color: '#9ca3af' }}>Print duplex (flip on long edge) • Cut along dotted lines</Text>
        </View>
        <PanelBleed x={x} y={y} inputs={inputs} d={d} />
        <HeritageLabelAt x={x} y={y} d={d}>
          <HeritageFront i={inputs} chip={chip} />
        </HeritageLabelAt>
        <GuidesLayer>
          {std ? <FrontCutGuides x={x} y={y} color={GUIDE_COLOR} /> : <DimsGuides x={x} y={y} d={d} />}
        </GuidesLayer>
      </Page>
      <Page size="LETTER" style={{ backgroundColor: '#FFFFFF' }}>
        <PageHeader pageType="back" pageNum={1} totalPages={1} variant="custom" dims={header} />
        <View style={{ position: 'absolute', top: 33, left: 50, right: 50, alignItems: 'center' }}>
          <Text style={{ fontSize: 7, color: '#9ca3af' }}>BACK SIDE • Print duplex (flip on long edge)</Text>
        </View>
        <PanelBleed x={x} y={y} inputs={inputs} d={d} />
        <HeritageLabelAt x={x} y={y} d={d}>
          <HeritageBack i={inputs} chip={chip} />
        </HeritageLabelAt>
        <GuidesLayer>
          {std ? <CornerMarks x={x} y={y} color={GUIDE_COLOR} /> : <DimsGuides x={x} y={y} d={d} cornersOnly />}
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
  return pdf(<HeritageProductionDoc inputs={inputs} d={resolveDims(opts.dims)} /> as any).toBlob()
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

// ---------------------------------------------------------------------------
// Non-standard sizes (Zion Mag Pro). The Heritage blocks are authored at the
// standard 2.8" × 0.8"; other sizes render them through a scale transform so
// nothing re-flows — see HeritageRenderOptions.dims.
// ---------------------------------------------------------------------------
const STD_DIMS: HeritageDims = { widthIn: 2.8, heightIn: 0.8 }
const isStdDims = (d: HeritageDims) =>
  Math.abs(d.widthIn - STD_DIMS.widthIn) < 0.001 && Math.abs(d.heightIn - STD_DIMS.heightIn) < 0.001
const resolveDims = (d?: HeritageDims): HeritageDims =>
  d && d.widthIn > 0 && d.heightIn > 0 ? d : STD_DIMS
const dimsLabel = (d: HeritageDims) => `${d.widthIn}" × ${d.heightIn}"`

/** A standard-authored Heritage panel scaled to the target physical size. */
function ScaledPanel({ d, children }: { d: HeritageDims; children: React.ReactNode }) {
  if (isStdDims(d)) return <>{children}</>
  const sx = d.widthIn / STD_DIMS.widthIn
  const sy = d.heightIn / STD_DIMS.heightIn
  return (
    <View style={{ width: d.widthIn * INCH, height: d.heightIn * INCH, overflow: 'hidden' }}>
      <View style={{ width: LABEL_W, height: LABEL_H, transform: `scale(${sx}, ${sy})`, transformOrigin: '0 0' }}>
        {children}
      </View>
    </View>
  )
}

/** Absolutely-positioned, size-aware label slot. */
function HeritageLabelAt({ x, y, d, children }: { x: number; y: number; d: HeritageDims; children: React.ReactNode }) {
  return (
    <View style={{ position: 'absolute', left: x, top: y, width: d.widthIn * INCH, height: d.heightIn * INCH }}>
      <ScaledPanel d={d}>{children}</ScaledPanel>
    </View>
  )
}

/** Size-aware cut guides: dashed rect (front) or corner ticks (back). */
function DimsGuides({ x, y, d, cornersOnly }: { x: number; y: number; d: HeritageDims; cornersOnly?: boolean }) {
  const w = d.widthIn * INCH
  const h = d.heightIn * INCH
  const m = 8
  if (!cornersOnly) {
    return <Rect x={x} y={y} width={w} height={h} fill="none" stroke={GUIDE_COLOR} strokeWidth={0.5} strokeDasharray="3 3" />
  }
  return (
    <>
      <Line x1={x - m} y1={y} x2={x} y2={y} stroke={GUIDE_COLOR} strokeWidth={0.5} />
      <Line x1={x} y1={y - m} x2={x} y2={y} stroke={GUIDE_COLOR} strokeWidth={0.5} />
      <Line x1={x + w} y1={y} x2={x + w + m} y2={y} stroke={GUIDE_COLOR} strokeWidth={0.5} />
      <Line x1={x + w} y1={y - m} x2={x + w} y2={y} stroke={GUIDE_COLOR} strokeWidth={0.5} />
      <Line x1={x - m} y1={y + h} x2={x} y2={y + h} stroke={GUIDE_COLOR} strokeWidth={0.5} />
      <Line x1={x} y1={y + h} x2={x} y2={y + h + m} stroke={GUIDE_COLOR} strokeWidth={0.5} />
      <Line x1={x + w} y1={y + h} x2={x + w + m} y2={y + h} stroke={GUIDE_COLOR} strokeWidth={0.5} />
      <Line x1={x + w} y1={y + h} x2={x + w} y2={y + h + m} stroke={GUIDE_COLOR} strokeWidth={0.5} />
    </>
  )
}

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
function PanelBleed({ x, y, inputs, d = STD_DIMS }: { x: number; y: number; inputs: HeritageInputs; d?: HeritageDims }) {
  const B = FOLD_BLEED
  const w = d.widthIn * INCH
  const h = d.heightIn * INCH
  const bandW = BAND_W_PT * (d.widthIn / STD_DIMS.widthIn)
  const field = heritageTheme(!!inputs.printHardened).field
  const band = inputs.bandColors?.[0] || '#101014'
  return (
    <>
      <View style={{ position: 'absolute', left: x - B, top: y - B, width: w + B * 2, height: h + B * 2, backgroundColor: field }} />
      <View style={{ position: 'absolute', left: x - B, top: y - B, width: B, height: h + B * 2, backgroundColor: band }} />
      <View style={{ position: 'absolute', left: x, top: y - B, width: bandW, height: B, backgroundColor: band }} />
      <View style={{ position: 'absolute', left: x, top: y + h, width: bandW, height: B, backgroundColor: band }} />
    </>
  )
}

/** One fold pair: rotated back over front, at (x, y) = top-left of the pair. */
function FoldPair({ inputs, x, y, d = STD_DIMS }: { inputs: HeritageInputs; x: number; y: number; d?: HeritageDims }) {
  const chip = resolveGradeChip(inputs.grade, !!inputs.printHardened)
  const B = FOLD_BLEED
  const w = d.widthIn * INCH
  const h = d.heightIn * INCH
  const pairH = h * 2
  const bandW = BAND_W_PT * (d.widthIn / STD_DIMS.widthIn)
  const field = heritageTheme(!!inputs.printHardened).field
  const band = inputs.bandColors?.[0] || '#101014'
  return (
    <>
      {/* field bleed under the whole pair (left/right/top/bottom overhang) */}
      <View style={{ position: 'absolute', left: x - B, top: y - B, width: w + B * 2, height: pairH + B * 2, backgroundColor: field }} />
      {/* band-colour bleed: front band sits on the pair's bottom-left edge;
          the 180°-rotated back puts its band on the top-right edge */}
      <View style={{ position: 'absolute', left: x - B, top: y + h, width: B, height: h + B, backgroundColor: band }} />
      <View style={{ position: 'absolute', left: x - B, top: y + pairH, width: B + bandW, height: B, backgroundColor: band }} />
      <View style={{ position: 'absolute', left: x + w, top: y - B, width: B, height: h + B, backgroundColor: band }} />
      <View style={{ position: 'absolute', left: x + w - bandW, top: y - B, width: B + bandW, height: B, backgroundColor: band }} />
      <View style={{ position: 'absolute', left: x, top: y, width: w, height: h, transform: 'rotate(180deg)' }}>
        <ScaledPanel d={d}>
          <HeritageBack i={inputs} chip={chip} />
        </ScaledPanel>
      </View>
      <View style={{ position: 'absolute', left: x, top: y + h, width: w, height: h }}>
        <ScaledPanel d={d}>
          <HeritageFront i={inputs} chip={chip} />
        </ScaledPanel>
      </View>
    </>
  )
}

/** Dashed cut outline around the pair + fold ticks at the seam (outside). */
function FoldGuides({ x, y, d = STD_DIMS }: { x: number; y: number; d?: HeritageDims }) {
  const w = d.widthIn * INCH
  const h = d.heightIn * INCH
  const foldY = y + h
  return (
    <>
      <Rect x={x} y={y} width={w} height={h * 2} fill="none"
        stroke={GUIDE_COLOR} strokeWidth={0.5} strokeDasharray="3 3" />
      <Line x1={x - 16} y1={foldY} x2={x - 4} y2={foldY} stroke="#bbbbbb" strokeWidth={0.8} />
      <Line x1={x + w + 4} y1={foldY} x2={x + w + 16} y2={foldY} stroke="#bbbbbb" strokeWidth={0.8} />
    </>
  )
}

function HeritageFoldOverDoc({ inputs, d }: { inputs: HeritageInputs; d: HeritageDims }) {
  const w = d.widthIn * INCH
  const pairH = d.heightIn * INCH * 2
  const x = (PAGE_W - w) / 2
  const y = (PAGE_H - pairH) / 2
  return (
    <Document>
      <Page size="LETTER" style={{ backgroundColor: '#FFFFFF' }}>
        <PageHeader pageType="front" pageNum={1} totalPages={1} variant="custom" dims={`${d.widthIn}" × ${(d.heightIn * 2).toFixed(2).replace(/0$/, '')}" — Heritage fold-over`} />
        <FoldPair inputs={inputs} x={x} y={y} d={d} />
        <GuidesLayer>
          <FoldGuides x={x} y={y} d={d} />
        </GuidesLayer>
        <Text style={{ position: 'absolute', left: x, top: y + pairH + 8, fontSize: 7, color: '#9ca3af' }}>
          {d.widthIn}&quot; × {(d.heightIn * 2).toFixed(2)}&quot; total — fold top panel behind front
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
  return pdf(<HeritageFoldOverDoc inputs={inputs} d={resolveDims(opts.dims)} /> as any).toBlob()
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
  /** Brand Setup mark size multiplier; 1 (DCM sizing) when absent. */
  logoScale?: number
  /** Per-card QR target URL (cardQrUrl); verify/serial when absent. */
  qrUrl?: string
}

async function buildBatchInputs(items: HeritageBatchItem[], pattern: BandPattern, gradeColors?: Record<string, string> | null): Promise<HeritageInputs[]> {
  const dcmBlack = await loadBlackLogoAsBase64().catch(() => null)
  return Promise.all(
    items.map(it => buildHeritageInputs(
      it.data,
      { bandColors: it.bandColors, pattern, gradeColors, logoScale: it.logoScale, qrUrl: it.qrUrl },
      it.logoBlack ?? dcmBlack,
    )),
  )
}

function HeritageBatchDuplexDoc({ entries, d }: { entries: HeritageInputs[]; d: HeritageDims }) {
  const std = isStdDims(d)
  // Non-standard labels centre inside the standard grid cell — the cells are
  // page-symmetric, so long-edge-flip duplex mirroring stays exact.
  const offX = std ? 0 : (LABEL_W - d.widthIn * INCH) / 2
  const offY = std ? 0 : (LABEL_H - d.heightIn * INCH) / 2
  const totalSheets = Math.ceil(entries.length / LABELS_PER_PAGE)
  const pages: React.ReactElement[] = []
  for (let sheet = 0; sheet < totalSheets; sheet++) {
    const slice = entries.slice(sheet * LABELS_PER_PAGE, (sheet + 1) * LABELS_PER_PAGE)
    pages.push(
      <Page key={`f-${sheet}`} size="LETTER" style={{ backgroundColor: '#FFFFFF' }}>
        {std
          ? <PageHeader pageType="front" pageNum={sheet + 1} totalPages={totalSheets} variant="standard" />
          : <PageHeader pageType="front" pageNum={sheet + 1} totalPages={totalSheets} variant="custom" dims={`${dimsLabel(d)} — Heritage`} />}
        {slice.map((inputs, i) => {
          const { x, y } = gridPos(i, false)
          const chip = resolveGradeChip(inputs.grade, !!inputs.printHardened)
          return (
            <React.Fragment key={i}>
              <PanelBleed x={x + offX} y={y + offY} inputs={inputs} d={d} />
              <HeritageLabelAt x={x + offX} y={y + offY} d={d}>
                <HeritageFront i={inputs} chip={chip} />
              </HeritageLabelAt>
            </React.Fragment>
          )
        })}
        <GuidesLayer>
          {slice.map((_, i) => {
            const { x, y } = gridPos(i, false)
            return std
              ? <FrontCutGuides key={i} x={x} y={y} color={GUIDE_COLOR} />
              : <DimsGuides key={i} x={x + offX} y={y + offY} d={d} />
          })}
        </GuidesLayer>
      </Page>,
    )
    pages.push(
      <Page key={`b-${sheet}`} size="LETTER" style={{ backgroundColor: '#FFFFFF' }}>
        {std
          ? <PageHeader pageType="back" pageNum={sheet + 1} totalPages={totalSheets} variant="standard" />
          : <PageHeader pageType="back" pageNum={sheet + 1} totalPages={totalSheets} variant="custom" dims={`${dimsLabel(d)} — Heritage`} />}
        {slice.map((inputs, i) => {
          const { x, y } = gridPos(i, true)
          const chip = resolveGradeChip(inputs.grade, !!inputs.printHardened)
          return (
            <React.Fragment key={i}>
              <PanelBleed x={x + offX} y={y + offY} inputs={inputs} d={d} />
              <HeritageLabelAt x={x + offX} y={y + offY} d={d}>
                <HeritageBack i={inputs} chip={chip} />
              </HeritageLabelAt>
            </React.Fragment>
          )
        })}
        <GuidesLayer>
          {slice.map((_, i) => {
            const { x, y } = gridPos(i, true)
            return std
              ? <CornerMarks key={i} x={x} y={y} color={GUIDE_COLOR} />
              : <DimsGuides key={i} x={x + offX} y={y + offY} d={d} cornersOnly />
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

function HeritageBatchFoldOverDoc({ entries, d }: { entries: HeritageInputs[]; d: HeritageDims }) {
  const std = isStdDims(d)
  // Non-standard pairs centre inside the standard fold cell.
  const offX = std ? 0 : (LABEL_W - d.widthIn * INCH) / 2
  const offY = std ? 0 : (FOLD_H - d.heightIn * INCH * 2) / 2
  const header = std
    ? '2.8" × 1.6" fold-over — Heritage'
    : `${d.widthIn}" × ${(d.heightIn * 2).toFixed(2)}" fold-over — Heritage`
  const totalSheets = Math.ceil(entries.length / FOLD_PER_PAGE)
  const pages: React.ReactElement[] = []
  for (let sheet = 0; sheet < totalSheets; sheet++) {
    const slice = entries.slice(sheet * FOLD_PER_PAGE, (sheet + 1) * FOLD_PER_PAGE)
    pages.push(
      <Page key={sheet} size="LETTER" style={{ backgroundColor: '#FFFFFF' }}>
        <PageHeader pageType="front" pageNum={sheet + 1} totalPages={totalSheets} variant="custom" dims={header} />
        {slice.map((inputs, i) => {
          const x = FOLD_GRID_X + (i % FOLD_COLS) * FOLD_CELL_W + offX
          const y = FOLD_GRID_Y + Math.floor(i / FOLD_COLS) * FOLD_CELL_H + offY
          return <FoldPair key={i} inputs={inputs} x={x} y={y} d={d} />
        })}
        <GuidesLayer>
          {slice.map((_, i) => {
            const x = FOLD_GRID_X + (i % FOLD_COLS) * FOLD_CELL_W + offX
            const y = FOLD_GRID_Y + Math.floor(i / FOLD_COLS) * FOLD_CELL_H + offY
            return <FoldGuides key={i} x={x} y={y} d={d} />
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
  dims?: HeritageDims,
): Promise<Blob> {
  const entries = await buildBatchInputs(items, pattern, gradeColors)
  return pdf(<HeritageBatchDuplexDoc entries={entries} d={resolveDims(dims)} /> as any).toBlob()
}

/** Batch fold-over sheets (single-sided). */
export async function generateBatchHeritageFoldOverLabelsVector(
  items: HeritageBatchItem[],
  pattern: BandPattern,
  gradeColors?: Record<string, string> | null,
  dims?: HeritageDims,
): Promise<Blob> {
  const entries = await buildBatchInputs(items, pattern, gradeColors)
  return pdf(<HeritageBatchFoldOverDoc entries={entries} d={resolveDims(dims)} /> as any).toBlob()
}
