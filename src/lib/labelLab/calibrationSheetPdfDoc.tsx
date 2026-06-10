/**
 * Print Calibration Sheet — single-page test matrix for the Label Lab.
 *
 * Before this sheet, paper tests were one-variable-per-print: pick a card,
 * pick a theme, pick a tweak intensity, print, repeat. This packs every
 * print-risk variable onto ONE letter page so a single pass through a
 * printer yields the full dataset:
 *
 *   A. Raster vs vector A/B — the production canvas JPEG (300 DPI, exactly
 *      what users download today) placed next to the react-pdf vector
 *      replica at identical physical size. Same sheet, same pass, so
 *      printer state can't confound the comparison.
 *   B. Knockout-text size ladder — white text on the modern gradient at
 *      3.5–12 pt. Dot gain bleeds ink into knocked-out letterforms; this
 *      finds the real legibility floor. Production's name auto-shrink
 *      currently bottoms out at 14 px = 3.36 pt, which is suspect.
 *   C. Tweak-intensity strip — the print color tweak at 0–100% darken PLUS
 *      two lighten variants. Darkening raises WCAG contrast but adds ink
 *      coverage (more dot gain into knockout text); lightening trades
 *      contrast for less ink. Paper decides which direction wins.
 *   D. Halo test — plain knockout text vs a duplicate-render soft halo
 *      approximating production's canvas strokeText(). Gates the v3
 *      SVG-stroke work: if paper shows no difference, we skip it.
 *   E. Footer — 3-inch scale ruler (verifies "Actual size" printing) and
 *      write-in fields for printer / paper / quality / date so a stack of
 *      test sheets from different printers stays attributable.
 */

import React from 'react'
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Svg,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Rect,
  Line,
} from '@react-pdf/renderer'
import {
  parseHex,
  toHex,
  printColorTweaksHex,
  sampleGradientContrast,
} from './contrastWCAG'
import {
  SlabFrontLabelBlock,
  SLAB_LABEL_W_PT,
  SLAB_LABEL_H_PT,
  SLAB_BLEED_PT,
  MODERN_GRADIENT_HEX,
  type SlabLabelInputs,
} from './slabLabelPdfDoc'

// ------- Geometry -------

const MARGIN = 36
const CONTENT_W = 612 - MARGIN * 2 // 540

// Production raster includes the bleed ring: (2.8 + 0.08*2) x (0.8 + 0.08*2) in.
const RASTER_W = SLAB_LABEL_W_PT + SLAB_BLEED_PT * 2 // 213.12
const RASTER_H = SLAB_LABEL_H_PT + SLAB_BLEED_PT * 2 // 69.12

// Knockout ladder sizes in pt. 3.36 pt is production's current auto-shrink
// floor (14 px at 300 DPI); 12 pt is comfortably safe. The px figure shown
// on the sheet is the 300 DPI canvas equivalent (pt / 0.24).
const LADDER_SIZES = [3.5, 4, 5, 6, 7, 9, 12]

// ------- Inputs -------

export interface CalibrationSheetInputs {
  slabInputs: Omit<SlabLabelInputs, 'theme'>
  /** Production canvas JPEG data URLs (renderFrontLabelCanvas output). */
  rasterModernDataUrl?: string | null
  rasterTraditionalDataUrl?: string | null
}

// ------- Tweak strip rows -------

function lightenHex(hex: string, amount: number): string {
  const rgb = parseHex(hex)
  if (!rgb) return hex
  return toHex({
    r: rgb.r + (255 - rgb.r) * amount,
    g: rgb.g + (255 - rgb.g) * amount,
    b: rgb.b + (255 - rgb.b) * amount,
  })
}

const TWEAK_ROWS: { label: string; transform: (hex: string) => string }[] = [
  { label: 'Lighten 20%', transform: h => lightenHex(h, 0.2) },
  { label: 'Lighten 10%', transform: h => lightenHex(h, 0.1) },
  { label: '0% — production', transform: h => h },
  { label: 'Darken 25%', transform: h => printColorTweaksHex(h, 0.25) },
  { label: 'Darken 50% — default', transform: h => printColorTweaksHex(h, 0.5) },
  { label: 'Darken 75%', transform: h => printColorTweaksHex(h, 0.75) },
  { label: 'Darken 100%', transform: h => printColorTweaksHex(h, 1) },
]

