/**
 * Band pattern geometry — the SINGLE source of truth.
 *
 * The band was previously drawn twice: once in @react-pdf for Label Lab and
 * once in SVG for the mockup PNGs. Two implementations of the same eleven
 * patterns is exactly how a "fixed" pattern stays broken in one place, which is
 * what happened with the diagonal stripes. This module emits renderer-agnostic
 * primitives; both consumers map them, neither computes them.
 *
 * Coordinates are in the band's own space: (0,0) top-left, W x H. Callers pass
 * whatever W/H they draw at, so the same geometry serves a 12.96pt PDF band and
 * a 90px mockup band without a scale factor anywhere.
 */

export type BandPattern =
  | 'gradient' | 'split' | 'mosaic' | 'diamond' | 'stripes' | 'chevron'
  | 'lightning' | 'shattered' | 'fractured' | 'scales' | 'prism'

export const BAND_PATTERNS: { id: BandPattern; name: string; note: string }[] = [
  { id: 'diamond',   name: 'Diamond mosaic',   note: 'The Round 1 Front C treatment: rotated squares in two offset columns.' },
  { id: 'mosaic',    name: 'Mosaic tiles',     note: '2 x 9 flat tiles. No gradients, so nothing to band in print.' },
  { id: 'gradient',  name: 'Gradient',         note: 'Quietest. Vertical multi-stop.' },
  { id: 'split',     name: 'Split',            note: 'Hard stack, no blend.' },
  { id: 'stripes',   name: 'Diagonal stripes', note: '45deg bands sheared across the strip.' },
  { id: 'chevron',   name: 'Chevron',          note: 'Nested Vs with the apex on the centre line.' },
  { id: 'lightning', name: 'Lightning bolt',   note: 'Single zigzag down the band.' },
  { id: 'shattered', name: 'Shattered glass',  note: 'Shards from an off-centre focal point.' },
  { id: 'fractured', name: 'Fractured',        note: 'Five stacked regions, angled cuts.' },
  { id: 'scales',    name: 'Scales',           note: 'Overlapping arcs. Reads as texture rather than shapes at slab distance.' },
  { id: 'prism',     name: 'Prism',            note: 'Interlocking triangles off alternating edges.' },
]

/** A filled shape. `d` is an SVG path; both renderers understand path data. */
export interface BandFill { d: string; fill: string }
/** A stroked divider line. */
export interface BandStroke { d: string }

export interface BandGeometry {
  /** Present only for 'gradient'; the caller draws a vertical multi-stop. */
  gradientStops?: string[]
  /** Painted first. Guarantees no gap ever shows the ivory field through the
   *  band — on a printed slab that reads as a printing fault, not as design. */
  base: string
  fills: BandFill[]
  strokes: BandStroke[]
  /** Suggested stroke width, already scaled to the band width the caller gave. */
  strokeWidth: number
}

const pickFrom = (p: string[]) => (i: number) => p[((i % p.length) + p.length) % p.length] || '#7C3AED'
const rect = (x: number, y: number, w: number, h: number) =>
  `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`

