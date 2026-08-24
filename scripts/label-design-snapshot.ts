/**
 * Isolation gate for the enterprise Label Designer.
 *
 * Renders the Heritage label (SVG preview markup + print PDF) for a fixed set
 * of fixtures WITHOUT a design document and hashes the output. Run once to
 * record a baseline, then again after each change:
 *
 *   npx tsx scripts/label-design-snapshot.ts baseline
 *   npx tsx scripts/label-design-snapshot.ts check
 *
 * "check" fails when any fixture's hash differs from the baseline — i.e. the
 * change altered what consumers / existing orgs get when no design exists.
 *
 * Fixtures deliberately cover: a consumer card (no org), an org card with the
 * legacy logo-scale setting, a Gem Mint 10 (foil chip), an Authentic card,
 * and worst-case-long names for every band pattern.
 */
import * as fs from 'fs'
import * as path from 'path'
import { createHash } from 'crypto'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const SNAP_DIR = path.join(process.cwd(), 'scripts', '_snapshots')
const SNAP_FILE = path.join(SNAP_DIR, 'label-design-baseline.json')

const mode = process.argv[2] === 'baseline' ? 'baseline' : 'check'

type Fixture = {
  id: string
  data: Record<string, unknown>
  pattern: string
  bandColors: string[]
  logoScale?: number
  gradeColors?: Record<string, string> | null
}

const LONG_NAME = 'Charizard VMAX Rainbow Rare Secret Alternate Art Shining Fates Champion'
const LONG_CTX = 'Sword & Shield Champion\'s Path Special Collection • #074/073 • 2020'

const PATTERNS = ['diamond', 'mosaic', 'gradient', 'split', 'stripes', 'chevron', 'lightning', 'shattered', 'fractured', 'scales', 'prism']

function fixtures(): Fixture[] {
  const base = {
    features: [],
    featuresLine: null,
    condition: 'Mint',
    qrCodeDataUrl: '',
    subScores: { centering: 9.5, corners: 9, edges: 9.5, surface: 9 },
  }
  const list: Fixture[] = [
    { id: 'consumer-short', data: { ...base, primaryName: 'Pikachu', contextLine: 'Base Set • #58 • 1999', serial: 'DCM123456', grade: 9 }, pattern: 'diamond', bandColors: ['#7c3aed', '#4c1d95', '#a855f7'] },
    { id: 'consumer-ten', data: { ...base, primaryName: 'Aaron Judge', contextLine: 'Bowman Chrome • #99 • 2023', serial: 'DCM355168', grade: 10, condition: 'Gem Mint' }, pattern: 'mosaic', bandColors: ['#1d4ed8', '#0e7490'] },
    { id: 'consumer-authentic', data: { ...base, primaryName: 'Mickey Mantle', contextLine: 'Topps • #311 • 1952', serial: 'DCM000001', grade: null, isAlteredAuthentic: true, condition: 'Authentic' }, pattern: 'gradient', bandColors: ['#7c3aed', '#4c1d95'] },
    { id: 'org-scaled-logo', data: { ...base, primaryName: 'Monkey D. Luffy', contextLine: 'One Piece Promo • #P-001 • 2023', serial: 'KK000123', grade: 9 }, pattern: 'diamond', bandColors: ['#4851d2', '#770804', '#7d6943'], logoScale: 1.65 },
    { id: 'grade-colors', data: { ...base, primaryName: 'LeBron James', contextLine: 'Donruss Optic Downtown • #D-3 • 2021', serial: 'DCM777777', grade: 8 }, pattern: 'split', bandColors: ['#111111', '#dddddd'], gradeColors: { '8': '#ff00ff', '10': '#00ff00' } },
  ]
  PATTERNS.forEach((p, i) => {
    list.push({ id: `long-${p}`, data: { ...base, primaryName: LONG_NAME, contextLine: LONG_CTX, serial: `DCM9${String(i).padStart(5, '0')}`, grade: (i % 10) + 1 }, pattern: p, bandColors: ['#7c3aed', '#4c1d95', '#a855f7', '#2e1065', '#c4b5fd'], logoScale: 2 })
  })
  return list
}

const sha = (s: string | Buffer) => createHash('sha256').update(s).digest('hex').slice(0, 16)

