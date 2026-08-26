/**
 * PROTOTYPE (Aug 26 2026): strip-comparison centering. NOT wired into grading.
 *
 * Instead of asking the model for a centering ratio on a whole (heavily downscaled)
 * card, crop the two OPPOSING edges into strips at identical scale, orient both
 * background-at-top, and ask only "which border band is thicker, and by what ratio".
 * Relative comparison on a near-native-resolution crop, which the model does well,
 * instead of absolute metrology, which it does not.
 *
 * ANCHOR-SET RESULT (13 cards, 26 axes):
 *   - Verified-truth cards: Merlin Olsen T/B 33/67 (truth 32/68), Alex Karras T/B
 *     72/28 (truth: top ~2x bottom). Both correct and self-consistent.
 *   - Olsen L/R came back 61/39 when the truth is 51/49 — SELF-CONSISTENT AND WRONG,
 *     so the A/B swap check catches instability but not systematic bias.
 *   - Self-consistency under A/B swap: 16/26 (62%). T/B 9/13, L/R 7/13.
 * CONCLUSION: promising on T/B, not shippable. Failures trace back to strip
 * localisation (the geometry-gate quad) — the SAME bottleneck as pixel CV. So
 * localisation, not measurement technique, is the thing to fix.
 *
 * NEXT: n=5 voting instead of 2 calls; verified/deskewed edges before cropping;
 * a hand-measured ground-truth set to tune against.
 *
 * NOTE: luna rejects , and max_completion_tokens must be generous
 * (reasoning tokens consume it — 250 returned empty content on most calls).
 *
 *   DOTENV_CONFIG_PATH=.env.local npx tsx scripts/strip-centering-prototype.ts [--sheet]
 */
import 'dotenv/config'
import sharp from 'sharp'
import fs from 'fs'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const DIR = 'C:/Users/benja/AppData/Local/Temp/claude/C--Users-benja-card-grading-app/80e8f197-0b09-4622-93d3-0e10e9cf47a2/scratchpad/anchor-strips'
fs.mkdirSync(DIR, { recursive: true })
const SHEET_ONLY = process.argv.includes('--sheet')

type Box = { l: number; r: number; t: number; b: number }

/** Card box from the geometry gate quad, padded outward so the strip contains the
 *  true cut edge even when the model quad is well inside the card. */
function boxFromQuad(q: Array<{ x: number; y: number }>, W: number, H: number): Box {
  const xs = q.map(p => p.x), ys = q.map(p => p.y)
  const maxC = Math.max(...xs, ...ys)
  const sx = maxC <= 1000 ? W / 1000 : 1, sy = maxC <= 1000 ? H / 1000 : 1
  return { l: Math.min(...xs) * sx, r: Math.max(...xs) * sx, t: Math.min(...ys) * sy, b: Math.max(...ys) * sy }
}

