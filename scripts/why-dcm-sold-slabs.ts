/**
 * Renders the Heritage slab images for the /why-dcm sold-results strip
 * (src/components/marketing/SoldProofStrip.tsx). Label is drawn with the real
 * HeritageLabelPreview, same as scripts/blog-dcm-sold-report.ts; prices are
 * drawn by the page, not baked into the image.
 *
 *   npx tsx scripts/why-dcm-sold-slabs.ts
 *
 * Writes public/why-dcm/sold/<serial>.webp for each card in SOLD_PROOF, plus
 * public/why-dcm/sold/email/<serial>.jpg for the post-grade email.
 */
import * as dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'
import { SOLD_PROOF } from '../src/data/soldProof'
dotenv.config({ path: '.env.local', quiet: true })

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const OUT = path.join('public', 'why-dcm', 'sold')
const LOGO_BLACK = fs.readFileSync('public/DCM-logo-black.png')

async function heritageLabelPng(labelData: any, cardColors: any, widthPx: number): Promise<Buffer> {
  const { HeritageLabelPreview } = await import('../src/components/labels/HeritageLabelPreview')
  const { toSlabLabelData } = await import('../src/lib/labels/slabLabelDataAdapter')
  const { resolveHeritageBandColors, fitHeritageFront, heritageMarkBox, heritageGeometry } = await import('../src/lib/labelLab/heritageLayout')
  const data = toSlabLabelData(labelData, { qrCodeDataUrl: '' } as any)
  let svg = renderToStaticMarkup(React.createElement(HeritageLabelPreview, {
    data, side: 'front', pattern: 'diamond', bandColors: resolveHeritageBandColors(cardColors), suppressImages: true,
  } as any))
  if (!svg.includes('xmlns=')) svg = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
  if (!/<svg[^>]*\swidth=/.test(svg)) svg = svg.replace('<svg ', '<svg width="1400" height="400" ')
  const geom = heritageGeometry(null)
  const fit = fitHeritageFront(data.primaryName || 'Card', data.contextLine || '', data.serial, geom)
  const box = heritageMarkBox(1, fit, geom)
  const mark = await sharp(LOGO_BLACK).resize(Math.round(box.w), Math.round(box.h), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
  const label = await sharp(Buffer.from(svg), { density: 144 }).resize(1400, 400).png().toBuffer()
  const withMark = await sharp(label).composite([{ input: mark, left: Math.round(box.x), top: Math.round(box.y) }]).png().toBuffer()
  return sharp(withMark).resize(widthPx).png().toBuffer()
}

async function cardPhoto(frontPath: string): Promise<Buffer> {
  const dir = frontPath.slice(0, frontPath.lastIndexOf('/'))
  for (const p of [`${dir}/front_display.jpg`, frontPath]) {
    const { data } = await s.storage.from('cards').download(p)
    if (data) return Buffer.from(await data.arrayBuffer())
  }
  throw new Error(`no photo for ${frontPath}`)
}

/** Label over photo in a rounded slab, transparent outside the slab. */
async function slab(labelData: any, cardColors: any, photo: Buffer): Promise<Buffer> {
  const SW = 520, PAD = 14
  const LH = Math.round(SW * 400 / 1400)
  const WIN_W = SW - PAD * 2, WIN_H = Math.round(WIN_W * 1.4)
  const SH = LH + PAD + WIN_H + PAD
  const label = await heritageLabelPng(labelData, cardColors, SW)
  const pic = await sharp(photo).rotate().resize(WIN_W, WIN_H, { fit: 'contain', background: '#EEF0F4' }).png().toBuffer()
  const base = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}">
    <rect x="0.5" y="0.5" width="${SW - 1}" height="${SH - 1}" rx="18" fill="#FFFFFF" stroke="#C9CED6"/>
    <rect x="${PAD}" y="${LH + PAD}" width="${WIN_W}" height="${WIN_H}" fill="#EEF0F4"/></svg>`)
  const lines = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}">
    <rect x="0" y="${LH}" width="${SW}" height="2" fill="#101014"/></svg>`)
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}"><rect width="${SW}" height="${SH}" rx="18" fill="#fff"/></svg>`)
  const composed = await sharp(base).composite([
    { input: label, top: 0, left: 0 },
    { input: pic, top: LH + PAD, left: PAD },
    { input: lines, top: 0, left: 0 },
  ]).png().toBuffer()
  return sharp(composed).composite([{ input: mask, blend: 'dest-in' }]).webp({ quality: 86 }).toBuffer()
}

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  for (const sale of SOLD_PROOF.examples) {
    const { data: c, error } = await s.from('cards').select('serial, front_path, label_data, card_colors, visibility').eq('id', sale.cardId).single()
    if (error || !c) throw error ?? new Error(`card ${sale.cardId} missing`)
    if (c.visibility !== 'public') throw new Error(`${sale.name} is not public`)
    const buf = await slab(c.label_data, c.card_colors, await cardPhoto(c.front_path))
    fs.writeFileSync(path.join(OUT, `${c.serial}.webp`), buf)
    // Emails get a flattened JPG: Outlook and older clients do not render WebP.
    fs.mkdirSync(path.join(OUT, 'email'), { recursive: true })
    await sharp(buf).flatten({ background: '#ffffff' }).resize(340).jpeg({ quality: 85 }).toFile(path.join(OUT, 'email', `${c.serial}.jpg`))
    console.log(`${sale.name}: ${OUT}/${c.serial}.webp (${Math.round(buf.length / 1024)} KB)`)
  }
})().catch(e => { console.error(e); process.exit(1) })
