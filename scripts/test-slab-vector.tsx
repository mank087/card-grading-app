/**
 * Smoke test: render the v2 slab vector doc (modern) alone to check the
 * gradient background renders correctly outside the calibration sheet.
 *   npx tsx scripts/test-slab-vector.tsx
 */
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { SlabLabelPdfDoc } from '../src/lib/labelLab/slabLabelPdfDoc'
import fs from 'fs'

async function main() {
  const doc = SlabLabelPdfDoc({
    theme: 'modern',
    primaryName: 'Michael Jordan',
    contextLine: 'Fleer • #57 • 1986',
    featuresLine: 'RC',
    serial: 'DCM-A1B2C3D4',
    grade: '10',
    condition: 'Gem Mint',
    subgrades: { centering: 10, corners: 9.5, edges: 10, surface: 9.5 },
    whiteLogoDataUrl: null,
    colorLogoDataUrl: null,
    printColorTweakIntensity: 0,
  })
  const buf = await renderToBuffer(doc as any)
  fs.writeFileSync('output/test-slab-modern.pdf', buf)
  console.log(`OK — ${buf.length} bytes -> output/test-slab-modern.pdf`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
