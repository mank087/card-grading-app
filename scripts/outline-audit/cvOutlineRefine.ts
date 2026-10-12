/**
 * Card outline refinement (Oct 2026).
 *
 * The capture gate (zoomInspection.detectCardGeometry) asks a vision model for
 * the card's four corners in 0-1000 coordinates of the raw photo. The model
 * finds the card reliably but places its edges loosely: the Oct 12 2026 audit
 * measured the outline stopping well short of the card's bottom edge (McGwire
 * ed0ea559: card y 357-702, outline 324-646). That outline drives the display
 * crop, the card-relative zoom crops and the CV centering measurement.
 *
 * This module snaps each side of the model's outline to the strongest straight
 * edge near it — pure pixel math, no API call:
 *   per side → try lines at offsets within ±SEARCH of the model's side and a
 *   few slopes around it → score each line by a LOW PERCENTILE of the color
 *   step across it (a real cut edge is strong along its whole length; table
 *   texture and art are strong only in places) → keep the OUTERMOST strong
 *   line (inner frame lines are straight and strong too, but always inside the
 *   cut edge) → intersect the four lines.
 * The result is accepted only when it is card-shaped (short/long ≈ 0.716) and
 * every side found a convincing edge; otherwise the model's quad stands.
 */
import sharp from 'sharp';

export interface Pt { x: number; y: number }

/** Short side / long side of a standard card (63x88 mm, 2.5x3.5 in). */
export const CARD_ASPECT = 2.5 / 3.5;

export interface OutlineImage {
  data: Uint8Array;
  width: number;
  height: number;
  channels: number;
}

/** Working copy: raw pixels downscaled so the long edge is `maxEdge`, lightly blurred. */
export async function loadOutlineImage(buf: Buffer, maxEdge = 1200): Promise<OutlineImage> {
  const { data, info } = await sharp(buf, { failOn: 'none' })
    .removeAlpha()
    .resize(maxEdge, maxEdge, { fit: 'inside', withoutEnlargement: true })
    .blur(1.0)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
}

type Side = 'top' | 'bottom' | 'left' | 'right';

/** A candidate straight edge: horizontal sides y = a + b*x, vertical sides x = a + b*y (working px). */
export interface EdgeLine {
  a: number;
  b: number;
  /** Low-percentile color step along the line (sum of RGB steps). */
  score: number;
  /** score / the strongest line on this side. */
  rel: number;
  /** Signed move from the model's side, as a share of the card dimension across it (+ = outward). */
  moved: number;
}

export interface SideSearch {
  cands: EdgeLine[];
  /** Score of the model's own line, for diagnostics. */
  modelScore: number;
}

export interface RefineResult {
  ok: boolean;
  reason?: string;
  quad: Pt[];                     // 0-1000, TL TR BR BL (refined, or the input when !ok)
  aspect?: number;                // short/long of the refined quad, in pixels
  /** The chosen line per side. */
  chosen?: Record<Side, EdgeLine>;
  /** Largest move of any side, as a share of the card dimension across it. */
  maxMove?: number;
}

export interface RefineOptions {
  /** Search band, as a share of the card dimension across the side. */
  search?: number;
  /** Accept only refined quads within this relative tolerance of CARD_ASPECT. */
  aspectTolerance?: number;
  /** A side's best line must reach this absolute score (sum of RGB steps). */
  minScore?: number;
}

/** Candidate lines kept per side, and the share of the side's strongest line a candidate must reach. */
const MAX_CANDS = 6;
const PEAK_SHARE = 0.3;
/** Joint-choice weights: card-shape error and mean side move (both as shares). */
const W_ASPECT = 6;
const W_MOVE = 0.8;

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Short/long aspect of a quad in pixel units (averaging opposite sides). */
export function quadAspect(q: Pt[]): number {
  const [tl, tr, br, bl] = q;
  const w = (dist(tl, tr) + dist(bl, br)) / 2;
  const h = (dist(tl, bl) + dist(tr, br)) / 2;
  if (!(w > 0) || !(h > 0)) return 0;
  return Math.min(w, h) / Math.max(w, h);
}

/** Relative distance of a quad's shape from a standard card, 0 = exact. */
export function aspectError(q: Pt[]): number {
  return Math.abs(quadAspect(q) - CARD_ASPECT) / CARD_ASPECT;
}

