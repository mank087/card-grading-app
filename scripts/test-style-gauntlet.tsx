/**
 * Smoke test: render the Style Gauntlet + a custom-style single label in
 * Node. Uses a deliberately nasty mid-tone palette (sky blue / gold) to
 * exercise flip-text and guard-needed verdicts.
 *   npx tsx scripts/test-style-gauntlet.tsx
 */
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { StyleGauntletPdfDoc } from '../src/lib/labelLab/styleGauntletPdfDoc'
import { CustomSlabPdfDoc } from '../src/lib/labelLab/customSlabPdfBlock'
import { presetSpec, cardColorSpecs, customSpec, evaluateSpec, PRESET_IDS } from '../src/lib/labelLab/labStyleSpecs'
import fs from 'fs'

const slabInputs = {
  primaryName: 'Pikachu',
  contextLine: 'Jungle • #60 • 1999',
  featuresLine: 'Holo',
  serial: 'DCM-E5F6G7H8',
  grade: '9',
  condition: 'Mint',
  subgrades: { centering: 9, corners: 9, edges: 9.5, surface: 9 },
  whiteLogoDataUrl: null,
  colorLogoDataUrl: null,
}

// Nasty mid-tone card: sky blue artwork, gold border — the zone where
// white fails and black barely passes.
const nastyCardColors = {
  primary: '#6ec6ff',
  secondary: '#ffd54f',
  isDark: false,
  borderColor: '#ffcc00',
  topEdgeColors: ['#6ec6ff', '#9be7ff', '#ffd54f', '#ffb300', '#6ec6ff'],
  palette: ['#6ec6ff', '#ffd54f', '#2962ff', '#ffb300', '#01579b'],
}

async function main() {
  const specs = [
    ...PRESET_IDS.map(id => presetSpec(id)!).filter(Boolean),
    ...cardColorSpecs(nastyCardColors),
  ]
  for (const s of specs) {
    const r = evaluateSpec(s)
    console.log(`${s.name.padEnd(34)} ${r.verdict.padEnd(13)} chosen ${r.minChosen.toFixed(1)}:1  alt(${r.altChoice}) ${r.minAlt.toFixed(1)}:1`)
  }

  const gauntlet = StyleGauntletPdfDoc({ slabInputs, specs, cardLabel: 'Pikachu' })
  const buf1 = await renderToBuffer(gauntlet as any)
  fs.writeFileSync('output/test-style-gauntlet.pdf', buf1)
  console.log(`\nGauntlet OK — ${buf1.length} bytes -> output/test-style-gauntlet.pdf`)

  // Custom designer: 3-color geometric, pattern 0
  const custom = customSpec({
    colors: ['#6ec6ff', '#ffd54f', '#2962ff'],
    layoutId: 'geometric',
    angleDeg: 135,
    geometricPattern: 0,
    borderEnabled: false,
    borderColor: '#7c3aed',
    borderWidthIn: 0.03,
  })
  const single = CustomSlabPdfDoc({
    inputs: slabInputs,
    spec: custom,
    verdictLine: `Verdict: ${evaluateSpec(custom).verdict.toUpperCase()}`,
  })
  const buf2 = await renderToBuffer(single as any)
  fs.writeFileSync('output/test-custom-style.pdf', buf2)
  console.log(`Custom OK — ${buf2.length} bytes -> output/test-custom-style.pdf`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})