/** Strip the volatile PDF trailer bits (dates, ids) before hashing. */
function normalizePdf(buf: Buffer): Buffer {
  let s = buf.toString('latin1')
  s = s.replace(/\/CreationDate \([^)]*\)/g, '/CreationDate ()')
  s = s.replace(/\/ModDate \([^)]*\)/g, '/ModDate ()')
  s = s.replace(/\/ID \[[^\]]*\]/g, '/ID []')
  s = s.replace(/\/Producer \([^)]*\)/g, '/Producer ()')
  // react-pdf writes the dates as indirect string objects: "(D:20260824142612Z)".
  s = s.replace(/\(D:\d{14}Z?\)/g, '(D:)')
  return Buffer.from(s, 'latin1')
}

async function main() {
  const { HeritageLabelPreview } = await import('../src/components/labels/HeritageLabelPreview')
  const pdf = await import('@react-pdf/renderer')
  const { HeritageFront, HeritageBack } = await import('../src/lib/labelLab/heritageSlabPdfDoc')
  const { resolveGradeChip } = await import('../src/lib/labelPresets')

  const results: Record<string, { svgFront: string; svgBack: string; pdf: string }> = {}
  for (const f of fixtures()) {
    const svg = (side: 'front' | 'back') => renderToStaticMarkup(
      React.createElement(HeritageLabelPreview, {
        data: f.data as any,
        side,
        pattern: f.pattern as any,
        bandColors: f.bandColors,
        logoScale: f.logoScale ?? 1,
        gradeColors: f.gradeColors ?? null,
        suppressImages: true,
      })
    )
    // useId() differs between renders only if the tree changes; normalise anyway.
    const norm = (s: string) => s.replace(/h_?[A-Za-z0-9_-]*?(f|b)-(band-clip|band-grad|foil)/g, 'ID-$1-$2').replace(/id="h[^"]*"/g, 'id="ID"').replace(/url\(#h[^)]*\)/g, 'url(#ID)')

    const inputs = {
      primaryName: String(f.data.primaryName),
      contextLine: String(f.data.contextLine),
      serial: String(f.data.serial),
      grade: f.data.grade == null ? (f.data.isAlteredAuthentic ? 'A' : '—') : String(f.data.grade),
      condition: String(f.data.condition),
      subgrades: { centering: 9.5, corners: 9, edges: 9.5, surface: 9 },
      bandColors: f.bandColors,
      pattern: f.pattern as any,
      logoTreatment: 'rules' as const,
      logoColor: 'black' as const,
      logoScale: f.logoScale ?? 1,
      printHardened: true,
      gradeColors: f.gradeColors ?? null,
    }
    const chip = resolveGradeChip(inputs.grade, true)
    const doc = React.createElement(pdf.Document, null,
      React.createElement(pdf.Page, { size: [300, 200] },
        React.createElement(HeritageFront, { i: inputs as any, chip }),
        React.createElement(HeritageBack, { i: inputs as any, chip }),
      ))
    const buf = await pdf.renderToBuffer(doc as any)
    results[f.id] = { svgFront: sha(norm(svg('front'))), svgBack: sha(norm(svg('back'))), pdf: sha(normalizePdf(Buffer.from(buf))) }
  }

  if (mode === 'baseline') {
    fs.mkdirSync(SNAP_DIR, { recursive: true })
    fs.writeFileSync(SNAP_FILE, JSON.stringify(results, null, 2))
    console.log(`baseline written: ${Object.keys(results).length} fixtures → ${path.relative(process.cwd(), SNAP_FILE)}`)
    return
  }

  if (!fs.existsSync(SNAP_FILE)) {
    console.error('no baseline — run with "baseline" first')
    process.exit(2)
  }
  const baseline = JSON.parse(fs.readFileSync(SNAP_FILE, 'utf8')) as typeof results
  let failures = 0
  for (const [id, r] of Object.entries(results)) {
    const b = baseline[id]
    if (!b) { console.log(`  ? ${id}: no baseline entry`); continue }
    const diffs = (['svgFront', 'svgBack', 'pdf'] as const).filter(k => b[k] !== r[k])
    if (diffs.length) { failures++; console.log(`  ✗ ${id}: ${diffs.join(', ')} changed`) }
    else console.log(`  ✓ ${id}`)
  }
  if (failures) { console.error(`\n${failures} fixture(s) changed with NO design document — isolation broken.`); process.exit(1) }
  console.log('\nAll fixtures byte-identical to baseline.')
}

main().catch(e => { console.error(e); process.exit(1) })
