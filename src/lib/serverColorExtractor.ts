/**
 * Server-side Card Color Extraction
 *
 * Extracts dominant colors from card images during the grading pipeline.
 * Uses sharp for image processing (already available via Next.js).
 * Stores results in cards.card_colors JSONB column.
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

function kMeans(pixels: RGB[], k: number = 6, iterations: number = 10): RGB[] {
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

  // Count and sort by frequency
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

/**
 * Extract colors from a card's front image and save to database.
 * Call this after grading completes and the front image is available.
 */
export async function extractAndSaveCardColors(cardId: string, frontPath: string): Promise<CardColors | null> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get signed URL for the front image
    const { data: urlData } = await supabase.storage.from('cards').createSignedUrl(frontPath, 300)
    if (!urlData?.signedUrl) {
      console.warn('[ColorExtractor] Could not get signed URL for', frontPath)
      return null
    }

    // Fetch the image
    const response = await fetch(urlData.signedUrl)
    if (!response.ok) return null
    const buffer = Buffer.from(await response.arrayBuffer())

    // Use sharp to downsample and get raw pixel data
    let sharp: any
    try {
      sharp = require('sharp')
    } catch {
      console.warn('[ColorExtractor] sharp not available, skipping color extraction')
      return null
    }

    const { data: rawPixels, info } = await sharp(buffer)
      .resize(60, 84, { fit: 'cover' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    // Convert raw pixel buffer to RGB array
    const pixels: RGB[] = []
    for (let i = 0; i < rawPixels.length; i += 3) {
      pixels.push({ r: rawPixels[i], g: rawPixels[i + 1], b: rawPixels[i + 2] })
    }

    // Run k-means clustering
    const clusters = kMeans(pixels, 8, 12)
    const interesting = filterInteresting(clusters)
    const final = interesting.length >= 2 ? interesting : clusters

    let primary = final[0]
    let secondary = final.length > 1 ? final[1] : final[0]
    if (colorDistance(primary, secondary) < 40 && final.length > 2) {
      secondary = final[2]
    }

    const cardColors: CardColors = {
      primary: rgbToHex(primary),
      secondary: rgbToHex(secondary),
      palette: final.slice(0, 5).map(rgbToHex),
      isDark: luminance(primary) < 0.5,
    }

    // Save to database
    const { error } = await supabase
      .from('cards')
      .update({ card_colors: cardColors })
      .eq('id', cardId)

    if (error) {
      console.warn('[ColorExtractor] Failed to save colors:', error.message)
    } else {
      console.log('[ColorExtractor] Colors saved for card', cardId, ':', cardColors.primary, cardColors.secondary)
    }

    return cardColors
  } catch (err) {
    console.warn('[ColorExtractor] Error:', err)
    return null
  }
}
