/**
 * Production-faithful vector replica of the DCM Standard Slab Label
 * (Modern + Traditional themes). All dimensions, fonts, positions, and
 * colors match the canvas renderer in src/lib/slabLabelGenerator.ts so
 * print output can be compared apples-to-apples against the existing
 * production raster path.
 *
 * Geometry quick reference (production at 300 DPI -> PDF points):
 *
 *   1 inch                     = 72 pt
 *   1 px at 300 DPI            = 0.24 pt
 *
 *   LABEL_WIDTH                = 2.8 in  = 201.6 pt
 *   LABEL_HEIGHT               = 0.8 in  = 57.6 pt
 *   BLEED                      = 0.08 in = 5.76 pt
 *   CUT_MARGIN around label    = 0.25 in = 18 pt
 *
 *   Padding inside content     = 18 px   = 4.32 pt
 *   Logo size (55% of CH)      = 132 px  = 31.68 pt
 *   Text gap after logo        = 16 px   = 3.84 pt
 *   Grade area width           = 130 px  = 31.2 pt
 *   Grade right padding        = 38 px   = 9.12 pt
 *
 *   Grade font                 = 88 px   = 21.12 pt bold
 *   Condition font             = 24 px   = 5.76 pt bold (auto-shrinks)
 *
 * v2 of the lab uses a letter-sheet page so the PDF prints on regular
 * paper. The label sits centered with dashed cut guides + L-corner
 * marks identical to the production layout.
 *
 * Known gaps vs production canvas, to validate in print:
 *   - Text stroke. Production strokes name/context/features/serial/grade
 *     in 0.6 alpha black for legibility on the gradient. react-pdf <Text>
 *     does not support stroke; we approximate with a softer textShadow.
 *     If print testing shows this is the wrong call, we move dark-theme
 *     text into <Svg><Text stroke> in a follow-up.
 *   - Subgrade rendering on back is identical to production (4-line text
 *     list, not boxed).
 *   - Decorative emblems on the back (Founder / VIP / Card Lover) are
 *     deferred; we render the placeholders so the layout sits where it
 *     would be in production.
 */

import React from 'react'
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Svg,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Rect,
  Line,
  Path,
} from '@react-pdf/renderer'
import { printColorTweaksHex } from './contrastWCAG'

// ------- Geometry -------

const INCH = 72

const LABEL_WIDTH = 2.8 * INCH      // 201.6
const LABEL_HEIGHT = 0.8 * INCH     // 57.6
const BLEED = 0.08 * INCH           // 5.76
const CUT_MARGIN = 0.25 * INCH      // 18 (margin AROUND the bleeding label)

const PAGE_WIDTH = 8.5 * INCH       // 612
const PAGE_HEIGHT = 11 * INCH       // 792

// Position the label centered on letter portrait. The label fills the
// 2.8 x 0.8 rectangle; the bleeding background extends BLEED past it on
// all sides; cut guides + scissor glyphs live in the CUT_MARGIN ring.
const LABEL_X = (PAGE_WIDTH - LABEL_WIDTH) / 2
const LABEL_Y = (PAGE_HEIGHT - LABEL_HEIGHT) / 2

// Helper: convert canvas pixels at 300 DPI into PDF points.
const px = (n: number) => n * 0.24

// Inset values in content (matches production canvas constants).
const PADDING = px(18)               // 4.32
const LOGO_SIZE = px(132)            // 31.68 (= 55% of label height)
const TEXT_LOGO_GAP = px(16)         // 3.84
const GRADE_AREA_WIDTH = px(130)     // 31.2
const GRADE_RIGHT_PADDING = px(38)   // 9.12

// Font sizes in PT
const GRADE_PT = px(88)              // 21.12
const CONDITION_PT_MAX = px(24)      // 5.76
const CONDITION_PT_MIN = px(12)      // 2.88

// Name auto-fit window (production: 14-38 px)
const NAME_PT_MAX = px(38)           // 9.12
const NAME_PT_MIN = px(14)           // 3.36
// Production multipliers:
const CONTEXT_FACTOR = 0.76
const FEATURES_FACTOR = 0.70
const SERIAL_FACTOR = 0.76

// ------- Theme palettes (identical hex to production) -------