export function toPixels(quadNorm: Pt[], w: number, h: number): Pt[] {
  return quadNorm.map(p => ({ x: (p.x / 1000) * w, y: (p.y / 1000) * h }));
}

export function toNorm(quadPx: Pt[], w: number, h: number): Pt[] {
  return quadPx.map(p => ({ x: Math.round((p.x / w) * 10000) / 10, y: Math.round((p.y / h) * 10000) / 10 }));
}

/** Intersection of a horizontal line y = a1 + b1*x with a vertical line x = a2 + b2*y. */
function intersect(h: { a: number; b: number }, v: { a: number; b: number }): Pt {
  // x = a2 + b2*(a1 + b1*x)  →  x (1 - b2*b1) = a2 + b2*a1
  const x = (v.a + v.b * h.a) / (1 - v.b * h.b);
  return { x, y: h.a + h.b * x };
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[i];
}

/**
 * Snap the model's quad to the card's real edges. `quadNorm` is TL, TR, BR, BL
 * in 0-1000 coordinates of the image `img` was made from (same aspect).
 */
export function refineQuad(img: OutlineImage, quadNorm: Pt[], opts: RefineOptions = {}): RefineResult {
  const SEARCH = opts.search ?? 0.2;
  const ASPECT_TOL = opts.aspectTolerance ?? 0.06;
  const MIN_SCORE = opts.minScore ?? 24;
  const { data, width: W, height: H, channels: C } = img;
  const fail = (reason: string): RefineResult => ({ ok: false, reason, quad: quadNorm });
  if (!Array.isArray(quadNorm) || quadNorm.length !== 4) return fail('no_quad');
  const q = toPixels(quadNorm, W, H);
  const [tl, tr, br, bl] = q;
  const cardW = (dist(tl, tr) + dist(bl, br)) / 2;
  const cardH = (dist(tl, bl) + dist(tr, br)) / 2;
  if (!(cardW > 20) || !(cardH > 20)) return fail('quad_too_small');

  const K = 2; // half-width of the step measured across a line (px)
  const px = (x: number, y: number, c: number) => data[(y * W + x) * C + c];
  /** Color step across a horizontal line at (x, y) (vertical difference). */
  const stepH = (x: number, y: number): number => {
    const xi = Math.round(x), yi = Math.round(y);
    if (xi < 0 || xi >= W || yi - K < 0 || yi + K >= H) return -1;
    let s = 0;
    for (let c = 0; c < 3; c++) s += Math.abs(px(xi, yi + K, c) - px(xi, yi - K, c));
    return s;
  };
  const stepV = (x: number, y: number): number => {
    const xi = Math.round(x), yi = Math.round(y);
    if (yi < 0 || yi >= H || xi - K < 0 || xi + K >= W) return -1;
    let s = 0;
    for (let c = 0; c < 3; c++) s += Math.abs(px(xi + K, yi, c) - px(xi - K, yi, c));
    return s;
  };

  const searchSide = (side: Side): SideSearch | null => {
    const horizontal = side === 'top' || side === 'bottom';
    const [A, B] = side === 'top' ? [tl, tr] : side === 'bottom' ? [bl, br] : side === 'left' ? [tl, bl] : [tr, br];
    // Parameterize along the side's own axis: horizontal → u = x, v = y.
    const uA = horizontal ? A.x : A.y, uB = horizontal ? B.x : B.y;
    const vA = horizontal ? A.y : A.x, vB = horizontal ? B.y : B.x;
    if (Math.abs(uB - uA) < 10) return null;
    const b0 = (vB - vA) / (uB - uA);
    const uMid = (uA + uB) / 2, vMid = (vA + vB) / 2;
    const across = horizontal ? cardH : cardW;
    const band = Math.max(6, Math.round(across * SEARCH));
    // outward sign: top/left edges move outward toward smaller v.
    const outward = side === 'top' || side === 'left' ? -1 : 1;
    // Samples along the inner 20-80% of the side (corners are rounded, may be off).
    const uLo = Math.min(uA, uB) + 0.2 * Math.abs(uB - uA);
    const uHi = Math.max(uA, uB) - 0.2 * Math.abs(uB - uA);
    const nS = Math.max(20, Math.min(160, Math.round((uHi - uLo) / 2)));
    const us = Array.from({ length: nS }, (_, i) => uLo + (uHi - uLo) * (i / (nS - 1)));
    const slopes: number[] = [];
    for (let k = -8; k <= 8; k++) slopes.push(b0 + k * 0.006);
    const step = horizontal ? stepH : stepV;
    const scoreLine = (vOff: number, b: number): number => {
      const vals: number[] = [];
      for (const u of us) {
        const v = vMid + vOff + b * (u - uMid);
        const g = horizontal ? step(u, v) : step(v, u);
        if (g < 0) return 0; // line leaves the image
        vals.push(g);
      }
      vals.sort((p, r) => p - r);
      return percentile(vals, 0.3);
    };
    const prof: Array<{ off: number; b: number; s: number }> = [];
    for (let off = -band; off <= band; off++) {
      let best = { off, b: b0, s: -1 };
      for (const b of slopes) {
        const s = scoreLine(off, b);
        if (s > best.s) best = { off, b, s };
      }
      prof.push(best);
    }
    const maxS = Math.max(...prof.map(p => p.s));
    if (!(maxS >= MIN_SCORE)) return null;
    // Local maxima that are clearly strong: every one is a candidate cut edge
    // (inner frame lines, sleeve and stand edges are strong straight lines too;
    // the joint choice below picks among them).
    const cands = prof
      .filter((p, i) => {
        if (p.s < Math.max(MIN_SCORE, PEAK_SHARE * maxS)) return false;
        for (let j = Math.max(0, i - 3); j <= Math.min(prof.length - 1, i + 3); j++) if (prof[j].s > p.s || (prof[j].s === p.s && j < i)) return false;
        return true;
      })
      .sort((p, r) => r.s - p.s)
      .slice(0, MAX_CANDS)
      .map(p => ({ a: vMid + p.off - p.b * uMid, b: p.b, score: p.s, rel: p.s / maxS, moved: (p.off * outward) / across }));
    return { cands, modelScore: prof[band].s };
  };

  const sides = { top: searchSide('top'), bottom: searchSide('bottom'), left: searchSide('left'), right: searchSide('right') };
  if (!sides.top?.cands.length || !sides.bottom?.cands.length || !sides.left?.cands.length || !sides.right?.cands.length) return fail('weak_edge');

  // JOINT CHOICE: every combination of candidate lines, scored by edge strength,
  // card shape (short/long ≈ 0.716 — this is what rejects a stand or sleeve edge
  // a few percent outside the card, and an inner frame line inside it) and a
  // light pull toward the model's outline.
  let best: { score: number; lines: Record<Side, EdgeLine>; quad: Pt[]; aspect: number } | null = null;
  for (const t of sides.top.cands) for (const bo of sides.bottom.cands) for (const l of sides.left.cands) for (const r of sides.right.cands) {
    const quad = [intersect(t, l), intersect(t, r), intersect(bo, r), intersect(bo, l)];
    if (!quad.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) continue;
    const aspect = quadAspect(quad);
    const aspErr = Math.abs(aspect - CARD_ASPECT) / CARD_ASPECT;
    const strength = (t.rel + bo.rel + l.rel + r.rel) / 4;
    const move = (Math.abs(t.moved) + Math.abs(bo.moved) + Math.abs(l.moved) + Math.abs(r.moved)) / 4;
    const score = strength - W_ASPECT * aspErr - W_MOVE * move;
    if (!best || score > best.score) best = { score, lines: { top: t, bottom: bo, left: l, right: r }, quad, aspect };
  }
  if (!best) return fail('no_combination');
  const out = best.quad;
  const maxMove = Math.max(...(['top', 'bottom', 'left', 'right'] as const).map(k => Math.abs(best!.lines[k].moved)));
  if (!out.every(p => p.x >= -2 && p.y >= -2 && p.x <= W + 2 && p.y <= H + 2)) {
    return { ok: false, reason: 'outside_image', quad: quadNorm, aspect: best.aspect, chosen: best.lines, maxMove };
  }
  if (Math.abs(best.aspect - CARD_ASPECT) / CARD_ASPECT > ASPECT_TOL) {
    return { ok: false, reason: 'not_card_shaped', quad: quadNorm, aspect: best.aspect, chosen: best.lines, maxMove };
  }
  return { ok: true, quad: toNorm(out, W, H), aspect: best.aspect, chosen: best.lines, maxMove };
}
