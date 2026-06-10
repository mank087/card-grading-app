/**
 * Smoke test: render the Label Lab calibration sheet to a PDF buffer in
 * Node (no rasters/logos — exercises the placeholder paths). Run:
 *   npx tsx scripts/test-calibration-sheet.tsx
 */
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { CalibrationSheetPdfDoc } from '../src/lib/labelLab/calibrationSheetPdfDoc'
import fs from 'fs'

async function main() {
  const doc = CalibrationSheetPdfDoc({
    slabInputs: {
      primaryName: 'Michael Jordan',
      contextLine: 'Fleer • #57 • 1986',
      featuresLine: 'RC',
      serial: 'DCM-A1B2C3D4',
      grade: '10',
      condition: 'Gem Mint',
      subgrades: { centering: 10, corners: 9.5, edges: 10, surface: 9.5 },
      whiteLogoDataUrl: null,
      colorLogoDataUrl: null,
    },
    rasterModernDataUrl: null,
    rasterTraditionalDataUrl: null,
  })
  const buf = await renderToBuffer(doc as any)
  fs.writeFileSync('output/test-calibration-sheet.pdf', buf)
  console.log(`OK — ${buf.length} bytes -> output/test-calibration-sheet.pdf`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
