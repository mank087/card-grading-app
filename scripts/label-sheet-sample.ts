/**
 * Sample slab-label SHEETS for a test print.
 *
 * Renders the 10-per-sheet (standard) and 20-per-sheet (dense) duplex sheets,
 * plus the TRUE-SIZE pre-perforated sheets — 26 per sheet (upright, 2 × 13)
 * and 30 per sheet (sideways, 10 × 3), every label exactly 2.8" × 0.8", with
 * long- and short-edge backs and the duplex alignment test for each —
 * for the Modern, Traditional and Heritage styles, at both the standard
 * 2.8" × 0.8" slot and the Zion Mag Pro 2.51" × 0.76" slot, so the owner can
 * print one of each and check the trim and the duplex registration before the
 * dense option goes anywhere near production.
 *
 *   npx tsx scripts/label-sheet-sample.ts <output-dir>
 *
 * Every PDF contains the front sheet AND the X-mirrored back sheet (print
 * duplex, flip on long edge). modern-standard-10up.pdf is the CONTROL — its
 * geometry must match what production printed before the density option.
 */
import * as fs from 'fs'
import * as path from 'path'
import type { SlabLabelData } from '../src/lib/slabLabelGenerator'

const outDir = process.argv[2]
if (!outDir) {
  console.error('usage: npx tsx scripts/label-sheet-sample.ts <output-dir>')
  process.exit(2)
}

const NAMES: Array<[string, string]> = [
  ['Charizard', 'Base Set • #4/102 • 1999'],
  ['Pikachu Illustrator', 'Promo • #—  • 1998'],
  ['Mickey Mantle', 'Topps • #311 • 1952'],
  ['Ken Griffey Jr.', 'Upper Deck • #1 • 1989'],
  ['Black Lotus', 'Alpha • Rare • 1993'],
  ['Monkey D. Luffy', 'One Piece Romance Dawn • #OP01-003 • 2022'],
  ['Elsa', 'Lorcana First Chapter • #42/204 • 2023'],
  ['Blue-Eyes White Dragon', 'Legend of Blue Eyes • #LOB-001 • 2002'],
  ['Victor Wembanyama', 'Prizm • #136 • 2023'],
  ['Luka Doncic', 'Donruss Optic Rated Rookie • #177 • 2018'],
  ['Tom Brady', 'Bowman Chrome • #236 • 2000'],
  ['Shohei Ohtani', 'Topps Chrome • #150 • 2018'],
  ['Darth Vader', 'Star Wars Unlimited Shadows • #SOR-010 • 2024'],
  ['Naruto Uzumaki', 'Kayou Ninja World • #NR-01 • 2023'],
  ['Umbreon VMAX', 'Evolving Skies Alt Art • #215/203 • 2021'],
  ['Michael Jordan', 'Fleer • #57 • 1986'],
  ['Wayne Gretzky', 'O-Pee-Chee • #18 • 1979'],
  ['Serena Williams', 'Netpro Elite • #1 • 2003'],
  ['Aaron Judge', 'Bowman Chrome Refractor • #BCP-100 • 2016'],
  ['Lionel Messi', 'Panini Prizm World Cup • #200 • 2018'],
]

const CONDITIONS: Record<number, string> = { 10: 'Gem Mint', 9: 'Mint', 8: 'Near Mint-Mint' }

