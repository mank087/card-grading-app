/**
 * WCAG-correct contrast helpers — PRODUCTION (promoted from the Label Lab
 * June 2026 after paper testing).
 *
 * The existing src/lib/colorExtractor.ts has a luminance() function that
 * uses Rec.601 weighted-average / 255 (no sRGB linearization). That's
 * fine for picking-a-photo-thumbnail heuristics but it misclassifies
 * mid-saturation colors when deciding text legibility. These helpers
 * are the proper version: sRGB-linearized relative luminance and the
 * WCAG 2.1 contrast-ratio formula.
 *
 * resolveTextPolarity() is the production label text-color rule (Style
 * Gauntlet "Guard A"): pick white vs near-black per the ACTUAL background
 * stops. colorExtractor's isDark stays for non-label heuristics.
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

// ============================================================================
// Style-aware background evaluation (Label Lab custom styles)
// ============================================================================

/**
 * Expand a multi-stop background into the set of colors text actually sits
 * on. `discrete: false` (gradients) interpolates samples inside every
 * adjacent stop pair; `discrete: true` (split/geometric region fills)
 * evaluates only the exact colors — interpolated mid-colors never exist on
 * those labels and would skew the verdict.
 */
export function buildBackgroundSamples(
  stops: string[],
  options: { discrete?: boolean; samplesPerSegment?: number } = {},
): Rgb[] {
  const parsed = stops.map(parseHex).filter((c): c is Rgb => c !== null)
  if (parsed.length === 0) return []
  if (options.discrete || parsed.length === 1) return parsed
  const per = options.samplesPerSegment ?? 4
  const out: Rgb[] = []
  for (let i = 0; i < parsed.length - 1; i++) {
    for (let s = 0; s < per; s++) {
      out.push(lerpRgb(parsed[i], parsed[i + 1], s / per))
    }
  }
  out.push(parsed[parsed.length - 1])
  return out
}

export type BackgroundContrastVerdict =
  /** The style's own text color clears the threshold everywhere. */
  | 'pass'
  /** Chosen text fails, but the opposite text color passes — production's
      isDark heuristic picked wrong; auto text color would fix it. */
  | 'flip-text'
  /** NEITHER white nor near-black clears the threshold — mid-tone
      background; needs a guard (adjust background, scrim, or halo). */
  | 'guard-needed'

export interface BackgroundContrastReport {
  verdict: BackgroundContrastVerdict
  /** Worst ratio of the style's chosen text color across all samples. */
  minChosen: number
  /** The better of near-white/near-black as a single color for the whole label. */
  altHex: string
  altChoice: 'light' | 'dark'
  /** Worst ratio of that alternative across all samples. */
  minAlt: number
  threshold: number
}

const NEAR_WHITE_HEX = '#fafafa'
const NEAR_BLACK_HEX = '#0a0a0a'

/**
 * Evaluate a label background (any number of stops) against the style's
 * chosen text color AND the best single-color alternative. This is the
 * check production can't do today: its isDark flag comes from Rec.601
 * luminance of one extracted color, while text may sit on any point of a
 * multi-stop gradient.
 */
export function evaluateLabelBackground(opts: {
  stops: string[]
  textHex: string
  discrete?: boolean
  threshold?: number
}): BackgroundContrastReport {
  const threshold = opts.threshold ?? 7
  const samples = buildBackgroundSamples(opts.stops, { discrete: opts.discrete })
  const text = parseHex(opts.textHex)
  const white = parseHex(NEAR_WHITE_HEX)!
  const black = parseHex(NEAR_BLACK_HEX)!
  if (samples.length === 0 || !text) {
    return { verdict: 'guard-needed', minChosen: 1, altHex: NEAR_WHITE_HEX, altChoice: 'light', minAlt: 1, threshold }
  }
  let minChosen = Infinity
  let minWhite = Infinity
  let minBlack = Infinity
  for (const bg of samples) {
    minChosen = Math.min(minChosen, contrastRatio(bg, text))
    minWhite = Math.min(minWhite, contrastRatio(bg, white))
    minBlack = Math.min(minBlack, contrastRatio(bg, black))
  }
  const altIsLight = minWhite >= minBlack
  const minAlt = altIsLight ? minWhite : minBlack
  const verdict: BackgroundContrastVerdict =
    minChosen >= threshold ? 'pass' : minAlt >= threshold ? 'flip-text' : 'guard-needed'
  return {
    verdict,
    minChosen,
    altHex: altIsLight ? NEAR_WHITE_HEX : NEAR_BLACK_HEX,
    altChoice: altIsLight ? 'light' : 'dark',
    minAlt,
    threshold,
  }
}

/**
 * Production text-polarity pick — the Style Gauntlet's "Guard A" rule
 * (paper-tested June 2026, strongest of the three guards).
 *
 * Given the colors text will actually sit on, return whether LIGHT (white)
 * or DARK (near-black) text has the better worst-case contrast. Replaces
 * the Rec.601 single-color isDark heuristic, which picks illegibly wrong
 * on mid-tone and multi-stop backgrounds (white on yellow at 1.1:1).
 */
export function resolveTextPolarity(
  stops: string[],
  options: { discrete?: boolean } = {},
): 'light' | 'dark' {
  const samples = buildBackgroundSamples(stops, { discrete: options.discrete })
  if (samples.length === 0) return 'light'
  const white = parseHex('#fafafa')!
  const black = parseHex('#0a0a0a')!
  let minWhite = Infinity
  let minBlack = Infinity
  for (const bg of samples) {
    minWhite = Math.min(minWhite, contrastRatio(bg, white))
    minBlack = Math.min(minBlack, contrastRatio(bg, black))
  }
  return minWhite >= minBlack ? 'light' : 'dark'
}

/**
 * Guard candidate: pull every background stop toward black (for light
 * text) or toward white (for dark text) until the worst sample clears the
 * threshold. Returns the adjusted stops, the blend amount that was needed
 * (0..0.9), and whether it succeeded within the cap.
 *
 * This is the "fix the background, keep the design's hues" guard — the
 * alternative to flipping text color or adding a halo.
 */
export function adjustStopsToPass(
  stops: string[],
  textHex: string,
  options: { discrete?: boolean; threshold?: number } = {},
): { stops: string[]; amount: number; passed: boolean } {
  const threshold = options.threshold ?? 7
  const text = parseHex(textHex)
  if (!text) return { stops, amount: 0, passed: false }
  const towardLight = relativeLuminanceWCAG(text) < 0.5 // dark text -> lighten bg
  const target: Rgb = towardLight ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 }

  for (let amount = 0; amount <= 0.9; amount += 0.05) {
    const blended = stops.map(s => {
      const rgb = parseHex(s)
      return rgb ? toHex(lerpRgb(rgb, target, amount)) : s
    })
    const samples = buildBackgroundSamples(blended, { discrete: options.discrete })
    const min = Math.min(...samples.map(bg => contrastRatio(bg, text)))
    if (min >= threshold) {
      return { stops: blended, amount: Math.round(amount * 100) / 100, passed: true }
    }
  }
  return {
    stops: stops.map(s => {
      const rgb = parseHex(s)
      return rgb ? toHex(lerpRgb(rgb, target, 0.9)) : s
    }),
    amount: 0.9,
    passed: false,
  }
}