// ============================================================================
// Document
// ============================================================================

export function CalibrationSheetPdfDoc(inputs: CalibrationSheetInputs) {
  const { slabInputs, rasterModernDataUrl, rasterTraditionalDataUrl } = inputs

  return (
    <Document>
      <Page size="LETTER" style={{ padding: MARGIN, backgroundColor: '#FFFFFF' }}>
        {/* Header */}
        <View style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#111827' }}>
            DCM Label Lab — Print Calibration Sheet
          </Text>
          <Text style={{ fontSize: 6, color: '#6b7280', marginTop: 2 }}>
            Card: {slabInputs.serial} · One printer pass answers: raster-vs-vector sharpness (A),
            knockout-text size floor (B), tweak direction (C), halo necessity (D).
            Print on letter at 100% scale — verify with the ruler in E, then fill in the print settings.
          </Text>
        </View>

        {/* A — Raster vs vector */}
        <View wrap={false} style={{ marginBottom: 9 }}>
          <SectionHead
            tag="A"
            title="Raster vs vector — same sheet, same pass"
            hint="Loupe the serial and context lines. Letterforms differ slightly (canvas Arial vs PDF base-14 Helvetica) — judge edge sharpness and ink spread, not letter shape. Both untweaked."
          />
          <AbRow
            themeLabel="Modern"
            theme="modern"
            raster={rasterModernDataUrl}
            slabInputs={slabInputs}
            idSuffix="cal-ab-m"
          />
          <AbRow
            themeLabel="Traditional"
            theme="traditional"
            raster={rasterTraditionalDataUrl}
            slabInputs={slabInputs}
            idSuffix="cal-ab-t"
          />
        </View>

        {/* B — Knockout size ladder */}
        <View wrap={false} style={{ marginBottom: 9 }}>
          <SectionHead
            tag="B"
            title="Knockout-text size ladder (white on modern gradient)"
            hint="Find the smallest row where the regular weight stays legible — that's the print floor. Production name auto-shrink bottoms out at 3.36 pt (14 px); if that row fails here, the floor must be raised."
          />
          <GradientSwatch id="cal-ladder" d1={MODERN_GRADIENT_HEX.start} d2={MODERN_GRADIENT_HEX.mid} w={CONTENT_W} h={86}>
            <View style={{ paddingHorizontal: 10, paddingVertical: 4 }}>
              {LADDER_SIZES.map((s, i) => (
                <Text
                  key={s}
                  style={{
                    fontSize: s,
                    fontFamily: 'Helvetica',
                    color: '#FFFFFF',
                    lineHeight: 1.15,
                    marginBottom: i === LADDER_SIZES.length - 1 ? 0 : 3,
                  }}
                >
                  <Text style={{ fontSize: 5, color: 'rgba(255,255,255,0.55)' }}>
                    {`${s}pt/${Math.round(s / 0.24)}px  `}
                  </Text>
                  {`Mint 10 · ${slabInputs.serial} · 0123456789 `}
                  <Text style={{ fontFamily: 'Helvetica-Bold' }}>{`· bold ${slabInputs.serial}`}</Text>
                </Text>
              ))}
            </View>
          </GradientSwatch>
        </View>

        {/* C — Tweak intensity strip */}
        <View wrap={false} style={{ marginBottom: 9 }}>
          <SectionHead
            tag="C"
            title="Print color tweak — darken vs lighten"
            hint="Darkening raises contrast on screen but lays more ink (more dot gain eating the knockout text). Lightening lays less ink at lower contrast. Pick the row where the sample text prints cleanest. Ratios are WCAG vs white; print target is 7:1."
          />
          {TWEAK_ROWS.map((row, i) => {
            const d1 = row.transform(MODERN_GRADIENT_HEX.start)
            const d2 = row.transform(MODERN_GRADIENT_HEX.mid)
            const min = sampleGradientContrast(d1, d2, '#FFFFFF', { samples: 5, threshold: 7 }).minRatio
            return (
              <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', marginTop: i === 0 ? 2 : 3 }}>
                <Text
                  style={{
                    width: 86,
                    fontSize: 5.5,
                    color: '#374151',
                    textAlign: 'right',
                    paddingRight: 5,
                  }}
                >
                  {row.label}
                </Text>
                <GradientSwatch id={`cal-tw-${i}`} d1={d1} d2={d2} w={CONTENT_W - 86 - 56} h={17}>
                  <Text
                    style={{
                      fontSize: 6.5,
                      fontFamily: 'Helvetica-Bold',
                      color: '#FFFFFF',
                      textAlign: 'center',
                    }}
                  >
                    {`${slabInputs.grade} ${slabInputs.condition.toUpperCase()} · ${slabInputs.serial}`}
                  </Text>
                </GradientSwatch>
                <Text style={{ width: 56, fontSize: 5.5, color: min >= 7 ? '#15803d' : '#b45309', paddingLeft: 5 }}>
                  {`min ${min.toFixed(1)}:1`}
                </Text>
              </View>
            )
          })}
        </View>

        {/* D — Halo test */}
        <View wrap={false} style={{ marginBottom: 9 }}>
          <SectionHead
            tag="D"
            title="Halo test — plain vs duplicate-render soft halo"
            hint="Production canvas strokes text in 0.6-alpha black; react-pdf can't. The halo here is the duplicate-render approximation. If plain and halo print equally legible, the v3 SVG-stroke work is unnecessary."
          />
          <GradientSwatch id="cal-halo" d1={MODERN_GRADIENT_HEX.start} d2={MODERN_GRADIENT_HEX.mid} w={CONTENT_W} h={38}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
              <HaloSample text={`${slabInputs.serial} 10`} size={4.5} halo={false} label="plain · 4.5pt" />
              <HaloSample text={`${slabInputs.serial} 10`} size={4.5} halo={true} label="halo · 4.5pt" />
              <HaloSample text={`${slabInputs.serial} 10`} size={7} halo={false} label="plain · 7pt" />
              <HaloSample text={`${slabInputs.serial} 10`} size={7} halo={true} label="halo · 7pt" />
            </View>
          </GradientSwatch>
        </View>

        {/* E — Scale ruler + print settings */}
        <View wrap={false}>
          <SectionHead
            tag="E"
            title="Scale check + print settings"
            hint="Measure the bar with a real ruler. If it isn't exactly 3 inches, the driver scaled the page — reprint at 100% / 'Actual size'. Fill in the fields so this sheet stays attributable."
          />
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 3 }}>
            <View>
              <Svg style={{ width: 216, height: 10 }} viewBox="0 0 216 10">
                <Line x1={0} y1={9.5} x2={216} y2={9.5} stroke="#111827" strokeWidth={0.8} />
                {[0, 72, 144, 216].map(x => (
                  <Line key={`i-${x}`} x1={x} y1={0} x2={x} y2={9.5} stroke="#111827" strokeWidth={0.7} />
                ))}
                {[36, 108, 180].map(x => (
                  <Line key={`h-${x}`} x1={x} y1={5} x2={x} y2={9.5} stroke="#111827" strokeWidth={0.5} />
                ))}
              </Svg>
              <View style={{ width: 216, flexDirection: 'row', justifyContent: 'space-between', marginTop: 1 }}>
                <Text style={rulerLabel}>0"</Text>
                <Text style={rulerLabel}>1"</Text>
                <Text style={rulerLabel}>2"</Text>
                <Text style={rulerLabel}>3"</Text>
              </View>
            </View>
            <View style={{ marginLeft: 18, flex: 1 }}>
              <Text style={writeIn}>Printer: ____________________________   Paper: ____________________________</Text>
              <Text style={{ ...writeIn, marginTop: 7 }}>Quality: ____________________________   Date: _____________________________</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}

