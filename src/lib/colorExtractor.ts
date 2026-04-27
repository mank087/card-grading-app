/**
 * Card Color Extractor
 *
 * Extracts dominant colors from a card image for color-matched labels.
 * Uses zone-based pixel sampling to separate:
 *   - Background (outer ring — desk/table, excluded)
 *   - Card border (Pokemon yellow, MTG black, etc.)
 *   - Card artwork (inner region — the true card colors)
 *   - Top artwork edge (for Card Extension label style)
 *
 * Client-side: call extractCardColors(imageUrl)
 * Server-side: see serverColorExtractor.ts
 */

export interface CardColors {
  primary: string        // Hex — dominant artwork color
  secondary: string      // Hex — second artwork color
  palette: string[]      // Top 5 artwork colors
  isDark: boolean        // Whether primary is dark (for text contrast)
  borderColor: string    // Detected card border/frame color
  topEdgeColors: string[] // Sampled colors across top artwork edge (for Card Extension)
}

interface RGB { r: number; g: number; b: number }

function rgbToHex({ r, g, b }: RGB): string {
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')
}

function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : { r: 0, g: 0, b: 0 }
}

function luminance({ r, g, b }: RGB): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

function colorDistance(a: RGB, b: RGB): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2)
}

/**
 * k-means clustering for color quantization.
 */
function kMeansClusters(pixels: RGB[], k: number = 6, iterations: number = 12): RGB[] {
  if (pixels.length === 0) return [{ r: 128, g: 128, b: 128 }]
  if (pixels.length <= k) return pixels

  const centroids: RGB[] = []
  const step = Math.floor(pixels.length / k)
  for (let i = 0; i < k; i++) centroids.push({ ...pixels[i * step] })

  for (let iter = 0; iter < iterations; iter++) {
    const clusters: RGB[][] = Array.from({ length: k }, () => [])
    for (const pixel of pixels) {
      let minDist = Infinity, closest = 0
      for (let c = 0; c < centroids.length; c++) {
        const d = colorDistance(pixel, centroids[c])
        if (d < minDist) { minDist = d; closest = c }
      }
      clusters[closest].push(pixel)
    }
    for (let c = 0; c < k; c++) {
      if (clusters[c].length === 0) continue
      const sum = clusters[c].reduce((acc, p) => ({
        r: acc.r + p.r, g: acc.g + p.g, b: acc.b + p.b
      }), { r: 0, g: 0, b: 0 })
      centroids[c] = {
        r: Math.round(sum.r / clusters[c].length),
        g: Math.round(sum.g / clusters[c].length),
        b: Math.round(sum.b / clusters[c].length),
      }
    }
  }

  // Sort by frequency
  const counts: number[] = new Array(k).fill(0)
  for (const pixel of pixels) {
    let minDist = Infinity, closest = 0
    for (let c = 0; c < centroids.length; c++) {
      const d = colorDistance(pixel, centroids[c])
      if (d < minDist) { minDist = d; closest = c }
    }
    counts[closest]++
  }

  return centroids.map((c, i) => ({ color: c, count: counts[i] }))
    .sort((a, b) => b.count - a.count)
    .map(x => x.color)
}

/**
 * Filter out near-white, near-black, and very desaturated colors.
 */
function filterInterestingColors(colors: RGB[]): RGB[] {
  return colors.filter(c => {
    const lum = luminance(c)
    if (lum < 0.08 || lum > 0.92) return false
    const max = Math.max(c.r, c.g, c.b)
    const min = Math.min(c.r, c.g, c.b)
    const saturation = max === 0 ? 0 : (max - min) / max
    if (saturation < 0.1 && lum > 0.3 && lum < 0.7) return false
    return true
  })
}

/**
 * Detect if the outer ring is a uniform background color (desk/table).
 * Returns true if the outer pixels are significantly different from inner pixels.
 */
function detectBackground(outerPixels: RGB[], innerPixels: RGB[]): RGB | null {
  if (outerPixels.length < 10 || innerPixels.length < 10) return null

  // Cluster outer ring into 3 colors
  const outerClusters = kMeansClusters(outerPixels, 3, 8)
  // Get the dominant outer color
  const dominant = outerClusters[0]

  // Check if dominant outer color is significantly different from inner artwork
  const innerClusters = kMeansClusters(innerPixels, 4, 8)
  const minDistToInner = Math.min(...innerClusters.map(c => colorDistance(dominant, c)))

  // If outer dominant is far from any inner cluster, it's background
  if (minDistToInner > 60) return dominant

  return null
}

/**
 * Sample pixels from a specific rectangular zone of image data.
 */
function sampleZone(
  imageData: ImageData,
  w: number, h: number,
  x1: number, y1: number,
  x2: number, y2: number,
  step: number = 1
): RGB[] {
  const pixels: RGB[] = []
  for (let y = y1; y < y2; y += step) {
    for (let x = x1; x < x2; x += step) {
      const i = (y * w + x) * 4
      pixels.push({ r: imageData.data[i], g: imageData.data[i + 1], b: imageData.data[i + 2] })
    }
  }
  return pixels
}

/**
 * Extract dominant colors from a card image URL (client-side).
 * Uses zone-based sampling to separate background, border, and artwork.
 */