// Note: react-pdf's <Text> style type does NOT include textShadow, so we
// cannot port production's canvas strokeText() halo directly. The proper
// fix is to render dark-theme text as <Svg><Text stroke=...> instead of
// <Text>, which loses flex layout. Tracked as a v3 follow-up. For v2 we
// rely on the gradient's natural contrast against pure white text.
const MODERN = {
  bgDark1: '#1a1625',
  bgDark2: '#2d1f47',
  // Radial glow overlay. MUST stay hex + separate opacity: react-pdf's SVG
  // fill parser silently breaks on rgba() strings and corrupts the whole
  // Svg paint (everything renders solid green) — see
  // scripts/test-gradient-isolation.tsx for the repro.
  glowHex: '#8b5cf6',
  glowOpacity: 0.1,
  textWhite: '#FFFFFF',
  textWhiteMuted: 'rgba(255,255,255,0.7)',
  textGreen: 'rgba(34,197,94,0.9)',
  cutGuide: '#FFFFFF',
}
const TRADITIONAL = {
  bgGradStart: '#f9fafb',
  bgGradEnd: '#ffffff',
  textDark: '#1f2937',
  textMedium: '#4b5563',
  featureBlue: '#2563eb',
  purplePrimary: '#7c3aed',
  purpleDark: '#6b46c1',
  cutGuide: '#000000',
}

// ------- Inputs -------

export type SlabTheme = 'modern' | 'traditional'

export interface SlabLabelInputs {
  theme: SlabTheme
  // Card content (matches src/lib/slabLabelGenerator.ts SlabLabelData)
  primaryName: string
  contextLine: string          // "Topps Chrome • #246 • 2024"
  featuresLine?: string        // "RC • Refractor"
  serial: string               // "DCM-XXXXXXXX"
  grade: string                // "10" or "Authentic"
  condition: string            // "Gem Mint"
  // Sub-grades (back)
  subgrades?: {
    centering?: number | null
    corners?: number | null
    edges?: number | null
    surface?: number | null
  }
  // Logos as data URLs (fetch + toBase64 before rendering — see LabelLabClient)
  whiteLogoDataUrl?: string | null
  colorLogoDataUrl?: string | null
  // QR data URL (back; optional placeholder for now)
  qrCodeDataUrl?: string | null
  // Card images (used by some downstream formats; slab labels don't show them)
  // Print color tweak intensity (0 = none, 1 = full)
  printColorTweakIntensity?: number
}

// ------- Public document -------

export function SlabLabelPdfDoc(inputs: SlabLabelInputs) {
  return (
    <Document>
      <FrontPage {...inputs} />
      <BackPage {...inputs} />
    </Document>
  )
}

// ============================================================================
// FRONT PAGE
// ============================================================================

function FrontPage(inputs: SlabLabelInputs) {
  return (
    <Page size={{ width: PAGE_WIDTH, height: PAGE_HEIGHT }} style={styles.page}>
      <LetterSheetWithCutGuides theme={inputs.theme}>
        <SlabFrontLabelBlock inputs={inputs} idSuffix="f" />
      </LetterSheetWithCutGuides>
    </Page>
  )
}

/**
 * Front label content (gradient background + logo | text | grade row) at
 * exact label size with no page chrome. Exported so the calibration sheet
 * can place the identical block this production-replica page uses. The
 * parent must be a View sized LABEL_WIDTH x LABEL_HEIGHT — the absolute-
 * positioned children anchor to it. `idSuffix` keeps the SVG gradient ids
 * unique when several blocks render in one document.
 */
