/**
 * Modern Slab label as a fully vector @react-pdf/renderer Document.
 *
 * Why this file exists: the production customSlabLabelGenerator.ts paints
 * a 300 DPI canvas and embeds the resulting PNG into the PDF. That puts
 * every glyph through two rasterisations (canvas at 300 DPI, then the
 * printer at 600-1200 DPI), which is the root cause of the "almost crisp
 * but not quite" softness on small text against gradient backgrounds.
 *
 * react-pdf stores text as text and gradients as PDF function objects.
 * The printer rasterises ONCE at its native resolution.
 *
 * v1 covers: gradient bg via SVG, vector text, embedded card images,
 * grade + subgrades, serial. Decorative patterns and the holographic
 * shimmer effect are deferred — they don't drive print legibility and
 * the validation goal here is text crispness.
 *
 * IMPORTANT: this module imports @react-pdf/renderer which pulls in
 * yoga-layout via WASM at module-load time. Keep the import dynamic
 * from the lab UI (await import('./modernSlabPdfDoc')) so the main app
 * bundle isn't dragged down by it.
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
} from '@react-pdf/renderer'
import { pickContrastTextHex, printColorTweaksHex } from './contrastWCAG'

// Slab label is 2.5" wide x 1.25" tall at 300 DPI = 750x375 PDF points
// (react-pdf uses 72 DPI points by default; we set explicit pt sizes).
const WIDTH_PT = 2.5 * 72
const HEIGHT_PT = 1.25 * 72

export interface ModernSlabPdfInputs {
  // Background gradient (sRGB hex).
  gradientStart: string
  gradientEnd: string
  // Optional print-safe color tweaks (darken-dark, slight desaturate).
  // Set 0 to disable, 1 for full intensity. Default 0.5.
  printColorTweakIntensity?: number
  // Card content.
  playerOrCharacter: string
  setName: string
  year: string
  cardNumber: string
  grade: string
  conditionLabel: string
  subgrades?: { centering?: number | null; corners?: number | null; edges?: number | null; surface?: number | null }
  serial: string
  // Image URLs.
  frontImageUrl?: string | null
  backImageUrl?: string | null
  // Side. The label has two pages — caller can render one or both via
  // <Document><FrontPage /><BackPage /></Document>.
}

export function ModernSlabPdfDoc(inputs: ModernSlabPdfInputs) {
  return (
    <Document>
      <FrontPage {...inputs} />
      <BackPage {...inputs} />
    </Document>
  )
}

function FrontPage(inputs: ModernSlabPdfInputs) {
  const intensity = inputs.printColorTweakIntensity ?? 0.5
  const start = intensity > 0 ? printColorTweaksHex(inputs.gradientStart, intensity) : inputs.gradientStart
  const end = intensity > 0 ? printColorTweaksHex(inputs.gradientEnd, intensity) : inputs.gradientEnd
  // Text color picked WCAG-style. We sample at the midpoint to pick the
  // best single color; the actual stroke safety net is what protects the
  // extremes.
  const midHex = mixHex(start, end, 0.5)
  const textChoice = pickContrastTextHex(midHex)

  const styles = StyleSheet.create({
    page: {
      width: WIDTH_PT,
      height: HEIGHT_PT,
      padding: 0,
      backgroundColor: start,
    },
    bg: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: WIDTH_PT,
      height: HEIGHT_PT,
    },
    content: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: WIDTH_PT,
      height: HEIGHT_PT,
      flexDirection: 'row',
    },
    leftCol: {
      width: WIDTH_PT * 0.32,
      paddingLeft: 6,
      paddingTop: 6,
      paddingBottom: 6,
      justifyContent: 'flex-start',
    },
    centerCol: {
      flex: 1,
      paddingLeft: 6,
      paddingRight: 6,
      paddingTop: 4,
      paddingBottom: 4,
      justifyContent: 'space-between',
    },
    rightCol: {
      width: WIDTH_PT * 0.20,
      alignItems: 'center',
      justifyContent: 'center',
      paddingRight: 6,
    },
    cardImage: {
      width: WIDTH_PT * 0.28,
      height: HEIGHT_PT - 12,
      objectFit: 'contain',
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    brandWord: {
      fontFamily: 'Helvetica-Bold',
      fontSize: 9,
      color: textChoice.hex,
      letterSpacing: 1.2,
    },
    playerName: {
      fontFamily: 'Helvetica-Bold',
      fontSize: 10,
      color: textChoice.hex,
      marginTop: 2,
    },
    setLine: {
      fontFamily: 'Helvetica',
      fontSize: 7,
      color: textChoice.hex,
      opacity: 0.92,
      marginTop: 1,
    },
    metaLine: {
      fontFamily: 'Helvetica',
      fontSize: 6.5,
      color: textChoice.hex,
      opacity: 0.85,
      marginTop: 1,
    },
    gradeBlock: {
      alignItems: 'center',
    },
    gradeNumber: {
      fontFamily: 'Helvetica-Bold',
      fontSize: 32,
      color: textChoice.hex,
      lineHeight: 1,
    },
    gradeLabel: {
      fontFamily: 'Helvetica-Bold',
      fontSize: 6,
      color: textChoice.hex,
      letterSpacing: 0.8,
      marginTop: 2,
    },
    subgradeRow: {
      flexDirection: 'row',
      gap: 4,
      marginTop: 2,
    },
    subBox: {
      width: WIDTH_PT * 0.08,
      paddingVertical: 2,
      alignItems: 'center',
      borderColor: textChoice.hex,
      borderWidth: 0.5,
      borderRadius: 1.5,
    },
    subVal: {
      fontFamily: 'Helvetica-Bold',
      fontSize: 7,
      color: textChoice.hex,
    },
    subLbl: {
      fontFamily: 'Helvetica',
      fontSize: 4,
      color: textChoice.hex,
      letterSpacing: 0.4,
    },
    serial: {
      fontFamily: 'Helvetica',
      fontSize: 5,
      color: textChoice.hex,
      opacity: 0.8,
      letterSpacing: 0.6,
    },
  })

  return (
    <Page size={{ width: WIDTH_PT, height: HEIGHT_PT }} style={styles.page}>
      {/* SVG gradient background — vector at print resolution. */}
      <Svg style={styles.bg} viewBox={`0 0 ${WIDTH_PT} ${HEIGHT_PT}`}>
        <Defs>
          <SvgLinearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={start} />
            <Stop offset="100%" stopColor={end} />
          </SvgLinearGradient>
        </Defs>
        <Rect x={0} y={0} width={WIDTH_PT} height={HEIGHT_PT} fill="url(#grad)" />
      </Svg>

      <View style={styles.content}>
        {/* Left: card image */}
        <View style={styles.leftCol}>
          {inputs.frontImageUrl ? (
            <Image src={inputs.frontImageUrl} style={styles.cardImage} />
          ) : null}
        </View>

        {/* Center: text */}
        <View style={styles.centerCol}>
          <View>
            <View style={styles.brandRow}>
              <Text style={styles.brandWord}>DCM</Text>
            </View>
            <Text style={styles.playerName}>
              {inputs.playerOrCharacter}
            </Text>
            <Text style={styles.setLine}>
              {inputs.setName}
            </Text>
            <Text style={styles.metaLine}>
              {[inputs.year, inputs.cardNumber].filter(Boolean).join(' • ')}
            </Text>
          </View>

          <View style={styles.subgradeRow}>
            {(['centering', 'corners', 'edges', 'surface'] as const).map((k) => {
              const v = inputs.subgrades?.[k]
              const short = k.slice(0, 3).toUpperCase()
              return (
                <View style={styles.subBox} key={k}>
                  <Text style={styles.subVal}>{v != null ? String(v) : '—'}</Text>
                  <Text style={styles.subLbl}>{short}</Text>
                </View>
              )
            })}
          </View>

          <Text style={styles.serial}>DCM • {inputs.serial}</Text>
        </View>

        {/* Right: grade */}
        <View style={styles.rightCol}>
          <View style={styles.gradeBlock}>
            <Text style={styles.gradeNumber}>{inputs.grade}</Text>
            <Text style={styles.gradeLabel}>{inputs.conditionLabel.toUpperCase()}</Text>
          </View>
        </View>
      </View>
    </Page>
  )
}