/** Two opposing edge strips, identical size, both oriented background-at-top. */
async function stripPair(file: string, box: Box, axis: 'tb' | 'lr', W: number, H: number, swap: boolean) {
  const cw = box.r - box.l, chh = box.b - box.t
  const short = Math.min(cw, chh)
  const OUT = short * 0.10, IN = short * 0.20        // strip depth: outside + inside the edge
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)))
  let a: Buffer, b: Buffer
  if (axis === 'tb') {
    const x0 = clamp(box.l + cw * 0.28, 0, W - 2), ww = clamp(cw * 0.44, 8, W - x0)
    const tTop = clamp(box.t - OUT, 0, H - 2), tH = clamp(OUT + IN, 8, H - tTop)
    const bTop = clamp(box.b - IN, 0, H - 2), bH = clamp(OUT + IN, 8, H - bTop)
    a = await sharp(file).extract({ left: x0, top: tTop, width: ww, height: tH }).toBuffer()
    b = await sharp(file).extract({ left: x0, top: bTop, width: ww, height: bH }).flip().toBuffer()
  } else {
    const y0 = clamp(box.t + chh * 0.28, 0, H - 2), hh = clamp(chh * 0.44, 8, H - y0)
    const lLeft = clamp(box.l - OUT, 0, W - 2), lW = clamp(OUT + IN, 8, W - lLeft)
    const rLeft = clamp(box.r - IN, 0, W - 2), rW = clamp(OUT + IN, 8, W - rLeft)
    a = await sharp(file).extract({ left: lLeft, top: y0, width: lW, height: hh }).rotate(90).toBuffer()
    b = await sharp(file).extract({ left: rLeft, top: y0, width: rW, height: hh }).rotate(90).flip().toBuffer()
  }
  if (swap) { const t = a; a = b; b = t }
  // normalise to the same box so neither strip is scaled differently
  const ma = await sharp(a).metadata(), mb = await sharp(b).metadata()
  const w = Math.min(ma.width!, mb.width!), h = Math.min(ma.height!, mb.height!)
  const A = await sharp(a).extract({ left: 0, top: 0, width: w, height: h }).toBuffer()
  const B = await sharp(b).extract({ left: 0, top: 0, width: w, height: h }).toBuffer()
  const GAP = 50, LBL = 60
  const cwv = w * 2 + GAP * 3, chv = h + LBL + GAP
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cwv}" height="${chv}">
    <text x="${GAP + w / 2}" y="42" font-family="Arial" font-size="32" font-weight="bold" fill="#fff" text-anchor="middle">A</text>
    <text x="${GAP * 2 + w + w / 2}" y="42" font-family="Arial" font-size="32" font-weight="bold" fill="#fff" text-anchor="middle">B</text></svg>`
  return sharp({ create: { width: cwv, height: chv, channels: 3, background: '#101010' } })
    .composite([{ input: A, left: GAP, top: LBL }, { input: B, left: GAP * 2 + w, top: LBL }, { input: Buffer.from(svg), left: 0, top: 0 }])
    .jpeg({ quality: 94 }).toBuffer()
}

const PROMPT = `Two strips cropped from the SAME trading card photo, at the SAME scale.
Both are oriented the same way: BACKGROUND at the top, then the card's CUT EDGE, then the card's plain BORDER band, then the printed artwork/frame begins.
Strip A is one edge of the card; strip B is the OPPOSITE edge.

Compare ONLY the thickness of the plain BORDER band — from the cut edge to where the artwork or printed frame starts.

Rules:
- If this card has no plain border on these edges (the artwork runs to the cut edge, i.e. full-art/borderless), answer which:"none".
- If a strip does not clearly show a cut edge, answer which:"unclear".
- "equal" means within 10%.
- Judge only thickness. Ignore colour, wear, print quality and everything else.

Reply ONLY with JSON: {"ratio": <borderA / borderB as a decimal>, "which": "A"|"B"|"equal"|"none"|"unclear", "note": "<short>"}`

async function ask(img: Buffer) {
  const { applyModelCompat, BASELINE_MODEL } = await import('../src/lib/grading/modelRouter')
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const { config } = applyModelCompat({
    model: BASELINE_MODEL, max_completion_tokens: 3000, response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img.toString('base64')}`, detail: 'high' } }] }],
  } as any)
  const r = await openai.chat.completions.create(config as any)
  const raw = (r as any).choices[0].message.content; const fin = (r as any).choices[0].finish_reason; try { return JSON.parse(raw) } catch { return { which: "parse-error", note: `finish=${fin} len=${(raw || "").length}` } }
}

const pct = (ratio: number) => `${Math.round(ratio / (1 + ratio) * 100)}/${Math.round(100 / (1 + ratio) * 100) === 100 - Math.round(ratio / (1 + ratio) * 100) ? 100 - Math.round(ratio / (1 + ratio) * 100) : 100 - Math.round(ratio / (1 + ratio) * 100)}`

