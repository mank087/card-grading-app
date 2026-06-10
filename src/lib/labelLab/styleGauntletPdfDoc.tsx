/**
 * Style Gauntlet — one print run validates EVERY Label Studio style for a
 * given card.
 *
 * Each row renders the full vector label (exact 2.8" x 0.8" size, real
 * card text at production auto-shrink sizes) for one style spec, annotated
 * with its WCAG verdict:
 *
 *   PASS         — production's text color clears 7:1 everywhere
 *   FLIP TEXT    — chosen text fails but the opposite polarity passes
 *                  (production's isDark heuristic picked wrong)
 *   GUARD NEEDED — neither white nor near-black passes (mid-tone
 *                  background) — needs one of the guards below
 *
 * The final section takes the WORST failing spec and prints the three
 * candidate guards side by side: flipped text color, background adjusted
 * until passing (hues kept), and a duplicate-render halo. Whichever reads
 * best on paper is the one to promote into production.
 */

import React from 'react'
import {
  Document,
  Page,
  View,
  Text,
  Svg,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Rect,
} from '@react-pdf/renderer'
import { CustomSlabLabelBlock } from './customSlabPdfBlock'
import { SLAB_LABEL_W_PT, SLAB_LABEL_H_PT, type SlabLabelInputs } from './slabLabelPdfDoc'
import { evaluateSpec, type LabStyleSpec } from './labStyleSpecs'
import {
  adjustStopsToPass,
  evaluateLabelBackground,
  parseHex,
  toHex,
  lerpRgb,
  relativeLuminanceWCAG,
  type BackgroundContrastReport,
} from './contrastWCAG'

const MARGIN = 36
const CONTENT_W = 612 - MARGIN * 2 // 540
const LABEL_W = SLAB_LABEL_W_PT
const LABEL_H = SLAB_LABEL_H_PT

export interface StyleGauntletInputs {
  slabInputs: Omit<SlabLabelInputs, 'theme'>
  specs: LabStyleSpec[]
  /** Shown in the header, e.g. the card display name. */
  cardLabel?: string
}

// ============================================================================
// Document
// ============================================================================

export function StyleGauntletPdfDoc(inputs: StyleGauntletInputs) {
  const { slabInputs, specs, cardLabel } = inputs
  const evaluated = specs.map(spec => ({ spec, report: evaluateSpec(spec) }))

  // Worst failing spec drives the guard section.
  const failing = evaluated.filter(e => e.report.verdict !== 'pass')
  const worst = failing.length > 0
    ? failing.reduce((a, b) => (a.report.minChosen <= b.report.minChosen ? a : b))
    : null

  return (
    <Document>
      <Page size="LETTER" style={{ backgroundColor: '#FFFFFF', padding: MARGIN }}>
        {/* Header */}
        <View style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#111827' }}>
            DCM Label Lab — Style Gauntlet
          </Text>
          <Text style={{ fontSize: 6, color: '#6b7280', marginTop: 2 }}>
            {cardLabel ? `Card: ${cardLabel} (${slabInputs.serial})` : `Card: ${slabInputs.serial}`} · Every
            Label Studio style rendered at exact print size with this card's real colors and text. Verdicts
            are WCAG vs the 7:1 print threshold. Print at 100% scale. Circle any row where paper disagrees
            with the verdict.
          </Text>
        </View>

        {/* Style rows — flow across pages automatically */}
        {evaluated.map(({ spec, report }, i) => (
          <SpecRow key={spec.id + i} spec={spec} report={report} slabInputs={slabInputs} idSuffix={`g${i}`} />
        ))}

        {/* Guard section for the worst failure */}
        {worst ? (
          <GuardSection worst={worst} slabInputs={slabInputs} />
        ) : (
          <View wrap={false} style={{ marginTop: 10 }}>
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#15803d' }}>
              All styles pass 7:1 for this card — no guard test needed. Try a card with brighter, mid-tone
              artwork (yellow / sky blue / gold) to stress the guards.
            </Text>
          </View>
        )}
      </Page>
    </Document>
  )
}

// ============================================================================
// One style row: label block + annotation
// ============================================================================

function verdictColor(v: BackgroundContrastReport['verdict']): string {
  return v === 'pass' ? '#15803d' : v === 'flip-text' ? '#b45309' : '#b91c1c'
}