export function bandGeometry(
  pattern: BandPattern,
  colors: string[],
  W: number,
  H: number
): BandGeometry {
  const q = pickFrom(colors)
  const fills: BandFill[] = []
  const strokes: BandStroke[] = []
  // Scaled off the band width so a 12.96pt band and a 90px band get visually
  // identical weight.
  const strokeWidth = W * 0.022

  if (pattern === 'gradient') {
    return { gradientStops: colors.length >= 2 ? colors : [q(0), q(1)], base: q(0), fills, strokes, strokeWidth }
  }

  if (pattern === 'split') {
    fills.push({ d: rect(0, 0, W, H / 2), fill: q(0) })
    fills.push({ d: rect(0, H / 2, W, H / 2), fill: q(3) })
    strokes.push({ d: `M 0 ${H / 2} L ${W} ${H / 2}` })
  }

  if (pattern === 'mosaic') {
    const cols = 2, rows = 9, tw = W / cols, th = H / rows
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        fills.push({ d: rect(c * tw, r * th, tw, th), fill: q(r * cols + c) })
    for (let c = 1; c < cols; c++) strokes.push({ d: `M ${c * tw} 0 L ${c * tw} ${H}` })
    for (let r = 1; r < rows; r++) strokes.push({ d: `M 0 ${r * th} L ${W} ${r * th}` })
  }

  if (pattern === 'diamond') {
    const size = H / 9, half = size * 0.62
    // Diamonds sit ON the base colour (q(0)) — cycling the full palette made
    // every len-th diamond base-on-base: outlined but invisible ("blank"
    // diamonds"). Cycle the non-base colours only.
    const gem = (i: number) =>
      colors.length > 1 ? (colors[1 + (i % (colors.length - 1))] || '#7C3AED') : '#7C3AED'
    let n = 0
    for (let row = -1; row <= Math.ceil(H / size) + 1; row++) {
      for (let col = 0; col < 2; col++) {
        const cx = W * (col === 0 ? 0.25 : 0.75)
        const cy = row * size + (col === 1 ? size / 2 : 0)
        const d = `M ${cx} ${cy - half} L ${cx + half} ${cy} L ${cx} ${cy + half} L ${cx - half} ${cy} Z`
        fills.push({ d, fill: gem(n++) })
        strokes.push({ d })
      }
    }
  }

  if (pattern === 'stripes') {
    // The shear pushes coverage sideways: a stripe starting at y0 on the left
    // edge lands at y0-skew on the right. To cover the right edge down to H the
    // loop must run to H+skew, or the corner nearest the shear is left unpainted
    // and ivory shows through as a white wedge.
    const h = H / 9, skew = W
    const extra = Math.ceil(skew / h) + 1
    for (let i = -1 - extra; i <= 9 + extra; i++) {
      const y0 = i * h
      fills.push({
        d: `M 0 ${y0} L ${W} ${y0 - skew} L ${W} ${y0 - skew + h} L 0 ${y0 + h} Z`,
        fill: q(i + 1 + extra),
      })
    }
    for (let i = -1 - extra; i <= 9 + extra; i++) {
      strokes.push({ d: `M 0 ${i * h} L ${W} ${i * h - skew}` })
    }
  }

  if (pattern === 'chevron') {
    // Real Vs. A single slanted edge per step just reproduces `stripes` at a
    // different angle, which is what the first attempt did.
    const n = 7, step = H / n, depth = step * 0.75
    const v = (y: number) => `M 0 ${y} L ${W / 2} ${y + depth} L ${W} ${y}`
    for (let i = -2; i <= n + 1; i++) {
      const y = i * step
      fills.push({
        d: `${v(y)} L ${W} ${y + step} L ${W / 2} ${y + depth + step} L 0 ${y + step} Z`,
        fill: q(i + 2),
      })
      strokes.push({ d: v(y) })
    }
  }

  if (pattern === 'lightning') {
    // A thick jagged RIBBON, not a wiggly divider: the old single zigzag line
    // between two fills read as a crack at band size. Two zigzag edges offset
    // horizontally bound a bright bolt over darker flanks.
    const zig: [number, number][] = [
      [0.42, 0], [0.10, 0.20], [0.47, 0.28], [0.14, 0.50],
      [0.50, 0.58], [0.18, 0.80], [0.44, 1.0],
    ].map(([x, y]) => [x * W, y * H])
    const off = 0.34 * W
    const leftEdge = zig.map(([x, y]) => `${x} ${y}`).join(' L ')
    const rightPts = [...zig].reverse().map(([x, y]) => [x + off, y] as [number, number])
    const rightEdge = rightPts.map(([x, y]) => `${x} ${y}`).join(' L ')
    // Flanks first (left flank is the base rect), then the bolt on top.
    fills.push({
      d: `M ${zig[0][0] + off} 0 L ${W} 0 L ${W} ${H} L ${zig[zig.length - 1][0] + off} ${H} L ${rightPts.slice(0, -1).map(([x, y]) => `${x} ${y}`).join(' L ')} Z`,
      fill: q(1),
    })
    fills.push({ d: `M ${leftEdge} L ${rightEdge} Z`, fill: q(4) })
    strokes.push({ d: `M ${leftEdge}` })
    strokes.push({ d: `M ${rightEdge}` })
  }

  if (pattern === 'shattered') {
    // Radial cracks PLUS concentric fracture rings, like real tempered glass —
    // the plain single-focal fan read as pie slices at band size. Cells between
    // rings tile each fan triangle exactly, so coverage stays gap-free.
    const cx = W * 0.42, cy = H * 0.36
    const pts: [number, number][] = [
      [0, 0], [W * 0.55, 0], [W, 0],
      [W, H * 0.18], [W, H * 0.40], [W, H * 0.62], [W, H * 0.82], [W, H],
      [W * 0.45, H], [0, H],
      [0, H * 0.78], [0, H * 0.56], [0, H * 0.34], [0, H * 0.16],
    ]
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t
    const at = (p: [number, number], t: number): [number, number] => [lerp(cx, p[0], t), lerp(cy, p[1], t)]
    const rings = [0, 0.34, 0.66, 1]
    for (let i = 0; i < pts.length; i++) {
      const A = pts[i]
      const B = pts[(i + 1) % pts.length]
      for (let r = 0; r < rings.length - 1; r++) {
        const [a1x, a1y] = at(A, rings[r])
        const [b1x, b1y] = at(B, rings[r])
        const [b2x, b2y] = at(B, rings[r + 1])
        const [a2x, a2y] = at(A, rings[r + 1])
        fills.push({
          d: `M ${a1x} ${a1y} L ${b1x} ${b1y} L ${b2x} ${b2y} L ${a2x} ${a2y} Z`,
          // Stride keeps radial AND ring neighbours on different colours.
          fill: q(i * 2 + r * 3),
        })
      }
    }
    for (const p of pts) strokes.push({ d: `M ${cx} ${cy} L ${p[0]} ${p[1]}` })
    for (const t of [rings[1], rings[2]]) {
      const ring = pts.map(p => at(p, t))
      strokes.push({
        d: `M ${ring.map(([x, y]) => `${x} ${y}`).join(' L ')} Z`,
      })
    }
  }

  if (pattern === 'fractured') {
    // Sharp break lines, not gentle shears: each fracture is a steep kinked
    // polyline — left edge, a hard mid-jag, right edge — with the slopes
    // alternating direction so consecutive breaks visibly oppose each other.
    // Regions fill between consecutive break lines; the outer two "lines" are
    // the band's top and bottom edges.
    const breaks: [number, number, number, number][] = [
      // [left y, kink x, kink y, right y] — all fractions of H / W
      [0.26, 0.60, 0.10, 0.20],
      [0.38, 0.35, 0.50, 0.30],
      [0.64, 0.68, 0.52, 0.60],
      [0.78, 0.30, 0.88, 0.86],
    ]
    const line = (b: [number, number, number, number]) =>
      `M 0 ${b[0] * H} L ${b[1] * W} ${b[2] * H} L ${W} ${b[3] * H}`
    // Region between line i and line i+1: walk line i left-to-right, then
    // line i+1 right-to-left.
    const back = (b: [number, number, number, number]) =>
      `L ${W} ${b[3] * H} L ${b[1] * W} ${b[2] * H} L 0 ${b[0] * H}`
    const top: [number, number, number, number] = [0, 0.5, 0, 0]
    const bottom: [number, number, number, number] = [1, 0.5, 1, 1]
    const all = [top, ...breaks, bottom]
    for (let i = 0; i < all.length - 1; i++) {
      fills.push({ d: `${line(all[i])} ${back(all[i + 1])} Z`, fill: q(i) })
    }
    for (const b of breaks) strokes.push({ d: line(b) })
  }

  if (pattern === 'scales') {
    const cols = 2, r = (W / cols) * 0.78, stepY = r * 0.85
    let n = 0
    for (let row = -1; row * stepY < H + r; row++) {
      const offset = row % 2 === 0 ? 0 : r
      for (let col = -1; col <= cols; col++) {
        const cx = col * (r * 2) + offset, cy = row * stepY
        const d = `M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy} Z`
        fills.push({ d, fill: q(n++) })
        strokes.push({ d })
      }
    }
  }

  if (pattern === 'prism') {
    const n = 8, step = H / n
    for (let i = -1; i <= n; i++) {
      const y = i * step
      fills.push({ d: `M 0 ${y} L ${W} ${y + step / 2} L 0 ${y + step} Z`, fill: q(i * 2) })
      fills.push({ d: `M ${W} ${y + step / 2} L ${W} ${y + step * 1.5} L 0 ${y + step} Z`, fill: q(i * 2 + 1) })
      strokes.push({ d: `M 0 ${y} L ${W} ${y + step / 2} L 0 ${y + step}` })
    }
  }

  return { base: q(0), fills, strokes, strokeWidth }
}

/**
 * Divider stroke: express as hex + opacity, NOT an rgba() string. @react-pdf
 * mis-parses rgba() (a 0.55-alpha black renders with a blue/navy cast —
 * verified in a side-by-side probe), while #000 + strokeOpacity matches what
 * browsers paint for the same value. Both renderers must use this pair.
 */
export const BAND_STROKE_HEX = '#000000'
export const BAND_STROKE_OPACITY = 0.55
/** @deprecated legacy rgba form — kept only for old mockup scripts. */
export const BAND_STROKE_COLOR = 'rgba(0,0,0,0.55)'
