/**
 * Enterprise Label Designer — sample sheet for the owner.
 *
 *   npx tsx scripts/label-design-sample.ts <outdir>
 *
 * Renders one true-size (2.8" x 0.8") front + back PDF per design through the
 * SAME print document the production generator uses (heritageSlabPdfDoc), so
 * what lands in the outdir is what a store would actually print — no proof
 * sheet chrome, no captions, just the two labels stacked with a gap.
 *
 * The three designs are the ones the enterprise customer asked about:
 *   a) heritage-default    — today's stock label, for comparison
 *   b) noband-logo-left    — no band, emblem left at 2.2x, serial under the chip
 *   c) noband-logo-right   — the same with the emblem beside the grade
 *
 * A front PNG is written alongside each PDF: sharp is already a dependency and
 * rasterizes the SVG preview (HeritageLabelPreview), which shares its geometry
 * with the PDF via heritageLayout. The logo is a generated "KK" placeholder —
 * there is no org logo asset in public/ to borrow.
 */
import * as fs from 'fs'
import * as path from 'path'
import React from 'react'
import type { OrgLabelDesign } from '../src/lib/labels/orgLabelDesign'

const OUT = process.argv[2] || path.join(process.cwd(), 'label-designs')

const SAMPLE = {
  primaryName: 'Aaron Judge',
  contextLine: 'Bowman Chrome Prospects • #BCP-14 • 2023',
  serial: 'DCM-000123',
  grade: '9',
  condition: 'Mint',
  subgrades: { centering: 9.5, corners: 9, edges: 9.5, surface: 9 },
}

/** Placeholder store mark: a rounded plate with "KK", as a PNG data URL. */
async function placeholderLogo(sharp: typeof import('sharp'), ink: string, plate: string): Promise<string> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <rect x="20" y="20" width="560" height="560" rx="72" fill="${plate}" stroke="${ink}" stroke-width="16"/>
    <text x="300" y="300" text-anchor="middle" dominant-baseline="central"
      font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="260" fill="${ink}">KK</text>
  </svg>`
  const png = await sharp(Buffer.from(svg)).png().toBuffer()
  return `data:image/png;base64,${png.toString('base64')}`
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })

  const sharpMod = (await import('sharp')).default
  const pdf = await import('@react-pdf/renderer')
  const { HeritageFront, HeritageBack, heritageChip } = await import('../src/lib/labelLab/heritageSlabPdfDoc')
  const { HeritageLabelPreview } = await import('../src/components/labels/HeritageLabelPreview')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { defaultOrgLabelDesign, normalizeOrgLabelDesign } = await import('../src/lib/labels/orgLabelDesign')

  // QR for the back, if the package resolves (it is a dependency; guarded so a
  // missing optional dep degrades to a QR-less back rather than failing).
  let qrDataUrl: string | null = null
  try {
    const q = (await import('qrcode')).default
    qrDataUrl = await q.toDataURL(`https://dcmgrading.com/verify/${SAMPLE.serial}`, {
      errorCorrectionLevel: 'H', margin: 1, width: 300, color: { dark: '#141414', light: '#ffffff' },
    })
  } catch { /* no QR */ }

  const logoColor = await placeholderLogo(sharpMod, '#1B2A6B', '#FFFFFF')
  const logoBlack = await placeholderLogo(sharpMod, '#101014', '#FFFFFF')

  const d = (fn: (x: OrgLabelDesign) => void): OrgLabelDesign => {
    const draft = defaultOrgLabelDesign()
    fn(draft)
    return normalizeOrgLabelDesign(draft)
  }

  const designs: { id: string; note: string; design: OrgLabelDesign | null }[] = [
    { id: 'a-heritage-default', note: 'Stock heritage label (no design document)', design: null },
    {
      id: 'b-noband-logo-left',
      note: 'No band · logo left at 2.2x · serial under the grade chip',
      design: d(x => {
        x.band.position = 'none'
        x.logo.zone = 'left'
        x.logo.variant = 'color'
        x.logo.scale = 2.2
        x.text.serialPlacement = 'chip'
      }),
    },
    {
      id: 'c-noband-logo-right',
      note: 'No band · logo beside the grade · serial under the grade chip',
      design: d(x => {
        x.band.position = 'none'
        x.logo.zone = 'right'
        x.logo.variant = 'color'
        x.logo.scale = 2.2
        x.text.serialPlacement = 'chip'
      }),
    },
  ]

  const INCH = 72
  const LABEL_W = 2.8 * INCH
  const LABEL_H = 0.8 * INCH
  const GAP = 12
  const written: string[] = []

  for (const { id, design } of designs) {
    const inputs = {
      ...SAMPLE,
      bandColors: ['#4851D2', '#1B2A6B', '#8E9BFF'],
      pattern: 'diamond' as const,
      logoTreatment: 'rules' as const,
      logoColor: 'color' as const,
      logoScale: design?.logo.scale ?? 1,
      colorLogoDataUrl: logoColor,
      blackLogoDataUrl: logoBlack,
      whiteLogoDataUrl: logoColor,
      qrDataUrl,
      printHardened: true,
      design,
    }
    const chip = heritageChip(inputs as never)

    // One page that is exactly the two labels — true size, nothing else.
    const doc = React.createElement(
      pdf.Document,
      null,
      React.createElement(
        pdf.Page,
        { size: [LABEL_W, LABEL_H * 2 + GAP] as [number, number], style: { backgroundColor: '#FFFFFF' } },
        React.createElement(HeritageFront, { i: inputs as never, chip }),
        React.createElement(pdf.View, { style: { height: GAP } }),
        React.createElement(HeritageBack, { i: inputs as never, chip }),
      ),
    )
    const buf = await pdf.renderToBuffer(doc as never)
    const pdfPath = path.join(OUT, `${id}.pdf`)
    fs.writeFileSync(pdfPath, buf)
    written.push(pdfPath)

    // Front PNG from the SVG preview — same geometry engine as the PDF.
    const markup = renderToStaticMarkup(
      React.createElement(HeritageLabelPreview, {
        data: {
          primaryName: SAMPLE.primaryName,
          contextLine: SAMPLE.contextLine,
          serial: SAMPLE.serial,
          grade: 9,
          condition: SAMPLE.condition,
          qrCodeDataUrl: qrDataUrl ?? '',
          subScores: SAMPLE.subgrades,
          logoDataUrl: logoColor,
        } as never,
        side: 'front',
        pattern: 'diamond',
        bandColors: inputs.bandColors,
        blackLogoHref: logoColor,
        colorLogoHref: logoColor,
        logoScale: inputs.logoScale,
        design,
      }),
    ).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="400" ')
    const pngPath = path.join(OUT, `${id}-front.png`)
    await sharpMod(Buffer.from(markup)).png().toFile(pngPath)
    written.push(pngPath)
  }

  console.log(`\n${written.length} files in ${OUT}:`)
  for (const f of written) console.log('  ' + f)
  for (const { id, note } of designs) console.log(`\n  ${id} — ${note}`)
}

main().catch(e => { console.error(e); process.exit(1) })