async function main() {
  const { detectCardGeometry } = await import('../src/lib/zoomInspection')
  const set = JSON.parse(fs.readFileSync('scripts/calibration-set.json', 'utf8'))
  const extra = [{ id: '367cfb13', label: 'Merlin Olsen (TRUTH T/B 32/68, L/R 51/49)' }, { id: '649b5a48', label: 'Alex Karras (TRUTH T/B: top ~2x bottom)' }]
  const cards = [...set.cards.map((c: any) => ({ id: c.id, label: c.label })), ...extra]
  const results: any[] = []
  for (const c of cards) {
    try {
      const { data: rows } = await s.from('cards').select('id, front_path, back_path, card_name').or(`id.eq.${c.id.length > 12 ? c.id : '00000000-0000-0000-0000-000000000000'}`).limit(1)
      let row: any = rows?.[0]
      if (!row) {
        const { data: all } = await s.from('cards').select('id, front_path, back_path, card_name').not('front_path', 'is', null).order('created_at', { ascending: false }).limit(800)
        row = (all as any[]).find(r => r.id.startsWith(c.id.slice(0, 8)))
      }
      if (!row) { console.log(`${c.id.slice(0, 8)} NOT FOUND`); continue }
      const f = `${DIR}/${row.id.slice(0, 8)}.jpg`
      if (!fs.existsSync(f)) {
        const u = (await s.storage.from('cards').createSignedUrl(row.front_path, 900)).data!.signedUrl
        fs.writeFileSync(f, await sharp(Buffer.from(await (await fetch(u)).arrayBuffer())).rotate().toBuffer())
      }
      const meta = await sharp(f).metadata(); const W = meta.width!, H = meta.height!
      const front = fs.readFileSync(f)
      const bu = (await s.storage.from('cards').createSignedUrl(row.back_path, 900)).data!.signedUrl
      const back = await sharp(Buffer.from(await (await fetch(bu)).arrayBuffer())).rotate().toBuffer()
      const g = await detectCardGeometry(front, back)
      if (!g.front) { console.log(`${row.id.slice(0, 8)} no quad`); continue }
      const box = boxFromQuad(g.front, W, H)
      const out: any = { id: row.id.slice(0, 8), label: c.label.slice(0, 46) }
      for (const axis of ['tb', 'lr'] as const) {
        const normal = await stripPair(f, box, axis, W, H, false)
        fs.writeFileSync(`${DIR}/${row.id.slice(0, 8)}-${axis}.jpg`, normal)
        if (SHEET_ONLY) continue
        const swapped = await stripPair(f, box, axis, W, H, true)
        const r1 = await ask(normal), r2 = await ask(swapped)
        // invert the swapped answer back to normal orientation
        const inv = (x: any) => ({ which: x.which === 'A' ? 'B' : x.which === 'B' ? 'A' : x.which, ratio: typeof x.ratio === 'number' && x.ratio > 0 ? 1 / x.ratio : x.ratio })
        const r2i = inv(r2)
        const agree = r1.which === r2i.which
        const ratios = [r1.ratio, r2i.ratio].filter((v: any) => typeof v === 'number' && v > 0 && v < 20)
        const ratio = ratios.length ? ratios.reduce((a: number, b: number) => a + b, 0) / ratios.length : null
        out[axis] = { which: r1.which, swapWhich: r2i.which, agree, ratio: ratio ? +ratio.toFixed(2) : null,
          pct: ratio ? `${Math.round(ratio / (1 + ratio) * 100)}/${100 - Math.round(ratio / (1 + ratio) * 100)}` : null, note: r1.note }
      }
      results.push(out)
      if (!SHEET_ONLY) console.log(`${out.id} ${out.label.padEnd(46)} | T/B ${String(out.tb?.pct || out.tb?.which).padEnd(7)} ${out.tb?.agree ? '✓' : '✗'} (${out.tb?.which}/${out.tb?.swapWhich}) | L/R ${String(out.lr?.pct || out.lr?.which).padEnd(7)} ${out.lr?.agree ? '✓' : '✗'} (${out.lr?.which}/${out.lr?.swapWhich})`)
      else console.log(`${out.id} strips written`)
    } catch (e: any) { console.log(`${c.id.slice(0, 8)} ERROR ${e?.message}`) }
  }
  if (!SHEET_ONLY) {
    fs.writeFileSync(`${DIR}/results.json`, JSON.stringify(results, null, 1))
    const n = results.length
    const stable = results.filter(r => r.tb?.agree && r.lr?.agree).length
    const axes = results.flatMap(r => [r.tb, r.lr]).filter(Boolean)
    const axAgree = axes.filter((a: any) => a.agree).length
    console.log(`\n=== ${n} cards, ${axes.length} axes`)
    console.log(`axis self-consistent under A/B swap: ${axAgree}/${axes.length} (${Math.round(axAgree / axes.length * 100)}%)`)
    console.log(`both axes stable: ${stable}/${n}`)
    console.log(`answered "none"/"unclear": ${axes.filter((a: any) => ['none', 'unclear'].includes(a.which)).length}`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
