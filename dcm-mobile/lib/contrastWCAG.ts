/**
 * WCAG-correct contrast helpers — mobile port of src/lib/contrastWCAG.ts
 * (the pieces CARD_COLOR_STYLES needs). Replaces the Rec.601 isDark flag for
 * label text polarity: that heuristic picks illegibly wrong text on mid-tone
 * and multi-stop backgrounds (e.g. white text at 1.4:1 on light blue/gold).
 */

export type Rgb = { r: number; g: number; b: number }

export function parseHex(hex: string): Rgb | null {
  if (!hex) return null
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function srgbToLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

export function relativeLuminanceWCAG(rgb: Rgb): number {
  return 0.2126 * srgbToLinear(rgb.r) + 0.7152 * srgbToLinear(rgb.g) + 0.0722 * srgbToLinear(rgb.b)
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminanceWCAG(a)
  const lb = relativeLuminanceWCAG(b)
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)
  return (lighter + 0.05) / (darker + 0.05)
}

function lerpRgb(a: Rgb, b: Rgb, t: number): Rgb {
  const clamp = (n: number) => Math.max(0, Math.min(255, n))
  return {
    r: clamp(a.r + (b.r - a.r) * t),
    g: clamp(a.g + (b.g - a.g) * t),
    b: clamp(a.b + (b.b - a.b) * t),
  }
}

function buildBackgroundSamples(
  stops: string[],
  options: { discrete?: boolean; samplesPerSegment?: number } = {},
): Rgb[] {
  const parsed = stops.map(parseHex).filter((c): c is Rgb => c !== null)
  if (parsed.length === 0) return []
  if (options.discrete || parsed.length === 1) return parsed
  const per = options.samplesPerSegment ?? 4
  const out: Rgb[] = []
  for (let i = 0; i < parsed.length - 1; i++) {
    for (let s = 0; s < per; s++) out.push(lerpRgb(parsed[i], parsed[i + 1], s / per))
  }
  out.push(parsed[parsed.length - 1])
  return out
}

/**
 * Production text-polarity pick (Style Gauntlet "Guard A", paper-tested
 * June 2026): whether light (white) or dark (near-black) text has the better
 * worst-case contrast against the colors text will actually sit on.
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