function verdictLabel(r: BackgroundContrastReport): string {
  if (r.verdict === 'pass') return 'PASS'
  if (r.verdict === 'flip-text') return `FLIP TEXT -> ${r.altChoice === 'light' ? 'white' : 'near-black'}`
  return 'GUARD NEEDED'
}

function SpecRow({
  spec,
  report,
  slabInputs,
  idSuffix,
}: {
  spec: LabStyleSpec
  report: BackgroundContrastReport
  slabInputs: Omit<SlabLabelInputs, 'theme'>
  idSuffix: string
}) {
  return (
    <View wrap={false} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 7 }}>
      <View style={{ width: LABEL_W, height: LABEL_H, position: 'relative' }}>
        <CustomSlabLabelBlock inputs={slabInputs} spec={spec} idSuffix={idSuffix} />
      </View>
      <View style={{ marginLeft: 10, flex: 1 }}>
        <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#111827' }}>
          {spec.name}
          <Text style={{ fontSize: 5.5, fontFamily: 'Helvetica', color: '#6b7280' }}>
            {'  '}({spec.source})
          </Text>
        </Text>
        <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: verdictColor(report.verdict), marginTop: 1.5 }}>
          {verdictLabel(report)}
        </Text>
        <Text style={{ fontSize: 5.5, color: '#374151', marginTop: 1.5 }}>
          chosen text {spec.textColor}: min {report.minChosen.toFixed(1)}:1 · best alternative (
          {report.altChoice === 'light' ? 'white' : 'near-black'}): min {report.minAlt.toFixed(1)}:1 · threshold {report.threshold}:1
        </Text>
        {spec.contrastDiscrete ? (
          <Text style={{ fontSize: 5, color: '#9ca3af', marginTop: 1 }}>
            hard-edged regions — every region color checked, no blending
          </Text>
        ) : null}
      </View>
    </View>
  )
}

// ============================================================================
// Guard section
// ============================================================================

function blendHexToward(hex: string, target: { r: number; g: number; b: number }, amount: number): string {
  const rgb = parseHex(hex)
  if (!rgb) return hex
  return toHex(lerpRgb(rgb, target, amount))
}

/** Apply the background-adjustment guard to a whole spec. */
function adjustedSpec(spec: LabStyleSpec, textHex: string): { spec: LabStyleSpec; amount: number; passed: boolean } {
  const adj = adjustStopsToPass(spec.contrastStops, textHex, { discrete: spec.contrastDiscrete })
  const textRgb = parseHex(textHex)
  const towardLight = textRgb ? relativeLuminanceWCAG(textRgb) < 0.5 : false
  const target = towardLight ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 }
  return {
    amount: adj.amount,
    passed: adj.passed,
    spec: {
      ...spec,
      name: `${spec.name} (adjusted ${Math.round(adj.amount * 100)}%)`,
      background: {
        ...spec.background,
        stops: spec.background.stops.map(s => ({ ...s, color: blendHexToward(s.color, target, adj.amount) })),
      },
      pattern: spec.pattern
        ? { ...spec.pattern, colors: spec.pattern.colors.map(c => blendHexToward(c, target, adj.amount)) }
        : undefined,
      contrastStops: adj.stops,
    },
  }
}

function GuardSection({
  worst,
  slabInputs,
}: {
  worst: { spec: LabStyleSpec; report: BackgroundContrastReport }
  slabInputs: Omit<SlabLabelInputs, 'theme'>
}) {
  const { spec, report } = worst

  // Guard A: flip to the better text polarity (works only for flip-text verdicts,
  // printed regardless so paper can confirm the math).
  const flipped: LabStyleSpec = {
    ...spec,
    name: `${spec.name} (text -> ${report.altHex})`,
    textColor: report.altHex,
    accentColor: report.altHex,
  }
  const flippedReport = evaluateLabelBackground({
    stops: spec.contrastStops,
    textHex: report.altHex,
    discrete: spec.contrastDiscrete,
  })

  // Guard B: keep the hues, pull the background toward the text's opposite
  // until it passes.
  const adjusted = adjustedSpec(spec, spec.textColor)
  const adjustedReport = evaluateLabelBackground({
    stops: adjusted.spec.contrastStops,
    textHex: spec.textColor,
    discrete: spec.contrastDiscrete,
  })

  return (
    <View wrap={false} style={{ marginTop: 8 }}>
      <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#111827', marginBottom: 1 }}>
        Guard test — worst failure: {spec.name} (min {report.minChosen.toFixed(1)}:1)
      </Text>
      <Text style={{ fontSize: 5.5, color: '#6b7280', marginBottom: 4 }}>
        Three candidate fixes for styles that fail 7:1. Pick the one that reads best on paper — that's the
        rule to promote into the production Label Studio.
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 }}>
        <GuardCell
          title={`A — flip text (min ${flippedReport.minChosen.toFixed(1)}:1)`}
          spec={flipped}
          slabInputs={slabInputs}
          idSuffix="guard-a"
        />
        <View style={{ width: 12 }} />
        <GuardCell
          title={`B — adjust bg ${Math.round(adjusted.amount * 100)}% (min ${adjustedReport.minChosen.toFixed(1)}:1${adjusted.passed ? '' : ', capped'})`}
          spec={adjusted.spec}
          slabInputs={slabInputs}
          idSuffix="guard-b"
        />
      </View>

      {/* Guard C: halo on the ORIGINAL background — contrast math can't score
          a halo, only paper can. */}
      <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: '#111827', marginBottom: 2 }}>
        C — duplicate-render halo on the unmodified background (ratios unchanged; judge by eye)
      </Text>
      <HaloGuardBar spec={spec} serial={slabInputs.serial} />
    </View>
  )
}