function BackPage(inputs: ModernSlabPdfInputs) {
  const intensity = inputs.printColorTweakIntensity ?? 0.5
  const start = intensity > 0 ? printColorTweaksHex(inputs.gradientStart, intensity) : inputs.gradientStart
  const end = intensity > 0 ? printColorTweaksHex(inputs.gradientEnd, intensity) : inputs.gradientEnd
  const midHex = mixHex(start, end, 0.5)
  const textChoice = pickContrastTextHex(midHex)

  const styles = StyleSheet.create({
    page: {
      width: WIDTH_PT,
      height: HEIGHT_PT,
      padding: 0,
      backgroundColor: start,
    },
    bg: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: WIDTH_PT,
      height: HEIGHT_PT,
    },
    content: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: WIDTH_PT,
      height: HEIGHT_PT,
      flexDirection: 'row',
      padding: 6,
    },
    leftCol: {
      width: WIDTH_PT * 0.32,
      justifyContent: 'center',
    },
    centerCol: {
      flex: 1,
      paddingLeft: 6,
    },
    title: {
      fontFamily: 'Helvetica-Bold',
      fontSize: 8,
      color: textChoice.hex,
      letterSpacing: 0.8,
    },
    summary: {
      fontFamily: 'Helvetica',
      fontSize: 6,
      color: textChoice.hex,
      opacity: 0.92,
      marginTop: 4,
      lineHeight: 1.35,
    },
    verifyLine: {
      fontFamily: 'Helvetica',
      fontSize: 5,
      color: textChoice.hex,
      opacity: 0.78,
      marginTop: 6,
      letterSpacing: 0.4,
    },
    cardImage: {
      width: WIDTH_PT * 0.28,
      height: HEIGHT_PT - 12,
      objectFit: 'contain',
    },
  })

  return (
    <Page size={{ width: WIDTH_PT, height: HEIGHT_PT }} style={styles.page}>
      <Svg style={styles.bg} viewBox={`0 0 ${WIDTH_PT} ${HEIGHT_PT}`}>
        <Defs>
          <SvgLinearGradient id="gradB" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={start} />
            <Stop offset="100%" stopColor={end} />
          </SvgLinearGradient>
        </Defs>
        <Rect x={0} y={0} width={WIDTH_PT} height={HEIGHT_PT} fill="url(#gradB)" />
      </Svg>

      <View style={styles.content}>
        <View style={styles.leftCol}>
          {inputs.backImageUrl ? (
            <Image src={inputs.backImageUrl} style={styles.cardImage} />
          ) : null}
        </View>
        <View style={styles.centerCol}>
          <Text style={styles.title}>{inputs.playerOrCharacter}</Text>
          <Text style={styles.summary}>
            {inputs.setName} {inputs.year} {inputs.cardNumber} • Graded {inputs.grade} ({inputs.conditionLabel}) by DCM AI Grading.
          </Text>
          <Text style={styles.verifyLine}>Verify at dcmgrading.com/{inputs.serial}</Text>
        </View>
      </View>
    </Page>
  )
}

// Simple hex mix in sRGB space. Used to pick a single representative
// background color for text-color decisions. Linear-light would be
// more correct color-theoretically but humans read text against the
// sRGB-rendered gradient, so sRGB mixing is the right space here.
function mixHex(a: string, b: string, t: number): string {
  const pa = parse(a)
  const pb = parse(b)
  if (!pa || !pb) return a
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t)
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t)
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t)
  return '#' + [r, g, bl].map(n => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')).join('')
}

function parse(hex: string): [number, number, number] | null {
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
