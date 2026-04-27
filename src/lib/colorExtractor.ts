/**
 * Card Color Extractor
 *
 * Extracts dominant colors from a card image for color-matched labels.
 * Uses pixel sampling and simplified k-means clustering.
 *
 * Client-side: call extractCardColors(imageUrl) → { primary, secondary, palette }
 * Server-side: call extractCardColorsFromBuffer(buffer) for grading pipeline
 */

export interface CardColors {
  primary: string      // Hex color — most dominant
  secondary: string    // Hex color — second most dominant
  palette: string[]    // Top 5 colors
  isDark: boolean      // Whether primary is dark (for text contrast)
  topEdgeColors: string[] // Pixel colors from the top edge (for Card Extension style)
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
 * Simplified k-means clustering for color quantization.
 * Groups pixels into k clusters and returns cluster centers.
 */
function kMeansClusters(pixels: RGB[], k: number = 5, iterations: number = 10): RGB[] {
  if (pixels.length === 0) return [{ r: 128, g: 128, b: 128 }]
  if (pixels.length <= k) return pixels

  // Initialize centroids by sampling evenly from pixel array
  let centroids: RGB[] = []
  const step = Math.floor(pixels.length / k)
  for (let i = 0; i < k; i++) {
    centroids.push({ ...pixels[i * step] })
  }

  for (let iter = 0; iter < iterations; iter++) {
    // Assign pixels to nearest centroid
    const clusters: RGB[][] = Array.from({ length: k }, () => [])

    for (const pixel of pixels) {
      let minDist = Infinity
      let closest = 0
      for (let c = 0; c < centroids.length; c++) {
        const d = colorDistance(pixel, centroids[c])
        if (d < minDist) { minDist = d; closest = c }
      }
      clusters[closest].push(pixel)
    }

    // Update centroids to cluster mean
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

  // Sort by cluster size (most pixels = most dominant)
  // Re-run assignment one more time to count
  const counts: number[] = new Array(k).fill(0)
  for (const pixel of pixels) {
    let minDist = Infinity
    let closest = 0
    for (let c = 0; c < centroids.length; c++) {
      const d = colorDistance(pixel, centroids[c])
      if (d < minDist) { minDist = d; closest = c }
    }
    counts[closest]++
  }

  const indexed = centroids.map((c, i) => ({ color: c, count: counts[i] }))
  indexed.sort((a, b) => b.count - a.count)

  return indexed.map(i => i.color)
}

/**
 * Filter out near-white, near-black, and very desaturated colors
 * that don't make good label colors.
 */
function filterInterestingColors(colors: RGB[]): RGB[] {
  return colors.filter(c => {
    const lum = luminance(c)
    // Skip very dark (< 0.08) and very light (> 0.92)
    if (lum < 0.08 || lum > 0.92) return false
    // Skip very desaturated (gray)
    const max = Math.max(c.r, c.g, c.b)
    const min = Math.min(c.r, c.g, c.b)
    const saturation = max === 0 ? 0 : (max - min) / max
    if (saturation < 0.1 && lum > 0.3 && lum < 0.7) return false
    return true
  })
}

/**
 * Extract dominant colors from a card image URL (client-side).
 * Draws the image to a canvas, samples pixels, runs k-means.
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
        // Downsample to 80x112 for fast processing
        const canvas = document.createElement('canvas')
        const w = 80
        const h = Math.round(w * (img.height / img.width))
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)

        // Sample ALL pixels
        const imageData = ctx.getImageData(0, 0, w, h)
        const allPixels: RGB[] = []
        for (let i = 0; i < imageData.data.length; i += 4) {
          allPixels.push({
            r: imageData.data[i],
            g: imageData.data[i + 1],
            b: imageData.data[i + 2],
          })
        }

        // Sample TOP EDGE (top 8% of image) for Card Extension style
        const topEdgeHeight = Math.max(1, Math.round(h * 0.08))
        const topEdgeData = ctx.getImageData(0, 0, w, topEdgeHeight)
        const topEdgePixels: string[] = []
        // Sample every 2nd pixel across the top edge
        for (let x = 0; x < w; x += 2) {
          const i = x * 4
          topEdgePixels.push(rgbToHex({
            r: topEdgeData.data[i],
            g: topEdgeData.data[i + 1],
            b: topEdgeData.data[i + 2],
          }))
        }

        // Run k-means on all pixels
        const clusters = kMeansClusters(allPixels, 8, 12)

        // Filter out boring colors
        const interesting = filterInterestingColors(clusters)
        const finalColors = interesting.length >= 2 ? interesting : clusters

        // Ensure primary and secondary are sufficiently different
        let primary = finalColors[0]
        let secondary = finalColors.length > 1 ? finalColors[1] : finalColors[0]

        // If too similar, try the next color
        if (colorDistance(primary, secondary) < 40 && finalColors.length > 2) {
          secondary = finalColors[2]
        }

        const palette = finalColors.slice(0, 5).map(rgbToHex)
        const isDark = luminance(primary) < 0.5

        resolve({
          primary: rgbToHex(primary),
          secondary: rgbToHex(secondary),
          palette,
          isDark,
          topEdgeColors: topEdgePixels,
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