async function sampleData(): Promise<SlabLabelData[]> {
  let qr = ''
  try {
    const QRCode = (await import('qrcode')).default
    qr = await QRCode.toDataURL('https://dcmgrading.com/verify/DCM-000123', {
      errorCorrectionLevel: 'M', margin: 1, width: 420,
    })
  } catch {
    // 1×1 white pixel placeholder — the `qrcode` package should be installed.
    qr = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  }
  return NAMES.map(([primaryName, contextLine], i) => {
    const grade = [10, 9, 8][i % 3]
    return {
      primaryName,
      contextLine,
      features: [],
      featuresLine: i % 4 === 0 ? 'Rookie • Holo' : null,
      serial: `DCM-${String(123 + i).padStart(6, '0')}`,
      grade,
      gradeFormatted: String(grade),
      condition: CONDITIONS[grade],
      qrCodeDataUrl: qr,
      subScores: {
        centering: grade - 0.5,
        corners: grade,
        edges: grade,
        surface: grade - (i % 2 === 0 ? 0 : 0.5),
      },
      showFounderEmblem: i % 5 === 0,
      showVipEmblem: i % 7 === 0,
      showCardLoversEmblem: false,
    } as SlabLabelData
  })
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true })
  const { renderToBuffer } = await import('@react-pdf/renderer')
  const vector = await import('../src/lib/labels/vectorSlabGenerator')
  const heritage = await import('../src/lib/labels/heritageSlabGenerator')
  const { resolveHeritageBandColors } = await import('../src/lib/labelLab/heritageLayout')
  const { resolveSheetGeometry } = await import('../src/lib/labels/sheetGeometry')

  const data = await sampleData()
  const bands = ['#7c3aed', '#4c1d95', '#a855f7']
  const data30 = [...data, ...data.slice(0, 10).map(d => ({ ...d, serial: d.serial.replace('DCM-', 'DCM-9') }))]
  const data26 = data30.slice(0, 26)
  const heritageOf = (arr: SlabLabelData[]) => arr.map(d => ({
    data: d,
    bandColors: resolveHeritageBandColors(null) ?? ['#7c3aed', '#4c1d95', '#a855f7'],
  }))
  const heritageItems = data.map(d => ({
    data: d,
    bandColors: resolveHeritageBandColors(null) ?? bands,
  }))

  const jobs: Array<{ file: string; doc: () => Promise<any> }> = [
    {
      file: 'modern-standard-10up.pdf',
      doc: async () => vector.buildBatchSlabLabelsDoc(data, 'modern', 'standard'),
    },
    {
      file: 'modern-dense-20up.pdf',
      doc: async () => vector.buildBatchSlabLabelsDoc(data, 'modern', 'dense'),
    },
    {
      file: 'traditional-dense-20up.pdf',
      doc: async () => vector.buildBatchSlabLabelsDoc(data, 'traditional', 'dense'),
    },
    {
      file: 'heritage-standard-2.8x0.8-dense-20up.pdf',
      doc: () => heritage.buildBatchHeritageSlabLabelsDoc(
        heritageItems, 'diamond', null, { widthIn: 2.8, heightIn: 0.8 }, 'dense'),
    },
    {
      file: 'heritage-zion-2.51x0.76-dense-20up.pdf',
      doc: () => heritage.buildBatchHeritageSlabLabelsDoc(
        heritageItems, 'diamond', null, { widthIn: 2.51, heightIn: 0.76 }, 'dense'),
    },
    {
      file: 'heritage-zion-2.51x0.76-standard-10up.pdf',
      doc: () => heritage.buildBatchHeritageSlabLabelsDoc(
        heritageItems, 'diamond', null, { widthIn: 2.51, heightIn: 0.76 }, 'standard'),
    },
    // True-size pre-perforated sheets: full sheets of sample labels.
    ...(['up26', 'up30'] as const).flatMap(density => {
      const n = density === 'up26' ? 26 : 30
      const d = density === 'up26' ? data26 : data30
      return (['long', 'short'] as const).flatMap(flip => {
        const layout = { density, duplexFlip: flip }
        const tag = `${n}up-truesize-${flip}-edge`
        return [
          { file: `modern-${tag}.pdf`, doc: async () => vector.buildBatchSlabLabelsDoc(d, 'modern', layout) },
          { file: `traditional-${tag}.pdf`, doc: async () => vector.buildBatchClassicSlabLabelsDoc(d, {}, layout) },
          {
            file: `heritage-${tag}.pdf`,
            doc: () => heritage.buildBatchHeritageSlabLabelsDoc(heritageOf(d), 'diamond', null, { widthIn: 2.8, heightIn: 0.8 }, layout),
          },
        ]
      })
    }),
  ]

  for (const job of jobs) {
    const buf = await renderToBuffer((await job.doc()) as any)
    const dest = path.join(outDir, job.file)
    fs.writeFileSync(dest, buf)
    console.log(`${dest}  ${(buf.length / 1024).toFixed(1)} KB`)
  }

  // Duplex alignment test + vendor spec for each true-size sheet (jsPDF).
  const { buildPerforatedCalibrationDoc } = await import('../src/lib/labels/sheetCalibrationPdf')
  for (const density of ['up26', 'up30'] as const) {
    for (const duplexFlip of ['long', 'short'] as const) {
      const doc = buildPerforatedCalibrationDoc({ density, duplexFlip })
      const dest = path.join(outDir, `alignment-test-${density === 'up26' ? 26 : 30}up-${duplexFlip}-edge.pdf`)
      fs.writeFileSync(dest, Buffer.from(doc.output('arraybuffer')))
      console.log(dest)
    }
  }

  for (const [w, h] of [[2.8, 0.8], [2.51, 0.76]] as const) {
    for (const density of ['standard', 'dense'] as const) {
      const g = resolveSheetGeometry({ labelWIn: w, labelHIn: h, density })
      console.log(
        `${density.padEnd(8)} ${w}"x${h}": rows ${g.rows}, ${g.labelsPerPage}/sheet, ` +
        `gapY ${(g.gapY / 72).toFixed(3)}", first label y ${(g.firstLabelY / 72).toFixed(3)}", ` +
        `last label bottom ${((g.firstLabelY + (g.rows - 1) * g.cellH + g.labelH) / 72).toFixed(3)}", ` +
        `margins ${g.marginTopIn}"/${g.marginBottomIn}"`,
      )
    }
  }
}

main().catch(err => { console.error(err); process.exit(1) })