// ============================================================================
// Pieces
// ============================================================================

function SectionHead({ tag, title, hint }: { tag: string; title: string; hint?: string }) {
  return (
    <View style={{ marginBottom: 3 }}>
      <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#111827' }}>
        {tag} — {title}
      </Text>
      {hint ? <Text style={{ fontSize: 5.5, color: '#6b7280', marginTop: 1 }}>{hint}</Text> : null}
    </View>
  )
}

/**
 * One raster-vs-vector comparison row. The raster image includes the bleed
 * ring so it's physically a touch larger; alignItems center keeps the label
 * areas optically aligned.
 */
function AbRow({
  themeLabel,
  theme,
  raster,
  slabInputs,
  idSuffix,
}: {
  themeLabel: string
  theme: 'modern' | 'traditional'
  raster?: string | null
  slabInputs: Omit<SlabLabelInputs, 'theme'>
  idSuffix: string
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
      <Text style={{ width: 44, fontSize: 5.5, fontFamily: 'Helvetica-Bold', color: '#374151' }}>
        {themeLabel}
      </Text>
      <View>
        {raster ? (
          <Image src={raster} style={{ width: RASTER_W, height: RASTER_H }} />
        ) : (
          <View
            style={{
              width: RASTER_W,
              height: RASTER_H,
              borderWidth: 0.5,
              borderColor: '#d1d5db',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 5, color: '#9ca3af' }}>raster unavailable</Text>
          </View>
        )}
        <Text style={caption}>raster — production canvas, 300 DPI JPEG (incl. bleed)</Text>
      </View>
      <View style={{ width: 14 }} />
      <View>
        <View style={{ width: SLAB_LABEL_W_PT, height: SLAB_LABEL_H_PT, position: 'relative' }}>
          <SlabFrontLabelBlock
            inputs={{ ...slabInputs, theme, printColorTweakIntensity: 0 }}
            idSuffix={idSuffix}
          />
        </View>
        <Text style={caption}>vector — react-pdf replica, untweaked</Text>
      </View>
    </View>
  )
}

