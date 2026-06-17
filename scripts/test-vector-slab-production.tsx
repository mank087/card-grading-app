/**
 * Smoke test: production vector slab docs — single + batch (duplex
 * mirroring) + custom config (rainbow, auto polarity) + emblems.
 *   npx tsx scripts/test-vector-slab-production.tsx
 */
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import fs from 'fs'

// Import the doc-building internals via the generator module
import {
  generateSlabLabelVector,
  generateBatchSlabLabelsVector,
  generateCustomSlabLabelVector,
} from '../src/lib/labels/vectorSlabGenerator'
import type { SlabLabelData } from '../src/lib/slabLabelGenerator'
import type { CustomLabelConfig } from '../src/lib/labelPresets'

const data: SlabLabelData = {
  primaryName: 'Michael Jordan',
  contextLine: 'Fleer • #57 • 1986',
  features: ['RC'],
  featuresLine: 'RC',
  serial: 'DCM-A1B2C3D4',
  grade: 10,
  condition: 'Gem Mint',
  qrCodeDataUrl: '',
  subScores: { centering: 10, corners: 9.5, edges: 10, surface: 9.5 },
  showFounderEmblem: true,
  showVipEmblem: true,
  showCardLoversEmblem: true,
}

const rainbowConfig: CustomLabelConfig = {
  preset: 'dcm',
  width: 2.8,
  height: 0.8,
  colorPreset: 'rainbow',
  gradientStart: '#ff0000',
  gradientEnd: '#0000ff',
  style: 'modern',
  side: 'front',
  borderEnabled: false,
  borderColor: '#7c3aed',
  borderWidth: 0.04,
  textColorMode: 'auto',
}

// Node lacks Blob->file plumbing in react-pdf's toBlob path pre-DOM; the
// generators call pdf().toBlob() which works under Node 18+ (Blob global).
async function blobToFile(blob: Blob, path: string) {
  const buf = Buffer.from(await blob.arrayBuffer())
  fs.writeFileSync(path, buf)
  console.log(`${path} — ${buf.length} bytes`)
}

async function main() {
  await blobToFile(await generateSlabLabelVector(data, 'modern'), 'output/test-prod-vector-single-modern.pdf')
  await blobToFile(await generateSlabLabelVector(data, 'traditional'), 'output/test-prod-vector-single-trad.pdf')

  const batch = Array.from({ length: 12 }, (_, i) => ({
    ...data,
    serial: `DCM-BATCH${String(i + 1).padStart(2, '0')}`,
    showFounderEmblem: i % 2 === 0,
    showVipEmblem: false,
    showCardLoversEmblem: i % 3 === 0,
  }))
  await blobToFile(await generateBatchSlabLabelsVector(batch, 'modern'), 'output/test-prod-vector-batch.pdf')

  await blobToFile(await generateCustomSlabLabelVector(data, rainbowConfig), 'output/test-prod-vector-custom-rainbow.pdf')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})