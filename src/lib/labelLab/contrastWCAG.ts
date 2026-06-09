/**
 * WCAG-correct contrast helpers for the Label Lab.
 *
 * The existing src/lib/colorExtractor.ts has a luminance() function that
 * uses Rec.601 weighted-average / 255 (no sRGB linearization). That's
 * fine for picking-a-photo-thumbnail heuristics but it misclassifies
 * mid-saturation colors when deciding text legibility. These helpers
 * are the proper version: sRGB-linearized relative luminance and the
 * WCAG 2.1 contrast-ratio formula.
 *
 * Intentionally separate from colorExtractor.ts so production callers
 * keep their current behaviour while the Lab validates this approach.
 * If/when we promote this to production, the migration is a one-import
 * change per call site.
 */

export type Rgb = { r: number; g: number; b: number }

/** Convert "#rrggbb" or "#rgb" to an Rgb object. Returns null on bad input. */
export function parseHex(hex: string): Rgb | null {
  if (!hex) return null
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) {
    h = h.split('').map(c => c + c).join('')
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

/** Inverse — Rgb back to "#rrggbb". */
export function toHex(rgb: Rgb): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${c(rgb.r)}${c(rgb.g)}${c(rgb.b)}`
}

/**
 * sRGB-linearize a single channel value (0-255 input, 0-1 output).
 * This is the gamma decode step the Rec.601 luminance skipped. WCAG 2.x
 * mandates this; without it the contrast ratio numbers are wrong for
 * mid-saturation colors.
 */
function srgbToLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/**
 * WCAG 2.x relative luminance. Range 0 (black) to 1 (white). Use this
 * everywhere we're deciding text legibility, not the Rec.601 helper in
 * colorExtractor.ts.
 */
export function relativeLuminanceWCAG(rgb: Rgb): number {
  const r = srgbToLinear(rgb.r)
  const g = srgbToLinear(rgb.g)
  const b = srgbToLinear(rgb.b)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * WCAG 2.x contrast ratio between two colors. Range 1:1 (no contrast)
 * to 21:1 (black on white). Standard thresholds:
 *   - 3:1   minimum for large bold text (24pt+ or 18.66pt bold)
 *   - 4.5:1 minimum for normal body text on screen
 *   - 7:1   AAA grade for body text on screen
 *
 * For PRINT we target 7:1 even on body text because contrast compresses
 * by roughly 1.5-2 stops between screen and paper (paper white isn't pure
 * white, dot gain darkens edges, ambient light eats highlights).
 */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminanceWCAG(a)
  const lb = relativeLuminanceWCAG(b)
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)
  return (lighter + 0.05) / (darker + 0.05)
}

/** Convenience: contrastRatio that takes hex strings directly. */
export function contrastRatioHex(a: string, b: string): number {
  const pa = parseHex(a)
  const pb = parseHex(b)
  if (!pa || !pb) return 1
  return contrastRatio(pa, pb)
}

/**
 * Given a background color, return the better text color choice between
 * a near-black and a near-white candidate. Uses near-black #0a0a0a
 * rather than pure #000 to avoid CMYK trapping on cheap printers, and
 * near-white #fafafa rather than pure #fff for the same reason.
 */
export function pickContrastText(bg: Rgb): { color: Rgb; ratio: number; choice: 'light' | 'dark' } {
  const NEAR_WHITE: Rgb = { r: 250, g: 250, b: 250 }
  const NEAR_BLACK: Rgb = { r: 10, g: 10, b: 10 }
  const whiteRatio = contrastRatio(bg, NEAR_WHITE)
  const blackRatio = contrastRatio(bg, NEAR_BLACK)
  if (blackRatio > whiteRatio) {
    return { color: NEAR_BLACK, ratio: blackRatio, choice: 'dark' }
  }
  return { color: NEAR_WHITE, ratio: whiteRatio, choice: 'light' }
}

/** Hex version of pickContrastText. */
export function pickContrastTextHex(bgHex: string): { hex: string; ratio: number; choice: 'light' | 'dark' } {
  const bg = parseHex(bgHex)
  if (!bg) return { hex: '#fafafa', ratio: 1, choice: 'light' }
  const r = pickContrastText(bg)
  return { hex: toHex(r.color), ratio: r.ratio, choice: r.choice }
}

/**
 * Linear interpolation between two Rgb colors.
 * Used to sample contrast at multiple points along a gradient. Note this
 * interpolates in sRGB display space, not linear-light space, because
 * that's the path the renderer actually paints (and the path a printer
 * actually rasterises).
 */
export function lerpRgb(a: Rgb, b: Rgb, t: number): Rgb {
  const clamp = (n: number) => Math.max(0, Math.min(255, n))
  return {
    r: clamp(a.r + (b.r - a.r) * t),
    g: clamp(a.g + (b.g - a.g) * t),
    b: clamp(a.b + (b.b - a.b) * t),
  }
}

export interface GradientContrastSample {
  /** Position along the gradient direction in [0, 1]. */
  t: number
  /** Background color at this sample point. */
  bg: Rgb
  /** Contrast ratio between bg and the chosen text color. */
  ratio: number
  /** True if this sample point passes the requested threshold. */
  pass: boolean
}

export interface GradientContrastReport {
  samples: GradientContrastSample[]
  /** Minimum contrast across all sample points. The worst weakest link. */
  minRatio: number
  /** Maximum contrast across all sample points. */
  maxRatio: number
  /** Whether every sample point passes the threshold. */
  allPass: boolean
  /** Threshold used (e.g. 4.5 for screen, 7.0 for print). */
  threshold: number
}

/**
 * Sample contrast at N evenly-spaced points along a two-stop linear
 * gradient against a fixed text color. Returns the worst, best, and per
 * point detail so the UI can warn about mid-band failures.
 *
 * Defaults: 5 samples at t = 0, 0.25, 0.5, 0.75, 1.0 with the 7:1 print
 * threshold. Override `threshold` to 4.5 if you want screen-grade only.
 */
export function sampleGradientContrast(
  startHex: string,
  endHex: string,
  textHex: string,
  options: { samples?: number; threshold?: number } = {},
): GradientContrastReport {
  const samples = options.samples ?? 5
  const threshold = options.threshold ?? 7
  const start = parseHex(startHex)
  const end = parseHex(endHex)
  const text = parseHex(textHex)
  if (!start || !end || !text) {
    return {
      samples: [],
      minRatio: 1,
      maxRatio: 1,
      allPass: false,
      threshold,
    }
  }
  const out: GradientContrastSample[] = []
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < samples; i++) {
    const t = samples === 1 ? 0.5 : i / (samples - 1)
    const bg = lerpRgb(start, end, t)
    const ratio = contrastRatio(bg, text)
    out.push({ t, bg, ratio, pass: ratio >= threshold })
    if (ratio < min) min = ratio
    if (ratio > max) max = ratio
  }
  return {
    samples: out,
    minRatio: min,
    maxRatio: max,
    allPass: out.every(s => s.pass),
    threshold,
  }
}

/**
 * Apply print-safe color tweaks to a sRGB color before rasterising.
 *
 * Two adjustments based on industry print best practice:
 *   - DARK colors are pushed slightly darker so they don't print muddy
 *     on consumer inkjets (which over-add yellow/cyan and turn deep
 *     purples into brown-grey).
 *   - SATURATED colors lose a small amount of saturation so they don't
 *     blow out the printer's gamut and print noisy.
 *
 * `intensity` 0 = no change, 1 = full tweak. Default 0.5 is a sensible
 * starting point for consumer inkjets; you can A/B against 0 in the lab
 * to confirm the visual improvement on real paper.
 */
export function printColorTweaks(rgb: Rgb, intensity: number = 0.5): Rgb {
  const lum = relativeLuminanceWCAG(rgb)
  const darken = lum < 0.2 ? 0.10 * intensity : 0 // pull dark colors 10% darker max
  const desat = 0.07 * intensity // small global desaturation, max 7%

  // Step 1: darken
  let r = rgb.r * (1 - darken)
  let g = rgb.g * (1 - darken)
  let b = rgb.b * (1 - darken)

  // Step 2: desaturate (move every channel toward the channel average)
  const avg = (r + g + b) / 3
  r = r + (avg - r) * desat
  g = g + (avg - g) * desat
  b = b + (avg - b) * desat

  return {
    r: Math.max(0, Math.min(255, Math.round(r))),
    g: Math.max(0, Math.min(255, Math.round(g))),
    b: Math.max(0, Math.min(255, Math.round(b))),
  }
}

/** Hex convenience. */
export function printColorTweaksHex(hex: string, intensity: number = 0.5): string {
  const rgb = parseHex(hex)
  if (!rgb) return hex
  return toHex(printColorTweaks(rgb, intensity))
}
