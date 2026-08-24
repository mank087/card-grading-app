/**
 * Renders PDF proofs of non-stock Label Designer documents so they can be
 * eyeballed (Chrome renders PDFs). Output: scratchpad/proofs/*.pdf
 */
import React from 'react'
import * as fs from 'fs'
import * as path from 'path'

const OUT = process.argv[2] || 'proofs'

async function main() {
  const pdf = await import('@react-pdf/renderer')
  const { HeritageFront, HeritageBack, heritageChip } = await import('../src/lib/labelLab/heritageSlabPdfDoc')
  const { normalizeOrgLabelDesign, defaultOrgLabelDesign } = await import('../src/lib/labels/orgLabelDesign')
  const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(process.cwd(), 'public', 'DCM-logo-black.png')).toString('base64')

  const base = {
    contextLine: "Sword & Shield Champion's Path • #074/073 • 2020",
    serial: 'KK000123', condition: 'Mint',
    subgrades: { centering: 9.5, corners: 9, edges: 9.5, surface: 9 },
    bandColors: ['#4851d2', '#770804', '#7d6943', '#773b1c', '#948f75'],
    pattern: 'diamond' as const,
    logoTreatment: 'rules' as const, logoColor: 'black' as const,
    printHardened: true, blackLogoDataUrl: logo, colorLogoDataUrl: logo,
    showFounder: false, showCardLover: true, showVip: false,
  }
  const d = defaultOrgLabelDesign()
  const designs: Record<string, ReturnType<typeof normalizeOrgLabelDesign>> = {
    stock: d,
    'left-band-emblem-white': normalizeOrgLabelDesign({ ...d, logo: { ...d.logo, zone: 'left', scale: 1.2 }, chip: { ...d.chip, theme: 'white' } }),
    'top-band-border': normalizeOrgLabelDesign({ ...d, band: { ...d.band, position: 'top', pattern: 'stripes' }, border: { enabled: true, color: '#4851d2', width: 0.02, inset: 0.05 }, logo: { ...d.logo, zone: 'bottom', scale: 1.5 } }),
    'right-band-logo-right': normalizeOrgLabelDesign({ ...d, band: { ...d.band, position: 'right', pattern: 'chevron', width: 1.3 }, logo: { ...d.logo, zone: 'right', scale: 1 }, chip: { ...d.chip, scale: 0.9, theme: 'white' }, text: { scale: 1.1 } }),
    'bottom-band-gradient': normalizeOrgLabelDesign({ ...d, band: { ...d.band, position: 'bottom', pattern: 'gradient' }, logo: { ...d.logo, zone: 'bottom', scale: 1.3, offset: { x: 0.8, y: 0 }, accentRules: false }, border: { enabled: true, color: '#101014', width: 0.015, inset: 0.06 } }),
  }
  fs.mkdirSync(OUT, { recursive: true })
  const names = ['Pikachu', 'Aaron Judge', 'Charizard VMAX Rainbow Rare Secret Alternate Art Champion']
  for (const [id, design] of Object.entries(designs)) {
    const pages = names.flatMap((primaryName, n) => {
      const grade = ['10', '9', '1'][n]
      const inputs: any = { ...base, primaryName, grade, design }
      const chip = heritageChip(inputs)
      return [
        React.createElement(pdf.View, { key: `f${n}`, style: { marginBottom: 8 } }, React.createElement(HeritageFront, { i: inputs, chip })),
        React.createElement(pdf.View, { key: `b${n}`, style: { marginBottom: 20 } }, React.createElement(HeritageBack, { i: inputs, chip })),
      ]
    })
    const doc = React.createElement(pdf.Document, null,
      React.createElement(pdf.Page, { size: [260, 480], style: { padding: 20, backgroundColor: '#DDDDDD' } }, ...pages))
    const buf = await pdf.renderToBuffer(doc as any)
    fs.writeFileSync(path.join(OUT, `${id}.pdf`), Buffer.from(buf))
    console.log('wrote', id)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
