/**
 * Backfill card_colors for existing graded cards.
 *
 * Usage:
 *   npx tsx scripts/backfill-card-colors.ts [--limit 100] [--dry-run]
 *
 * Processes cards that have a front_path but no card_colors yet.
 * Uses the server-side color extractor (sharp + k-means).
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// ---------- Color extraction (inline to avoid Next.js import issues) ----------

interface RGB { r: number; g: number; b: number }
interface CardColors {
  primary: string
  secondary: string
  palette: string[]
  isDark: boolean
}

function rgbToHex({ r, g, b }: RGB): string {
  return '#' + [r, g, b].map(c => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('')
}

function luminance({ r, g, b }: RGB): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

function colorDistance(a: RGB, b: RGB): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2)
}

function kMeans(pixels: RGB[], k = 8, iterations = 12): RGB[] {
  if (pixels.length <= k) return pixels
  const centroids: RGB[] = []
  const step = Math.floor(pixels.length / k)
  for (let i = 0; i < k; i++) centroids.push({ ...pixels[i * step] })

  for (let iter = 0; iter < iterations; iter++) {
    const clusters: RGB[][] = Array.from({ length: k }, () => [])
    for (const p of pixels) {
      let minD = Infinity, closest = 0
      for (let c = 0; c < centroids.length; c++) {
        const d = colorDistance(p, centroids[c])
        if (d < minD) { minD = d; closest = c }
      }
      clusters[closest].push(p)
    }
    for (let c = 0; c < k; c++) {
      if (clusters[c].length === 0) continue
      const s = clusters[c].reduce((a, p) => ({ r: a.r + p.r, g: a.g + p.g, b: a.b + p.b }), { r: 0, g: 0, b: 0 })
      centroids[c] = { r: Math.round(s.r / clusters[c].length), g: Math.round(s.g / clusters[c].length), b: Math.round(s.b / clusters[c].length) }
    }
  }

  const counts = new Array(k).fill(0)
  for (const p of pixels) {
    let minD = Infinity, closest = 0
    for (let c = 0; c < centroids.length; c++) {
      const d = colorDistance(p, centroids[c])
      if (d < minD) { minD = d; closest = c }
    }
    counts[closest]++
  }

  return centroids.map((c, i) => ({ color: c, count: counts[i] }))
    .sort((a, b) => b.count - a.count)
    .map(x => x.color)
}

function filterInteresting(colors: RGB[]): RGB[] {
  return colors.filter(c => {
    const lum = luminance(c)
    if (lum < 0.08 || lum > 0.92) return false
    const max = Math.max(c.r, c.g, c.b)
    const min = Math.min(c.r, c.g, c.b)
    if (max > 0 && (max - min) / max < 0.1 && lum > 0.3 && lum < 0.7) return false
    return true
  })
}

async function extractColors(frontPath: string): Promise<CardColors | null> {
  const { data: urlData } = await supabase.storage.from('cards').createSignedUrl(frontPath, 300)
  if (!urlData?.signedUrl) return null

  const response = await fetch(urlData.signedUrl)
  if (!response.ok) return null
  const buffer = Buffer.from(await response.arrayBuffer())

  const sharp = require('sharp')
  const { data: rawPixels } = await sharp(buffer)
    .resize(60, 84, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const pixels: RGB[] = []
  for (let i = 0; i < rawPixels.length; i += 3) {
    pixels.push({ r: rawPixels[i], g: rawPixels[i + 1], b: rawPixels[i + 2] })
  }

  const clusters = kMeans(pixels)
  const interesting = filterInteresting(clusters)
  const final = interesting.length >= 2 ? interesting : clusters

  let primary = final[0]
  let secondary = final.length > 1 ? final[1] : final[0]
  if (colorDistance(primary, secondary) < 40 && final.length > 2) secondary = final[2]

  return {
    primary: rgbToHex(primary),
    secondary: rgbToHex(secondary),
    palette: final.slice(0, 5).map(rgbToHex),
    isDark: luminance(primary) < 0.5,
  }
}

// ---------- Main ----------

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const limitIdx = args.indexOf('--limit')
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) || 100 : 9999

  console.log(`Backfilling card colors (limit: ${limit}, dry-run: ${dryRun})`)

  // Fetch cards without card_colors that have a front image
  const { data: cards, error } = await supabase
    .from('cards')
    .select('id, front_path')
    .not('front_path', 'is', null)
    .is('card_colors', null)
    .not('conversational_whole_grade', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Failed to fetch cards:', error.message)
    process.exit(1)
  }

  console.log(`Found ${cards.length} cards without colors`)

  let success = 0
  let failed = 0

  for (const card of cards) {
    try {
      const colors = await extractColors(card.front_path)
      if (!colors) {
        console.log(`  [SKIP] ${card.id} - could not extract colors`)
        failed++
        continue
      }

      if (dryRun) {
        console.log(`  [DRY] ${card.id} → ${colors.primary} / ${colors.secondary}`)
      } else {
        const { error: updateError } = await supabase
          .from('cards')
          .update({ card_colors: colors })
          .eq('id', card.id)

        if (updateError) {
          console.log(`  [ERR] ${card.id} - ${updateError.message}`)
          failed++
        } else {
          console.log(`  [OK]  ${card.id} → ${colors.primary} / ${colors.secondary}`)
          success++
        }
      }

      // Small delay to avoid rate-limiting storage
      await new Promise(r => setTimeout(r, 200))
    } catch (err: any) {
      console.log(`  [ERR] ${card.id} - ${err.message}`)
      failed++
    }
  }

  console.log(`\nDone: ${success} success, ${failed} failed, ${cards.length} total`)
}

main()
