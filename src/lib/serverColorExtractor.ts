/**
 * Server-side Card Color Extraction
 *
 * Extracts dominant colors from card images during the grading pipeline.
 * Uses sharp for image processing (already available via Next.js).
 * Stores results in cards.card_colors JSONB column.
 *
 * Zone-based sampling:
 *   - Outer ring (12%) → background detection (excluded from palette)
 *   - Border zone (12-22%) → card border/frame color (Pokemon yellow, etc.)
 *   - Artwork zone (inner 56%) → true card artwork colors
 *   - Top artwork strip → for Card Extension label style
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface RGB { r: number; g: number; b: number }
interface CardColors {
  primary: string
  secondary: string
  palette: string[]
  isDark: boolean
  borderColor: string
  topEdgeColors: string[]
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

function kMeans(pixels: RGB[], k: number = 6, iterations: number = 12): RGB[] {
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

/** Sample pixels from a rectangular zone of a raw pixel buffer. */
function sampleZone(
  rawPixels: Buffer, w: number, h: number,
  x1: number, y1: number, x2: number, y2: number
): RGB[] {
  const pixels: RGB[] = []
  for (let y = y1; y < y2; y++) {
    for (let x = x1; x < x2; x++) {
      const i = (y * w + x) * 3
      pixels.push({ r: rawPixels[i], g: rawPixels[i + 1], b: rawPixels[i + 2] })
    }
  }
  return pixels
}

/** Detect if outer ring is a uniform background color different from artwork. */
function detectBackground(outerPixels: RGB[], innerPixels: RGB[]): RGB | null {
  if (outerPixels.length < 10 || innerPixels.length < 10) return null
  const outerClusters = kMeans(outerPixels, 3, 8)
  const dominant = outerClusters[0]
  const innerClusters = kMeans(innerPixels, 4, 8)
  const minDist = Math.min(...innerClusters.map(c => colorDistance(dominant, c)))
  return minDist > 60 ? dominant : null
}

/**
 * Extract colors from a card's front image and save to database.
 */
export async function extractAndSaveCardColors(cardId: string, frontPath: string): Promise<CardColors | null> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: urlData } = await supabase.storage.from('cards').createSignedUrl(frontPath, 300)
    if (!urlData?.signedUrl) {
      console.warn('[ColorExtractor] Could not get signed URL for', frontPath)
      return null
    }

    const response = await fetch(urlData.signedUrl)
    if (!response.ok) return null
    const buffer = Buffer.from(await response.arrayBuffer())

    let sharp: any
    try {
      sharp = require('sharp')
    } catch {
      console.warn('[ColorExtractor] sharp not available, skipping color extraction')
      return null
    }

    // Downsample to 100x140 for processing
    const w = 100
    const h = 140
    const { data: rawPixels } = await sharp(buffer)
      .resize(w, h, { fit: 'cover' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    // --- Zone definitions ---
    const outerFrac = 0.12
    const borderInner = 0.22
    const artworkInset = 0.22

    const outerL = Math.round(w * outerFrac)
    const outerT = Math.round(h * outerFrac)
    const outerR = Math.round(w * (1 - outerFrac))
    const outerB = Math.round(h * (1 - outerFrac))

    const borderL = Math.round(w * borderInner)
    const borderT = Math.round(h * borderInner)
    const borderR = Math.round(w * (1 - borderInner))
    const borderB = Math.round(h * (1 - borderInner))

    const artL = Math.round(w * artworkInset)
    const artT = Math.round(h * artworkInset)
    const artR = Math.round(w * (1 - artworkInset))
    const artB = Math.round(h * (1 - artworkInset))

    // --- Sample zones ---
    const outerPixels = [
      ...sampleZone(rawPixels, w, h, 0, 0, w, outerT),
      ...sampleZone(rawPixels, w, h, 0, outerB, w, h),
      ...sampleZone(rawPixels, w, h, 0, outerT, outerL, outerB),
      ...sampleZone(rawPixels, w, h, outerR, outerT, w, outerB),
    ]

    const borderPixels = [
      ...sampleZone(rawPixels, w, h, outerL, outerT, borderL, outerB),
      ...sampleZone(rawPixels, w, h, borderR, outerT, outerR, outerB),
      ...sampleZone(rawPixels, w, h, outerL, outerT, outerR, borderT),
      ...sampleZone(rawPixels, w, h, outerL, borderB, outerR, outerB),
    ]

    const artworkPixels = sampleZone(rawPixels, w, h, artL, artT, artR, artB)

    // --- Background detection & exclusion ---
    const bgColor = detectBackground(outerPixels, artworkPixels)

    // --- Artwork colors ---
    const artClusters = kMeans(artworkPixels, 8, 12)
    let artInteresting = filterInteresting(artClusters)
    if (bgColor) {
      artInteresting = artInteresting.filter(c => colorDistance(c, bgColor) > 50)
    }
    const finalArt = artInteresting.length >= 2 ? artInteresting : artClusters

    let primary = finalArt[0]
    let secondary = finalArt.length > 1 ? finalArt[1] : finalArt[0]
    if (colorDistance(primary, secondary) < 40 && finalArt.length > 2) {
      secondary = finalArt[2]
    }

    // --- Border color ---
    const borderClusters = kMeans(borderPixels, 4, 8)
    let borderDominant = borderClusters[0]
    if (bgColor) {
      const nonBg = borderClusters.filter(c => colorDistance(c, bgColor) > 40)
      if (nonBg.length > 0) borderDominant = nonBg[0]
    }

    // --- Top edge colors (for Card Extension) ---
    const topStripH = Math.max(2, Math.round((artB - artT) * 0.15))
    const topEdgeSamples: string[] = []
    const sampleCount = 12
    const stripW = artR - artL
    for (let i = 0; i < sampleCount; i++) {
      const sx = artL + Math.round((i / (sampleCount - 1)) * (stripW - 1))
      const sy = artT + Math.round(topStripH / 2)
      const idx = (sy * w + sx) * 3
      topEdgeSamples.push(rgbToHex({
        r: rawPixels[idx],
        g: rawPixels[idx + 1],
        b: rawPixels[idx + 2],
      }))
    }

    const cardColors: CardColors = {
      primary: rgbToHex(primary),
      secondary: rgbToHex(secondary),
      palette: finalArt.slice(0, 5).map(rgbToHex),
      isDark: luminance(primary) < 0.5,
      borderColor: rgbToHex(borderDominant),
      topEdgeColors: topEdgeSamples,
    }

    const { error } = await supabase
      .from('cards')
      .update({ card_colors: cardColors })
      .eq('id', cardId)

    if (error) {
      console.warn('[ColorExtractor] Failed to save colors:', error.message)
    } else {
      console.log('[ColorExtractor] Colors saved for card', cardId, ':', cardColors.primary, '/', cardColors.secondary, 'border:', cardColors.borderColor)
    }

    return cardColors
  } catch (err) {
    console.warn('[ColorExtractor] Error:', err)
    return null
  }
}
