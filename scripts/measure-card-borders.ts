// Independent border/centering measurement from a card photo — the verification
// instrument that proved the Aug 26 2026 centering miss (1969 Topps Merlin Olsen:
// top 41px, bottom 87px = 32/68, graded 10 at "52/48").
//   npx tsx scripts/measure-card-borders.ts <front.jpg> [more.jpg...]
// CAVEAT: assumes a CREAM/WHITE border on a dark background. It is NOT valid for
// yellow-bordered Pokemon, full-bleed, or light-background photos.
// Border measurement in narrow strips at the midpoint of each edge (rotation is
// negligible over a narrow strip), plus a side-by-side proof image.
import sharp from 'sharp'
import fs from 'fs'

const DIR = 'C:/Users/benja/AppData/Local/Temp/claude/C--Users-benja-card-grading-app/80e8f197-0b09-4622-93d3-0e10e9cf47a2/scratchpad/jr'

type Px = (x: number, y: number) => number[]
async function load(file: string) {
  const { data, info } = await sharp(file).rotate().raw().toBuffer({ resolveWithObject: true })
  const w = info.width, h = info.height, ch = info.channels
  const px: Px = (x, y) => { const i = (y * w + x) * ch; return [data[i], data[i + 1], data[i + 2]] }
  const lum = (x: number, y: number) => { const [r, g, b] = px(x, y); return 0.299 * r + 0.587 * g + 0.114 * b }
  const sat = (x: number, y: number) => { const [r, g, b] = px(x, y); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx }
  return { w, h, lum, sat }
}

async function measure(file: string, label: string) {
  const { w, h, lum, sat } = await load(file)
  const cream = (x: number, y: number) => sat(x, y) < 0.24 && lum(x, y) > 135
  const card = (x: number, y: number) => lum(x, y) > 105
  const median = (a: number[]) => { const b = a.filter(Number.isFinite).sort((p, q) => p - q); return b.length ? b[Math.floor(b.length / 2)] : NaN }

  // vertical scan (top/bottom): sample columns across the middle 40% of the width
  const cols = Array.from({ length: 41 }, (_, k) => Math.round(w * (0.30 + 0.40 * k / 40)))
  const rows = Array.from({ length: 41 }, (_, k) => Math.round(h * (0.30 + 0.40 * k / 40)))
  /** from an image edge, find the card edge, then the cream run, return its width */
  const scan = (n: number, get: (i: number) => { card: boolean; cream: boolean }) => {
    let i = 0
    while (i < n * 0.5 && !get(i).card) i++          // background
    const edge = i
    let run = 0
    for (; i < n * 0.5; i++) {
      const s = get(i)
      if (s.cream) run++
      else if (run >= 8) return { width: i - edge, edge }
      else run = 0
    }
    return { width: NaN, edge }
  }
  const top = median(cols.map(x => scan(h, (y) => ({ card: card(x, y), cream: cream(x, y) })).width))
  const bottom = median(cols.map(x => scan(h, (y) => ({ card: card(x, h - 1 - y), cream: cream(x, h - 1 - y) })).width))
  const left = median(rows.map(y => scan(w, (x) => ({ card: card(x, y), cream: cream(x, y) })).width))
  const right = median(rows.map(y => scan(w, (x) => ({ card: card(w - 1 - x, y), cream: cream(w - 1 - x, y) })).width))
  const pct = (a: number, b: number) => `${Math.round(a / (a + b) * 100)}/${Math.round(b / (a + b) * 100)}`
  console.log(`${label}`)
  console.log(`  border px:  top ${top}  bottom ${bottom}  left ${left}  right ${right}`)
  console.log(`  T/B ${pct(top, bottom)}   L/R ${pct(left, right)}   top:bottom = 1 : ${(bottom / top).toFixed(2)}`)
  return { top, bottom, left, right }
}

/** Proof image: top edge strip and bottom edge strip (flipped) side by side. */
async function proof(file: string, out: string) {
  const meta = await sharp(file).rotate().metadata()
  const W = meta.width!, H = meta.height!
  const sw = Math.round(W * 0.34), sx = Math.round(W * 0.33)
  const sh = Math.round(H * 0.16)
  const topStrip = await sharp(file).rotate().extract({ left: sx, top: 0, width: sw, height: sh }).toBuffer()
  const botStrip = await sharp(file).rotate().extract({ left: sx, top: H - sh, width: sw, height: sh }).flip().toBuffer()
  const GAP = 40, LBL = 70
  const canvasW = sw * 2 + GAP * 3, canvasH = sh + LBL + GAP
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}">
    <text x="${GAP + sw / 2}" y="46" font-family="Arial" font-size="34" font-weight="bold" fill="#fff" text-anchor="middle">TOP border</text>
    <text x="${GAP * 2 + sw + sw / 2}" y="46" font-family="Arial" font-size="34" font-weight="bold" fill="#fff" text-anchor="middle">BOTTOM border (flipped)</text>
  </svg>`
  await sharp({ create: { width: canvasW, height: canvasH, channels: 3, background: '#111' } })
    .composite([{ input: topStrip, left: GAP, top: LBL }, { input: botStrip, left: GAP * 2 + sw, top: LBL }, { input: Buffer.from(svg), left: 0, top: 0 }])
    .jpeg({ quality: 92 }).toFile(out)
  console.log('proof →', out)
}

async function main() {
  await measure(`${DIR}/olsen-front.jpg`, 'OLSEN FRONT')
  await measure(`${DIR}/olsen-back.jpg`, 'OLSEN BACK')
  await proof(`${DIR}/olsen-front.jpg`, `${DIR}/olsen-proof.jpg`)
}
main().catch(e => { console.error(e); process.exit(1) })