export async function extractCardColors(imageUrl: string): Promise<CardColors> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('extractCardColors requires browser environment'))
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const w = 100
        const h = Math.round(w * (img.height / img.width))
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        const imageData = ctx.getImageData(0, 0, w, h)

        // --- Zone definitions (as fractions of image dimensions) ---
        // Outer ring: outermost 12% on each side (background/desk)
        const outerFrac = 0.12
        // Border zone: 12%-22% from edge (card border/frame)
        const borderInner = 0.22
        // Artwork zone: inner 56% (22% inset on each side)
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

        // --- Sample each zone ---
        // Outer ring pixels (top, bottom, left, right strips)
        const outerPixels = [
          ...sampleZone(imageData, w, h, 0, 0, w, outerT),           // top strip
          ...sampleZone(imageData, w, h, 0, outerB, w, h),           // bottom strip
          ...sampleZone(imageData, w, h, 0, outerT, outerL, outerB), // left strip
          ...sampleZone(imageData, w, h, outerR, outerT, w, outerB), // right strip
        ]

        // Border zone pixels (between outer ring and artwork)
        const borderPixels = [
          ...sampleZone(imageData, w, h, outerL, outerT, borderL, outerB),  // left border
          ...sampleZone(imageData, w, h, borderR, outerT, outerR, outerB),  // right border
          ...sampleZone(imageData, w, h, outerL, outerT, outerR, borderT),  // top border
          ...sampleZone(imageData, w, h, outerL, borderB, outerR, outerB),  // bottom border
        ]

        // Artwork zone (center)
        const artworkPixels = sampleZone(imageData, w, h, artL, artT, artR, artB)

        // Top artwork edge strip (for Card Extension style)
        // Top 15% of the artwork zone, sampled across full width of artwork
        const topStripH = Math.max(2, Math.round((artB - artT) * 0.15))
        const topEdgePixels = sampleZone(imageData, w, h, artL, artT, artR, artT + topStripH)

        // --- Background detection ---
        // If outer ring is a uniform color very different from artwork, exclude it
        const bgColor = detectBackground(outerPixels, artworkPixels)

        // --- Artwork color extraction ---
        const artClusters = kMeansClusters(artworkPixels, 8, 12)
        let artInteresting = filterInterestingColors(artClusters)

        // If background was detected, also remove artwork clusters too close to it
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
        const borderClusters = kMeansClusters(borderPixels, 4, 8)
        // The dominant border cluster that isn't background
        let borderDominant = borderClusters[0]
        if (bgColor) {
          const nonBgBorder = borderClusters.filter(c => colorDistance(c, bgColor) > 40)
          if (nonBgBorder.length > 0) borderDominant = nonBgBorder[0]
        }

        // --- Top edge colors (for Card Extension gradient) ---
        // Sample evenly across the top artwork strip for a multi-color gradient
        const topEdgeSamples: string[] = []
        const sampleCount = 12
        const stripW = artR - artL
        for (let i = 0; i < sampleCount; i++) {
          const sx = artL + Math.round((i / (sampleCount - 1)) * (stripW - 1))
          const sy = artT + Math.round(topStripH / 2) // middle of top strip
          const idx = (sy * w + sx) * 4
          topEdgeSamples.push(rgbToHex({
            r: imageData.data[idx],
            g: imageData.data[idx + 1],
            b: imageData.data[idx + 2],
          }))
        }

        resolve({
          primary: rgbToHex(primary),
          secondary: rgbToHex(secondary),
          palette: finalArt.slice(0, 5).map(rgbToHex),
          isDark: luminance(primary) < 0.5,
          borderColor: rgbToHex(borderDominant),
          topEdgeColors: topEdgeSamples,
        })
      } catch (err) {
        reject(err)
      }
    }

    img.onerror = () => reject(new Error('Failed to load image for color extraction'))
    img.src = imageUrl
  })
}

/**
 * Get contrasting text color (white or dark) for a given background.
 */
export function getContrastText(hexColor: string): string {
  const rgb = hexToRgb(hexColor)
  return luminance(rgb) > 0.5 ? '#1f2937' : '#ffffff'
}

/**
 * Darken a color by a percentage (0-1).
 */
export function darkenColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex)
  return rgbToHex({
    r: Math.round(rgb.r * (1 - amount)),
    g: Math.round(rgb.g * (1 - amount)),
    b: Math.round(rgb.b * (1 - amount)),
  })
}

/**
 * Lighten a color by a percentage (0-1).
 */
export function lightenColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex)
  return rgbToHex({
    r: Math.min(255, Math.round(rgb.r + (255 - rgb.r) * amount)),
    g: Math.min(255, Math.round(rgb.g + (255 - rgb.g) * amount)),
    b: Math.min(255, Math.round(rgb.b + (255 - rgb.b) * amount)),
  })
}

/**
 * Mix two colors by a ratio (0 = all color1, 1 = all color2).
 */
export function mixColors(hex1: string, hex2: string, ratio: number): string {
  const c1 = hexToRgb(hex1)
  const c2 = hexToRgb(hex2)
  return rgbToHex({
    r: Math.round(c1.r * (1 - ratio) + c2.r * ratio),
    g: Math.round(c1.g * (1 - ratio) + c2.g * ratio),
    b: Math.round(c1.b * (1 - ratio) + c2.b * ratio),
  })
}