/** Fixed-size view with the modern slab's 3-stop diagonal gradient behind its children. */
function GradientSwatch({
  id,
  d1,
  d2,
  w,
  h,
  children,
}: {
  id: string
  d1: string
  d2: string
  w: number
  h: number
  children: React.ReactNode
}) {
  return (
    <View style={{ width: w, height: h, position: 'relative', justifyContent: 'center' }}>
      <Svg style={{ position: 'absolute', top: 0, left: 0, width: w, height: h }} viewBox={`0 0 ${w} ${h}`}>
        <Defs>
          <SvgLinearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={d1} />
            <Stop offset="50%" stopColor={d2} />
            <Stop offset="100%" stopColor={d1} />
          </SvgLinearGradient>
        </Defs>
        <Rect x={0} y={0} width={w} height={h} fill={`url(#${id})`} />
      </Svg>
      {children}
    </View>
  )
}

/**
 * Knockout text sample, optionally with the duplicate-render halo: four
 * 0.6-alpha black copies offset by ~0.35pt behind the white text. This is
 * the cheap approximation of canvas strokeText(); section D exists to
 * decide whether even this much is needed.
 */
function HaloSample({
  text,
  size,
  halo,
  label,
}: {
  text: string
  size: number
  halo: boolean
  label: string
}) {
  const offsets: [number, number][] = [
    [-0.35, 0],
    [0.35, 0],
    [0, -0.35],
    [0, 0.35],
  ]
  const textStyle = { fontSize: size, fontFamily: 'Helvetica-Bold' as const }
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ position: 'relative' }}>
        {halo
          ? offsets.map(([dx, dy], i) => (
              <Text
                key={i}
                style={{ ...textStyle, position: 'absolute', left: dx, top: dy, color: 'rgba(0,0,0,0.6)' }}
              >
                {text}
              </Text>
            ))
          : null}
        <Text style={{ ...textStyle, color: '#FFFFFF' }}>{text}</Text>
      </View>
      <Text style={{ fontSize: 4.5, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{label}</Text>
    </View>
  )
}

// ------- Shared text styles -------

const caption = { fontSize: 5, color: '#6b7280', marginTop: 2 } as const
const rulerLabel = { fontSize: 5, color: '#111827' } as const
const writeIn = { fontSize: 6, color: '#111827' } as const