export function SlabFrontLabelBlock({ inputs, idSuffix }: { inputs: SlabLabelInputs; idSuffix: string }) {
  const theme = inputs.theme
  const isModern = theme === 'modern'

  // Apply print color tweaks to the dark-theme gradient stops; light theme
  // is already paper white so the tweak has no useful effect.
  const intensity = inputs.printColorTweakIntensity ?? 0.5
  const dark1 = isModern && intensity > 0 ? printColorTweaksHex(MODERN.bgDark1, intensity) : MODERN.bgDark1
  const dark2 = isModern && intensity > 0 ? printColorTweaksHex(MODERN.bgDark2, intensity) : MODERN.bgDark2

  // Auto-fit name and child sizes (production fitCardInfoFonts).
  const textRegionWidth = LABEL_WIDTH - PADDING - LOGO_SIZE - TEXT_LOGO_GAP - GRADE_AREA_WIDTH - GRADE_RIGHT_PADDING
  const namePt = fitFontSize(inputs.primaryName || 'Card', textRegionWidth, NAME_PT_MAX, NAME_PT_MIN, true)
  const contextPt = namePt * CONTEXT_FACTOR
  const featuresPt = namePt * FEATURES_FACTOR
  const serialPt = namePt * SERIAL_FACTOR

  return (
    <>
      <LabelBackground theme={theme} dark1={dark1} dark2={dark2} idSuffix={idSuffix} />

        {/* Content row: logo | text stack | grade */}
        <View style={styles.contentRow}>
          {/* Left: logo */}
          <View style={styles.logoSlot}>
            <LogoSlot theme={theme} inputs={inputs} />
          </View>

          {/* Center: text stack vertically centered */}
          <View style={styles.textColumn}>
            <View style={styles.textInner}>
              <Text
                style={{
                  fontFamily: 'Helvetica-Bold',
                  fontSize: namePt,
                  color: isModern ? MODERN.textWhite : TRADITIONAL.textDark,
                  lineHeight: 1.05,
                }}
              >
                {inputs.primaryName}
              </Text>
              {inputs.contextLine ? (
                <Text
                  style={{
                    fontFamily: 'Helvetica',
                    fontSize: contextPt,
                    color: isModern ? MODERN.textWhiteMuted : TRADITIONAL.textMedium,
                      marginTop: contextPt * 0.25,
                    lineHeight: 1.1,
                  }}
                >
                  {inputs.contextLine}
                </Text>
              ) : null}
              {inputs.featuresLine ? (
                <Text
                  style={{
                    fontFamily: 'Helvetica-Bold',
                    fontSize: featuresPt,
                    color: isModern ? MODERN.textGreen : TRADITIONAL.featureBlue,
                      marginTop: featuresPt * 0.25,
                    lineHeight: 1.1,
                  }}
                >
                  {inputs.featuresLine}
                </Text>
              ) : null}
              <Text
                style={{
                  fontFamily: 'Helvetica',
                  fontSize: serialPt,
                  color: isModern ? MODERN.textWhiteMuted : TRADITIONAL.textMedium,
                  marginTop: serialPt * 0.45,
                  lineHeight: 1.05,
                }}
              >
                {inputs.serial}
              </Text>
            </View>
          </View>

          {/* Right: grade + condition */}
          <View style={styles.gradeSlot}>
            <View style={styles.gradeInner}>
              <Text
                style={{
                  fontFamily: 'Helvetica-Bold',
                  fontSize: GRADE_PT,
                  color: isModern ? MODERN.textWhite : TRADITIONAL.purplePrimary,
                  textAlign: 'center',
                  lineHeight: 1,
                }}
              >
                {inputs.grade}
              </Text>
              {!isModern ? (
                <Svg
                  style={{ width: 22.4, height: 2, marginTop: 1.6 }}
                  viewBox="0 0 22.4 2"
                >
                  <Line
                    x1={0}
                    y1={1}
                    x2={22.4}
                    y2={1}
                    stroke={TRADITIONAL.purplePrimary}
                    strokeWidth={1}
                  />
                </Svg>
              ) : null}
              <Text
                style={{
                  fontFamily: 'Helvetica-Bold',
                  fontSize: fitConditionSize(inputs.condition, GRADE_AREA_WIDTH + 4),
                  color: isModern ? 'rgba(255,255,255,0.85)' : TRADITIONAL.purpleDark,
                  textAlign: 'center',
                  marginTop: 2,
                  letterSpacing: 0.4,
                }}
              >
                {(inputs.condition || '').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
    </>
  )
}

// ============================================================================
// BACK PAGE
// ============================================================================

function BackPage(inputs: SlabLabelInputs) {
  const theme = inputs.theme
  const isModern = theme === 'modern'
  const intensity = inputs.printColorTweakIntensity ?? 0.5
  const dark1 = isModern && intensity > 0 ? printColorTweaksHex(MODERN.bgDark1, intensity) : MODERN.bgDark1
  const dark2 = isModern && intensity > 0 ? printColorTweaksHex(MODERN.bgDark2, intensity) : MODERN.bgDark2

  // Sub-score rows mirror production's right-aligned text block.
  const subPt = px(26) // 6.24 pt
  const subLineHeight = px(36) // 8.64 pt

  return (
    <Page size={{ width: PAGE_WIDTH, height: PAGE_HEIGHT }} style={styles.page}>
      <LetterSheetWithCutGuides theme={theme}>
        <LabelBackground theme={theme} dark1={dark1} dark2={dark2} idSuffix="b" />

        <View style={styles.contentRow}>
          {/* Left: QR placeholder + emblems lane */}
          <View style={[styles.logoSlot, { width: LOGO_SIZE + px(36) /* +36px for emblem strip */ }]}>
            <View
              style={{
                width: LOGO_SIZE,
                height: LOGO_SIZE,
                borderRadius: 1.5,
                backgroundColor: isModern ? 'rgba(255,255,255,0.06)' : '#ffffff',
                borderWidth: 0.5,
                // Hex, not rgba — rgba borderColor hits the same react-pdf
                // parser bug as SVG fills and paints green.
                borderColor: isModern ? '#8b5cf6' : '#7c3aed',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {inputs.qrCodeDataUrl ? (
                <Image src={inputs.qrCodeDataUrl} style={{ width: LOGO_SIZE - 2, height: LOGO_SIZE - 2 }} />
              ) : (
                <Text
                  style={{
                    fontSize: px(14),
                    color: isModern ? 'rgba(255,255,255,0.5)' : '#9ca3af',
                    fontFamily: 'Helvetica',
                  }}
                >
                  QR
                </Text>
              )}
            </View>
          </View>

          {/* Center: grade + condition (matches front) */}
          <View style={styles.textColumn}>
            <View style={[styles.textInner, { alignItems: 'center' }]}>
              <Text
                style={{
                  fontFamily: 'Helvetica-Bold',
                  fontSize: GRADE_PT,
                  color: isModern ? MODERN.textWhite : TRADITIONAL.purplePrimary,
                  lineHeight: 1,
                }}
              >
                {inputs.grade}
              </Text>
              {!isModern ? (
                <Svg style={{ width: 22.4, height: 2, marginTop: 1.6 }} viewBox="0 0 22.4 2">
                  <Line x1={0} y1={1} x2={22.4} y2={1} stroke={TRADITIONAL.purplePrimary} strokeWidth={1} />
                </Svg>
              ) : null}
              <Text
                style={{
                  fontFamily: 'Helvetica-Bold',
                  fontSize: fitConditionSize(inputs.condition, GRADE_AREA_WIDTH + 4),
                  color: isModern ? 'rgba(255,255,255,0.85)' : TRADITIONAL.purpleDark,
                  textAlign: 'center',
                  marginTop: 2,
                  letterSpacing: 0.4,
                }}
              >
                {(inputs.condition || '').toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Right: subgrades, right-aligned (matches production back) */}
          <View style={[styles.gradeSlot, { width: GRADE_AREA_WIDTH + px(70) /* roomier on back */ }]}>
            {/* No flex:1 here — the parent's height is auto, so flex:1
                collapses to zero height and center-stacks all four lines on
                top of each other. alignSelf stretch keeps textAlign right
                meaningful across the full slot width. */}
            <View style={{ alignSelf: 'stretch', justifyContent: 'center' }}>
              {(['centering', 'corners', 'edges', 'surface'] as const).map((k) => {
                const v = inputs.subgrades?.[k]
                return (
                  <Text
                    key={k}
                    style={{
                      fontFamily: 'Helvetica',
                      fontSize: subPt,
                      color: isModern ? 'rgba(255,255,255,0.95)' : TRADITIONAL.textMedium,
                          textAlign: 'right',
                      paddingRight: GRADE_RIGHT_PADDING,
                      lineHeight: subLineHeight / subPt,
                    }}
                  >
                    {labelOf(k)}: {v != null ? String(v) : '—'}
                  </Text>
                )
              })}
            </View>
          </View>
        </View>
      </LetterSheetWithCutGuides>
    </Page>
  )
}

// ============================================================================
// Letter sheet wrapper with cut guides
// ============================================================================

function LetterSheetWithCutGuides({
  theme,
  children,
}: {
  theme: SlabTheme
  children: React.ReactNode
}) {
  const cutColor = theme === 'modern' ? MODERN.cutGuide : TRADITIONAL.cutGuide

  // Cut box sits along the LABEL edge (not the bleed). The bleed is
  // intentionally trimmed off when the user cuts on the dashed line.
  return (
    <>
      {/* Cut guides — dashed rectangle and L-corner marks via SVG. The
          children render the label content INSIDE the cut box. */}
      <Svg
        style={{ position: 'absolute', top: 0, left: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT }}
        viewBox={`0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}`}
      >
        {/* Cut rectangle (dashed) */}
        <Rect
          x={LABEL_X}
          y={LABEL_Y}
          width={LABEL_WIDTH}
          height={LABEL_HEIGHT}
          fill="none"
          stroke={cutColor}
          strokeWidth={0.5}
          strokeDasharray="2 2"
        />

        {/* L-corner marks (4 corners, length 7 pt) */}
        {(() => {
          const L = 7
          const off = 3
          const lines = [
            // top-left
            [LABEL_X - off, LABEL_Y - off, LABEL_X + L - off, LABEL_Y - off],
            [LABEL_X - off, LABEL_Y - off, LABEL_X - off, LABEL_Y + L - off],
            // top-right
            [LABEL_X + LABEL_WIDTH + off, LABEL_Y - off, LABEL_X + LABEL_WIDTH - L + off, LABEL_Y - off],
            [LABEL_X + LABEL_WIDTH + off, LABEL_Y - off, LABEL_X + LABEL_WIDTH + off, LABEL_Y + L - off],
            // bottom-left
            [LABEL_X - off, LABEL_Y + LABEL_HEIGHT + off, LABEL_X + L - off, LABEL_Y + LABEL_HEIGHT + off],
            [LABEL_X - off, LABEL_Y + LABEL_HEIGHT + off, LABEL_X - off, LABEL_Y + LABEL_HEIGHT - L + off],
            // bottom-right
            [LABEL_X + LABEL_WIDTH + off, LABEL_Y + LABEL_HEIGHT + off, LABEL_X + LABEL_WIDTH - L + off, LABEL_Y + LABEL_HEIGHT + off],
            [LABEL_X + LABEL_WIDTH + off, LABEL_Y + LABEL_HEIGHT + off, LABEL_X + LABEL_WIDTH + off, LABEL_Y + LABEL_HEIGHT - L + off],
          ]
          return lines.map((p, i) => (
            <Line
              key={i}
              x1={p[0]}
              y1={p[1]}
              x2={p[2]}
              y2={p[3]}
              stroke={cutColor}
              strokeWidth={0.5}
            />
          ))
        })()}

        {/* Scissor glyph in the cut margin (lower-left corner of the label cell). */}
        <Path
          d="M 4 -1 L 6 -3 M 4 1 L 6 3 M 5 0 L 12 0"
          stroke={cutColor}
          strokeWidth={0.6}
          fill="none"
          transform={`translate(${LABEL_X - 14} ${LABEL_Y + LABEL_HEIGHT + 8})`}
        />
      </Svg>

      {/* Label content positioned absolutely on the page */}
      <View
        style={{
          position: 'absolute',
          left: LABEL_X,
          top: LABEL_Y,
          width: LABEL_WIDTH,
          height: LABEL_HEIGHT,
        }}
      >
        {children}
      </View>
    </>
  )
}

// ============================================================================
// Background layer with bleed
// ============================================================================

function LabelBackground({
  theme,
  dark1,
  dark2,
  idSuffix,
}: {
  theme: SlabTheme
  dark1: string
  dark2: string
  idSuffix: string
}) {
  // Background extends past the label edge by BLEED on every side, so when
  // the user cuts on the dashed cut line they don't see a paper-white edge.
  // The label container is sized exactly to LABEL_WIDTH x LABEL_HEIGHT and
  // positioned at (LABEL_X, LABEL_Y); we draw the bleed as an SVG that
  // expands past those bounds and then clip with overflow hidden... but
  // react-pdf doesn't honor overflow. So instead, the SVG is sized to fit
  // exactly the label rect (no bleed); the bleed is drawn via a separate
  // background <View> on the page itself in v3 once we audit edge fidelity.
  // For v2: a full-rect SVG that matches the label edges. Print test on
  // real paper to decide whether bleed matters for the lab vector path.

  return (
    <Svg
      style={{ position: 'absolute', top: 0, left: 0, width: LABEL_WIDTH, height: LABEL_HEIGHT }}
      viewBox={`0 0 ${LABEL_WIDTH} ${LABEL_HEIGHT}`}
    >
      <Defs>
        <SvgLinearGradient id={`slab-grad-${idSuffix}`} x1="0%" y1="0%" x2="100%" y2="100%">
          {theme === 'modern' ? (
            <>
              <Stop offset="0%" stopColor={dark1} />
              <Stop offset="50%" stopColor={dark2} />
              <Stop offset="100%" stopColor={dark1} />
            </>
          ) : (
            <>
              <Stop offset="0%" stopColor={TRADITIONAL.bgGradStart} />
              <Stop offset="100%" stopColor={TRADITIONAL.bgGradEnd} />
            </>
          )}
        </SvgLinearGradient>
      </Defs>
      <Rect x={0} y={0} width={LABEL_WIDTH} height={LABEL_HEIGHT} fill={`url(#slab-grad-${idSuffix})`} />
      {theme === 'modern' ? (
        // Radial purple glow overlay matches production's createRadialGradient.
        // react-pdf SVG doesn't support radialGradient natively; we
        // approximate with a low-opacity full-rect fill. fillOpacity (NOT an
        // rgba fill string) is load-bearing — see MODERN.glowHex comment.
        <Rect x={0} y={0} width={LABEL_WIDTH} height={LABEL_HEIGHT} fill={MODERN.glowHex} fillOpacity={MODERN.glowOpacity} />
      ) : null}
    </Svg>
  )
}

// ============================================================================
// Logo slot
// ============================================================================

function LogoSlot({ theme, inputs }: { theme: SlabTheme; inputs: SlabLabelInputs }) {
  const isModern = theme === 'modern'
  const src = isModern ? inputs.whiteLogoDataUrl : inputs.colorLogoDataUrl
  if (src) {
    return <Image src={src} style={{ width: LOGO_SIZE, height: LOGO_SIZE }} />
  }
  // Placeholder text logo when assets haven't loaded yet
  return (
    <View
      style={{
        width: LOGO_SIZE,
        height: LOGO_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: 'Helvetica-Bold',
          fontSize: px(36),
          color: isModern ? '#FFFFFF' : '#7c3aed',
          letterSpacing: 1,
        }}
      >
        DCM
      </Text>
    </View>
  )
}

// ============================================================================
// Layout styles
// ============================================================================

const styles = StyleSheet.create({
  page: {
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    backgroundColor: '#FFFFFF',
    padding: 0,
  },
  contentRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: LABEL_WIDTH,
    height: LABEL_HEIGHT,
    flexDirection: 'row',
    paddingLeft: PADDING,
    paddingRight: GRADE_RIGHT_PADDING,
    paddingTop: 0,
    paddingBottom: 0,
    alignItems: 'center',
  },
  logoSlot: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
    paddingLeft: TEXT_LOGO_GAP,
    paddingRight: 4,
    justifyContent: 'center',
    height: LABEL_HEIGHT,
  },
  textInner: {
    justifyContent: 'center',
  },
  gradeSlot: {
    width: GRADE_AREA_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})

// ============================================================================
// Helpers
// ============================================================================

/**
 * Estimate the largest font size at which `text` will fit `maxWidth`.
 * Uses an em-width heuristic per font weight. This is the JS-side stand-
 * in for production's canvas measureText() font-fitting loop.
 */
function fitFontSize(
  text: string,
  maxWidth: number,
  maxPt: number,
  minPt: number,
  bold = true,
): number {
  const emFactor = bold ? 0.58 : 0.52
  const len = (text || ' ').length
  let pt = maxPt
  while (pt > minPt && len * pt * emFactor > maxWidth) {
    pt -= 0.25
  }
  return Math.max(minPt, pt)
}

/** Condition auto-shrinks like production (24 down to 12 px). */
function fitConditionSize(text: string, maxWidth: number): number {
  return fitFontSize((text || '').toUpperCase(), maxWidth, CONDITION_PT_MAX, CONDITION_PT_MIN, true)
}

function labelOf(k: 'centering' | 'corners' | 'edges' | 'surface'): string {
  switch (k) {
    case 'centering': return 'Centering'
    case 'corners': return 'Corners'
    case 'edges': return 'Edges'
    case 'surface': return 'Surface'
  }
}

// ============================================================================
// Calibration-sheet exports
// ============================================================================

// The calibration sheet places SlabFrontLabelBlock at exact label size and
// draws its own gradient swatches with the same stops as the modern theme.
export const SLAB_LABEL_W_PT = LABEL_WIDTH
export const SLAB_LABEL_H_PT = LABEL_HEIGHT
export const SLAB_BLEED_PT = BLEED
export const MODERN_GRADIENT_HEX = { start: MODERN.bgDark1, mid: MODERN.bgDark2 }