function GuardCell({
  title,
  spec,
  slabInputs,
  idSuffix,
}: {
  title: string
  spec: LabStyleSpec
  slabInputs: Omit<SlabLabelInputs, 'theme'>
  idSuffix: string
}) {
  return (
    <View>
      <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: '#111827', marginBottom: 2 }}>{title}</Text>
      <View style={{ width: LABEL_W, height: LABEL_H, position: 'relative' }}>
        <CustomSlabLabelBlock inputs={slabInputs} spec={spec} idSuffix={idSuffix} />
      </View>
    </View>
  )
}

/** Worst background as a bar, plain vs halo text at small print sizes. */
function HaloGuardBar({ spec, serial }: { spec: LabStyleSpec; serial: string }) {
  const barH = 30
  return (
    <View style={{ width: CONTENT_W, height: barH, position: 'relative', justifyContent: 'center' }}>
      <Svg
        style={{ position: 'absolute', top: 0, left: 0, width: CONTENT_W, height: barH }}
        viewBox={`0 0 ${CONTENT_W} ${barH}`}
      >
        <Defs>
          <SvgLinearGradient id="guard-halo-bar" x1="0%" y1="0%" x2="100%" y2="0%">
            {spec.background.stops.map((s, i) => (
              <Stop key={i} offset={`${Math.round(s.offset * 1000) / 10}%`} stopColor={s.color} />
            ))}
          </SvgLinearGradient>
        </Defs>
        <Rect x={0} y={0} width={CONTENT_W} height={barH} fill="url(#guard-halo-bar)" />
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
        <HaloText text={`${serial} 10`} size={4.5} halo={false} textColor={spec.textColor} label="plain 4.5pt" />
        <HaloText text={`${serial} 10`} size={4.5} halo={true} textColor={spec.textColor} label="halo 4.5pt" />
        <HaloText text={`${serial} 10`} size={7} halo={false} textColor={spec.textColor} label="plain 7pt" />
        <HaloText text={`${serial} 10`} size={7} halo={true} textColor={spec.textColor} label="halo 7pt" />
      </View>
    </View>
  )
}

function HaloText({
  text,
  size,
  halo,
  textColor,
  label,
}: {
  text: string
  size: number
  halo: boolean
  textColor: string
  label: string
}) {
  // Halo polarity is the opposite of the text: black halo behind light
  // text, white halo behind dark text.
  const rgb = parseHex(textColor)
  const lightText = rgb ? relativeLuminanceWCAG(rgb) >= 0.5 : true
  const haloColor = lightText ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)'
  const offsets: [number, number][] = [
    [-0.35, 0],
    [0.35, 0],
    [0, -0.35],
    [0, 0.35],
  ]
  const base = { fontSize: size, fontFamily: 'Helvetica-Bold' as const }
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ position: 'relative' }}>
        {halo
          ? offsets.map(([dx, dy], i) => (
              <Text key={i} style={{ ...base, position: 'absolute', left: dx, top: dy, color: haloColor }}>
                {text}
              </Text>
            ))
          : null}
        <Text style={{ ...base, color: textColor }}>{text}</Text>
      </View>
      <Text style={{ fontSize: 4.5, color: lightText ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)', marginTop: 1.5 }}>
        {label}
      </Text>
    </View>
  )
}