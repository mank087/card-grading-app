/**
 * Regioned "zoom" inspection (v8.9) — Stage B of the grading pipeline.
 *
 * WHY THIS EXISTS: a single holistic vision pass over a full-card image is a
 * stochastic detector for localized damage — whether the model "sees" a small
 * whitening fleck or even a large crease depends on where attention lands, and
 * OpenAI downscales images before the model looks (a 3000px upload reaches the
 * model at roughly 768px on the short side). Observed in production: a card
 * with a pronounced crease had 1 of 3 ensemble completions miss it entirely,
 * and visible back-border whitening was scored a clean 10.
 *
 * THE FIX: crop each face into corner / edge / surface regions at native
 * resolution and inspect every region as its OWN image in ONE additional API
 * call. A defect that was 3 pixels in the full-card view fills the frame in a
 * corner crop. Findings merge into the grade server-side via the deterministic
 * scoring ladders — the zoom pass can only LOWER scores, never raise them.
 */

import OpenAI from 'openai';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export interface ZoomDefect {
  region: string;
  face: 'front' | 'back';
  category: 'corners' | 'edges' | 'surface' | 'structural';
  type: string;
  severity: 'minor' | 'moderate' | 'heavy';
  description: string;
  /** v9.4.2 evidence crops: storage path + long-lived signed URL of the exact
   *  magnified crop this finding was made from ("see it for yourself"). */
  evidencePath?: string;
  evidenceUrl?: string;
}

/**
 * Convert an internal region id ("F-COR-TL", "B-SUR-Q1") into user-facing
 * language ("top-left corner", "upper-left area of the surface"). Region ids
 * were leaking into customer-visible summaries ("moderate scratch at the
 * SUR-Q1") — always run display strings through this.
 */
export function humanizeZoomRegion(regionId: string): string {
  // Strip the v9.3 edge-segment suffix ("B-EDG-L-2" → "EDG-L") before mapping.
  const part = String(regionId || '').replace(/^[FB]-/i, '').replace(/-\d+$/, '').toUpperCase();
  const map: Record<string, string> = {
    'COR-TL': 'top-left corner',
    'COR-TR': 'top-right corner',
    'COR-BL': 'bottom-left corner',
    'COR-BR': 'bottom-right corner',
    'EDG-T': 'top edge',
    'EDG-B': 'bottom edge',
    'EDG-L': 'left edge',
    'EDG-R': 'right edge',
    'SUR-Q1': 'upper-left area of the surface',
    'SUR-Q2': 'upper-right area of the surface',
    'SUR-Q3': 'lower-left area of the surface',
    'SUR-Q4': 'lower-right area of the surface',
    'SUR-HB': 'horizontal center band of the surface',
    'SUR-VB': 'vertical center band of the surface',
  };
  return map[part] || part.toLowerCase().replace(/-/g, ' ');
}

export interface ZoomResult {
  ok: boolean;
  error?: string;
  regionsInspected: number;
  defects: ZoomDefect[];
  /** Max allowed score per `${category}_${face}` (only present when a cap applies) */
  faceCaps: Record<string, number>;
  /** Distinct structural findings (creases/bends/warps) — feeds structural_damage.findings */
  structuralFindings: Array<{ type: string; location: string; description: string }>;
  /** v9.5 measured centering per face; null/undefined = low confidence, model estimate stands */
  centering?: { front: CenteringMeasurement | null; back: CenteringMeasurement | null };
}

interface RegionSpec {
  id: string;
  face: 'front' | 'back';
  category: 'corners' | 'edges' | 'surface';
  label: string;
  buf: Buffer;
}

/**
 * v9.1 STRUCTURAL VERIFICATION — a dedicated, single-question check that runs
 * before the grade-4 structural cap is applied for crease/bend/fold claims.
 *
 * WHY: on glossy/metallic cards, a straight lighting/reflection band (one whole
 * side of a boundary uniformly brighter) is unanimously misread as a "vertical
 * crease" by both the holistic passes and the zoom detector — a confirmed
 * pristine Metal Universe card graded 4 this way. Rubric-level carve-outs get
 * diluted in the ~79K-token grading prompt; this verifier has a tiny prompt and
 * exactly one job, so the discriminator actually gets applied:
 *   CREASE  = a THIN line; the brightness change is confined to the ridge
 *             itself (highlight/shadow pair), surfaces either side match.
 *   LIGHTING = a BROAD step; the entire region on one side of the boundary is
 *             uniformly brighter/darker than the other.
 * Returns confirmed=false when the claimed lines are lighting bands.
 */
export async function verifyStructuralClaim(
  frontImageUrl: string,
  backImageUrl: string,
  findings: Array<{ type?: string; location?: string; description?: string }>,
  opts?: {
    /** v9.4.2: when the full regioned zoom independently found ZERO structural
     *  findings, its magnified read is counter-evidence — a holistic-only crease
     *  claim then needs UNANIMOUS verifier confirmation, not a majority. */
    requireUnanimous?: boolean;
  }
): Promise<{ ok: boolean; confirmed: boolean; reason: string }> {
  try {
    // Tears / missing pieces are unambiguous — only line-type claims need this.
    const lineClaims = findings.filter(f => ['crease', 'bend', 'fold', 'warp'].includes(String(f.type || '').toLowerCase()));
    if (lineClaims.length === 0) return { ok: true, confirmed: true, reason: 'non-line structural damage (tear/missing) — no verification needed' };

    const [frontRes, backRes] = await Promise.all([fetch(frontImageUrl), fetch(backImageUrl)]);
    if (!frontRes.ok || !backRes.ok) return { ok: false, confirmed: true, reason: 'image fetch failed — cap stands (fail-safe)' };
    const bufs: Record<string, Buffer> = {
      front: Buffer.from(await frontRes.arrayBuffer()),
      back: Buffer.from(await backRes.arrayBuffer()),
    };

    // Crop the claimed area(s) at native resolution (quadrant parsed from the
    // location text; whole face as fallback).
    const crops: Array<{ label: string; buf: Buffer }> = [];
    for (const f of lineClaims.slice(0, 4)) {
      const loc = String(f.location || '').toLowerCase();
      const face: 'front' | 'back' = loc.includes('back') ? 'back' : 'front';
      const img = sharp(bufs[face], { failOn: 'none' });
      const meta = await img.metadata();
      const w = meta.width!, h = meta.height!;
      const hw = Math.floor(w / 2), hh = Math.floor(h / 2);
      let left = 0, top = 0, cw = w, ch = h;
      if (/(lower|bottom)/.test(loc)) { top = hh; ch = h - hh; }
      else if (/(upper|top)/.test(loc)) { ch = hh; }
      if (/left/.test(loc)) { cw = hw; }
      else if (/right/.test(loc)) { left = w - hw; cw = hw; }
      const buf = await sharp(bufs[face], { failOn: 'none' })
        .extract({ left, top, width: cw, height: ch })
        .resize({ width: MAX_REGION_EDGE, height: MAX_REGION_EDGE, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();
      crops.push({ label: `${face} — claimed: ${f.type} at ${f.location || 'unspecified'} (${(f.description || '').slice(0, 120)})`, buf });
    }

    const content: any[] = [{
      type: 'text',
      text: `A card-grading system flagged possible CREASE/BEND lines on this trading card. Your ONLY job: decide whether each claimed line is PHYSICAL DAMAGE or a non-damage artifact.

THE DISCRIMINATOR:
- CREASE/FOLD (damage): a THIN line or ridge — the brightness disturbance is confined to the line itself (often a paired highlight+shadow along a ridge, may break ink or show fiber). The surface tone on BOTH sides of the line MATCHES.
- LIGHTING/REFLECTION BAND (not damage): a BROAD tonal step — one ENTIRE side of the boundary is uniformly brighter or darker than the other (glossy/metallic cards reflect room lighting as straight bands). No ridge, no ink break, no fiber.
- PRINTED DESIGN LINE (not damage): part of the card's artwork — e.g. the light streaks and wave lines inside the swirl pattern of a Pokemon card back, comic speed-lines, borders. These follow the ARTWORK's geometry and colors, do not disturb the gloss, and are perfectly reproduced (no fiber, no ridge).
- Also NOT damage: foil patterns, sleeve edges.

A verdict of physical_damage=true REQUIRES at least one piece of stated evidence:
- "ink_break_or_fiber": the line visibly breaks the printed ink or shows white paper fiber
- "ridge_shadow": a paired highlight+shadow showing a raised/dented ridge in the surface plane
- "edge_deformation": the line reaches the card's edge and visibly deforms the card outline
- "matching_line_opposite_face": the same line appears at the corresponding location on the other face (real creases almost always show through)
If none of these is present, physical_damage MUST be false (evidence: "none").

For each claim you get the claimed area AND the corresponding area of the OPPOSITE face (left/right mirrored — a back-left crease shows front-right).

Reply ONLY JSON: {"verdicts":[{"claim":"<label>","physical_damage":true|false,"evidence":"ink_break_or_fiber|ridge_shadow|edge_deformation|matching_line_opposite_face|none","reason":"<one sentence>"}]}`,
    }];
    // Opposite-face crops: same vertical band, horizontally MIRRORED (faces flip left/right).
    const oppositeCrops: Array<{ label: string; buf: Buffer }> = [];
    for (const f of lineClaims.slice(0, 4)) {
      const loc = String(f.location || '').toLowerCase();
      const face: 'front' | 'back' = loc.includes('back') ? 'back' : 'front';
      const opp: 'front' | 'back' = face === 'back' ? 'front' : 'back';
      const meta = await sharp(bufs[opp], { failOn: 'none' }).metadata();
      const w = meta.width!, h = meta.height!;
      const hw = Math.floor(w / 2), hh = Math.floor(h / 2);
      let left = 0, top = 0, cw = w, ch = h;
      if (/(lower|bottom)/.test(loc)) { top = hh; ch = h - hh; }
      else if (/(upper|top)/.test(loc)) { ch = hh; }
      if (/left/.test(loc)) { left = w - hw; cw = hw; }        // mirrored
      else if (/right/.test(loc)) { cw = hw; }                  // mirrored
      const buf = await sharp(bufs[opp], { failOn: 'none' })
        .extract({ left, top, width: cw, height: ch })
        .resize({ width: MAX_REGION_EDGE, height: MAX_REGION_EDGE, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 }).toBuffer();
      oppositeCrops.push({ label: `${opp} — corresponding (mirrored) area for the claim above`, buf });
    }
    crops.forEach((c, i) => {
      content.push({ type: 'text', text: `CLAIM — ${c.label}:` });
      content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${c.buf.toString('base64')}`, detail: 'high' } });
      const o = oppositeCrops[i];
      if (o) {
        content.push({ type: 'text', text: o.label + ':' });
        content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${o.buf.toString('base64')}`, detail: 'high' } });
      }
    });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: 'gpt-5.1',
      temperature: 0,
      seed: 7,
      n: 3,
      max_completion_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content }],
    }, { timeout: 60_000 });

    // Majority vote across samples: damage confirmed only if >=2 of 3 samples find
    // at least one physically-damaged claim WITH stated evidence (v9.4.2: a bare
    // physical_damage=true with evidence "none"/missing does not count — production
    // false-crease on a Pokemon back swirl was "confirmed" with no evidence at all).
    let damageVotes = 0, parsed = 0;
    const reasons: string[] = [];
    const VALID_EVIDENCE = new Set(['ink_break_or_fiber', 'ridge_shadow', 'edge_deformation', 'matching_line_opposite_face']);
    for (const choice of response.choices) {
      try {
        const v = JSON.parse(choice.message?.content || '');
        parsed++;
        const anyDamage = (v.verdicts || []).some((x: any) => x.physical_damage === true && VALID_EVIDENCE.has(String(x.evidence || '')));
        if (anyDamage) damageVotes++;
        else reasons.push((v.verdicts || []).map((x: any) => x.reason).filter(Boolean)[0] || 'no damage evidence');
      } catch { /* skip unparseable */ }
    }
    if (parsed === 0) return { ok: false, confirmed: true, reason: 'verification unparseable — cap stands (fail-safe)' };
    const confirmed = opts?.requireUnanimous ? damageVotes === parsed : damageVotes >= Math.ceil(parsed / 2);
    const reason = confirmed
      ? `verified as physical damage (${damageVotes}/${parsed} verifier votes)`
      : `verified as lighting/reflection, not damage (${parsed - damageVotes}/${parsed} votes: ${reasons[0] || ''})`;
    console.log(`[ZOOM] structural verification: ${reason}`);
    return { ok: true, confirmed, reason };
  } catch (err: any) {
    // Fail-safe: if verification errors, the cap stands (never let an outage
    // silently un-cap genuinely creased cards).
    console.error('[ZOOM] structural verification failed:', err?.message);
    return { ok: false, confirmed: true, reason: `verification error — cap stands (${err?.message})` };
  }
}

// Visibility-test severity → ladder cap.
// v9.1 recalibration: the v9.0 ladder (minor 9 / moderate 7 / heavy 5, −1 at 2+
// regions) let a single back-face "moderate whitening" chain into a −3/−4 final
// swing (face cap → category consensus → weakest-link). Validated regrades showed
// minor back-corner whitening capping corners to 6 — a full tier below market
// grading of the same defect. New ladder: minor 9, moderate 8, heavy 6; the
// multi-region penalty now requires 3+ distinct regions (2 regions = confirmation
// of the same wear level, not extra damage).
const SEVERITY_CAP: Record<string, number> = { minor: 9, moderate: 8, heavy: 6 };
const STRUCTURAL_TYPES = new Set(['crease', 'bend', 'fold', 'warp', 'tear']);
const MAX_REGION_EDGE = 1024; // downscale cap per crop (no enlargement — upscaling adds no information)

type Pt = { x: number; y: number };
type Quad = [Pt, Pt, Pt, Pt]; // [TL, TR, BR, BL] in pixel space
type BoxDef = { id: string; category: RegionSpec['category']; label: string; left: number; top: number; width: number; height: number };

// v9.4.1 (ported from grading-v9.2-joey-fixes 89256fe): crop boxes placed on the
// DETECTED card quad instead of the image corners — so the grader inspects the actual
// card corners/edges, not the desk margin around a card that doesn't fill the frame.
// Boxes are axis-aligned (robust for the typical mild-tilt phone photo); centering
// each box on the real corner is the key win even under some perspective.
function cardRelativeBoxes(P: string, face: 'front' | 'back', quad: Quad, w: number, h: number): BoxDef[] {
  const [tl, tr, br, bl] = quad;
  const cx = (tl.x + tr.x + br.x + bl.x) / 4;
  const cy = (tl.y + tr.y + br.y + bl.y) / 4;
  const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
  const cardW = (dist(tl, tr) + dist(bl, br)) / 2;
  const cardH = (dist(tl, bl) + dist(tr, br)) / 2;
  const cw = Math.max(24, Math.round(cardW * 0.30));
  const ch = Math.max(24, Math.round(cardH * 0.30));
  const es = Math.max(16, Math.round(Math.min(cardW, cardH) * 0.14));
  const clampBox = (left: number, top: number, bw: number, bh: number) => {
    left = Math.max(0, Math.min(left, w - 8));
    top = Math.max(0, Math.min(top, h - 8));
    bw = Math.max(8, Math.min(bw, w - left));
    bh = Math.max(8, Math.min(bh, h - top));
    return { left: Math.round(left), top: Math.round(top), width: Math.round(bw), height: Math.round(bh) };
  };
  const cornerBox = (c: Pt) => clampBox(c.x + (cx - c.x) * 0.28 - cw / 2, c.y + (cy - c.y) * 0.28 - ch / 2, cw, ch);
  const edgeBox = (a: Pt, b: Pt, horizontal: boolean) => {
    const mx = (a.x + b.x) / 2 + (cx - (a.x + b.x) / 2) * 0.10;
    const my = (a.y + b.y) / 2 + (cy - (a.y + b.y) / 2) * 0.10;
    const len = dist(a, b) * 0.9;
    return horizontal ? clampBox(mx - len / 2, my - es / 2, len, es) : clampBox(mx - es / 2, my - len / 2, es, len);
  };
  const minx = Math.min(tl.x, tr.x, br.x, bl.x), maxx = Math.max(tl.x, tr.x, br.x, bl.x);
  const miny = Math.min(tl.y, tr.y, br.y, bl.y), maxy = Math.max(tl.y, tr.y, br.y, bl.y);
  const surfBox = (l: number, t: number, r: number, bt: number) => clampBox(l, t, r - l, bt - t);
  return [
    { id: `${P}-COR-TL`, category: 'corners', label: `${face} top-left corner`, ...cornerBox(tl) },
    { id: `${P}-COR-TR`, category: 'corners', label: `${face} top-right corner`, ...cornerBox(tr) },
    { id: `${P}-COR-BL`, category: 'corners', label: `${face} bottom-left corner`, ...cornerBox(bl) },
    { id: `${P}-COR-BR`, category: 'corners', label: `${face} bottom-right corner`, ...cornerBox(br) },
    { id: `${P}-EDG-T`, category: 'edges', label: `${face} top edge strip`, ...edgeBox(tl, tr, true) },
    { id: `${P}-EDG-B`, category: 'edges', label: `${face} bottom edge strip`, ...edgeBox(bl, br, true) },
    { id: `${P}-EDG-L`, category: 'edges', label: `${face} left edge strip`, ...edgeBox(tl, bl, false) },
    { id: `${P}-EDG-R`, category: 'edges', label: `${face} right edge strip`, ...edgeBox(tr, br, false) },
    { id: `${P}-SUR-Q1`, category: 'surface', label: `${face} surface upper-left quadrant`, ...surfBox(minx, miny, cx, cy) },
    { id: `${P}-SUR-Q2`, category: 'surface', label: `${face} surface upper-right quadrant`, ...surfBox(cx, miny, maxx, cy) },
    { id: `${P}-SUR-Q3`, category: 'surface', label: `${face} surface lower-left quadrant`, ...surfBox(minx, cy, cx, maxy) },
    { id: `${P}-SUR-Q4`, category: 'surface', label: `${face} surface lower-right quadrant`, ...surfBox(cx, cy, maxx, maxy) },
    // Center bands span the card through the middle so a crease/bend crossing the center
    // is seen WHOLE (a mid-card crease sits on the quadrant boundary and gets clipped).
    { id: `${P}-SUR-HB`, category: 'surface', label: `${face} full-width horizontal center band (check for a crease/bend line crossing the card)`, ...surfBox(minx, cy - (maxy - miny) * 0.18, maxx, cy + (maxy - miny) * 0.18) },
    { id: `${P}-SUR-VB`, category: 'surface', label: `${face} full-height vertical center band (check for a crease/bend line crossing the card)`, ...surfBox(cx - (maxx - minx) * 0.18, miny, cx + (maxx - minx) * 0.18, maxy) },
  ];
}

// ---------------------------------------------------------------------------
// v9.5 CV CENTERING MEASUREMENT
// The card's corner quad comes from the geometry-gate vision call (which solved
// the card-location problem the 2025 OpenCV attempt died on: textured/white
// backgrounds, sleeves, glare). This half is pure pixel math:
//   per side → sample K points along the quad edge (inner 20-80% span, avoiding
//   corners) → SNAP each point to the true cut edge (max color gradient within
//   ±24px along the inward normal, robust to quad imprecision) → scan inward for
//   the first SUSTAINED color transition away from the border's own color =
//   border width at that point → median per side; IQR/median = confidence.
// Curved/art frames produce high variance → null → the model's estimate stands
// (exact pre-v9.5 behavior). Confidence gate + fallback is the design.
// ---------------------------------------------------------------------------
export interface CenteringMeasurement {
  leftRight: string | null;  // "55/45" (left share / right share); null = axis unreliable
  topBottom: string | null;  // "60/40"
  bothAxes: boolean;         // true = full measurement (may replace the model estimate
                             // in both directions); false = partial (may only LOWER)
  worstAxisPct: number;      // max side share across the MEASURED axes
  widths: { left: number | null; right: number | null; top: number | null; bottom: number | null };
  spread: { left: number | null; right: number | null; top: number | null; bottom: number | null };
}

const CENTERING_SAMPLES = 12;
const MAX_SPREAD_PCT = 30;      // per-side IQR/median above this → unreliable
const MIN_VALID_SAMPLES = 6;    // of CENTERING_SAMPLES per side

export async function measureCentering(imageBuf: Buffer, quadNorm: Array<{ x: number; y: number }>): Promise<CenteringMeasurement | null> {
  try {
    const { data, info } = await sharp(imageBuf, { failOn: 'none' }).raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height, C = info.channels;
    const q = quadNorm.map(p => ({ x: (p.x / 1000) * W, y: (p.y / 1000) * H }));
    const [tl, tr, br, bl] = q;
    const colorAt = (x: number, y: number): [number, number, number] | null => {
      const xi = Math.round(x), yi = Math.round(y);
      if (xi < 0 || yi < 0 || xi >= W || yi >= H) return null;
      const i = (yi * W + xi) * C;
      return [data[i], data[i + 1], data[i + 2]];
    };
    const dist2 = (a: [number, number, number], b: [number, number, number]) =>
      (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
    // Chroma distance: brightness-invariant color comparison. Phone photos are lit
    // directionally — the shadowed side's border shows a big BRIGHTNESS ramp that
    // absolute distance reads as constant "transition" noise (measured: left sides
    // failed on all five validation faces while rights measured). Comparing
    // normalized color proportions ignores the shading and sees only ink changes.
    const chroma = (c: [number, number, number]): [number, number, number] => {
      const s2 = Math.max(1, c[0] + c[1] + c[2]);
      return [255 * c[0] / s2, 255 * c[1] / s2, 255 * c[2] / s2];
    };
    const chromaDist2 = (a: [number, number, number], b: [number, number, number]) => dist2(chroma(a), chroma(b));

    const cardDim = Math.min(Math.hypot(tr.x - tl.x, tr.y - tl.y), Math.hypot(bl.x - tl.x, bl.y - tl.y));
    const maxScan = Math.max(40, Math.round(cardDim * 0.16)); // border search depth
    // The model's quad is coarse (rounded 0-1000 coords ≈ ±0.5% ≈ up to ~15px, plus
    // model error) — measured misses of 25-45px. Snap window must absorb that.
    const SNAP = 48;

    // Measure one side: edge from A to B, inward unit normal (nx, ny).
    const measureSide = (A: Pt, B: Pt, nx: number, ny: number): { median: number; spreadPct: number } | null => {
      const widths: number[] = [];
      for (let s = 0; s < CENTERING_SAMPLES; s++) {
        const t = 0.2 + 0.6 * (s / (CENTERING_SAMPLES - 1));
        const ex = A.x + (B.x - A.x) * t, ey = A.y + (B.y - A.y) * t;
        // 1) SNAP to the true cut edge: max gradient along the normal within ±SNAP.
        //    Validity = the found boundary actually SEPARATES two different-colored
        //    zones (mean of 6-14px outside vs inside), not a raw gradient threshold —
        //    robust to soft shadows and low-contrast edges.
        let bestG = -1, snapOff = 0;
        for (let o = -SNAP; o <= SNAP; o++) {
          const c1 = colorAt(ex + nx * (o - 2), ey + ny * (o - 2));
          const c2 = colorAt(ex + nx * (o + 2), ey + ny * (o + 2));
          if (!c1 || !c2) continue;
          const g = dist2(c1, c2);
          if (g > bestG) { bestG = g; snapOff = o; }
        }
        if (bestG < 0) continue;
        {
          const outer: Array<[number, number, number]> = [];
          const inner: Array<[number, number, number]> = [];
          for (let o = 6; o <= 14; o++) {
            const co = colorAt(ex + nx * (snapOff - o), ey + ny * (snapOff - o));
            const ci = colorAt(ex + nx * (snapOff + o), ey + ny * (snapOff + o));
            if (co) outer.push(co);
            if (ci) inner.push(ci);
          }
          if (outer.length < 5 || inner.length < 5) continue;
          const mean = (arr: Array<[number, number, number]>): [number, number, number] =>
            [0, 1, 2].map(i => arr.reduce((s2, c) => s2 + c[i], 0) / arr.length) as [number, number, number];
          if (dist2(mean(outer), mean(inner)) < 500) continue; // no real zone separation → skip sample
        }
        const sx = ex + nx * snapOff, sy = ey + ny * snapOff;
        // 2) Border reference color: median of pixels 6..14px inside the cut edge
        const ref: Array<[number, number, number]> = [];
        for (let o = 6; o <= 14; o++) { const c = colorAt(sx + nx * o, sy + ny * o); if (c) ref.push(c); }
        if (ref.length < 5) continue;
        const refC: [number, number, number] = [
          ref.map(c => c[0]).sort((a, b) => a - b)[Math.floor(ref.length / 2)],
          ref.map(c => c[1]).sort((a, b) => a - b)[Math.floor(ref.length / 2)],
          ref.map(c => c[2]).sort((a, b) => a - b)[Math.floor(ref.length / 2)],
        ];
        // 3) Scan inward for the first SUSTAINED departure from the border color.
        //    Chroma-based (brightness-invariant): a shading ramp along the border
        //    is not a transition; an ink/frame color change is.
        let run = 0, width = -1;
        for (let o = 8; o <= maxScan; o++) {
          const c = colorAt(sx + nx * o, sy + ny * o);
          if (!c) break;
          if (chromaDist2(c, refC) > 350 || dist2(c, refC) > 12000) { run++; if (run >= 5) { width = o - 4; break; } }
          else run = 0;
        }
        if (width > 0) widths.push(width);
      }
      if (process.env.CV_CENTERING_DEBUG === '1') {
        console.log(`[CV-DEBUG] side widths=[${widths.join(',')}] valid=${widths.length}/${CENTERING_SAMPLES}`);
      }
      if (widths.length < MIN_VALID_SAMPLES) return null;
      // TIGHTEST-CLUSTER estimator: art shapes touching the border pollute a few
      // samples with deep readings (measured: Xerosic right = 9 samples at
      // 102-118px + 3 outliers at 163-199 from the swirl art). A plain IQR dies
      // on that; the physical border is the largest SELF-CONSISTENT cluster.
      const sorted = [...widths].sort((a, b) => a - b);
      let best: { median: number; spreadPct: number; size: number } | null = null;
      for (let i = 0; i < sorted.length; i++) {
        for (let jEnd = sorted.length; jEnd - i >= MIN_VALID_SAMPLES; jEnd--) {
          const win = sorted.slice(i, jEnd);
          const med = win[Math.floor(win.length / 2)];
          const spreadPct = Math.round(100 * (win[win.length - 1] - win[0]) / Math.max(1, med));
          if (spreadPct <= MAX_SPREAD_PCT && (!best || win.length > best.size)) {
            best = { median: med, spreadPct, size: win.length };
          }
        }
      }
      return best ? { median: best.median, spreadPct: best.spreadPct } : null;
    };

    // Inward normals for each side (quad ordered TL,TR,BR,BL).
    const left = measureSide(tl, bl, 1, 0);
    const right = measureSide(tr, br, -1, 0);
    const top = measureSide(tl, tr, 0, 1);
    const bottom = measureSide(bl, br, 0, -1);
    if (process.env.CV_CENTERING_DEBUG === '1') {
      console.log(`[CV-DEBUG] sides: L=${JSON.stringify(left)} R=${JSON.stringify(right)} T=${JSON.stringify(top)} B=${JSON.stringify(bottom)}`);
    }
    // PER-AXIS independence: a clean top/bottom measurement is not invalidated by
    // art pollution on left/right (or vice versa). An axis is usable only when
    // BOTH of its sides produced a reliable cluster.
    const share = (a: number, b: number) => Math.round(100 * a / (a + b));
    const lrOk = !!(left && right);
    const tbOk = !!(top && bottom);
    if (!lrOk && !tbOk) return null;
    const l = lrOk ? share(left!.median, right!.median) : null;
    const t = tbOk ? share(top!.median, bottom!.median) : null;
    const worstCandidates = [
      ...(l != null ? [l, 100 - l] : []),
      ...(t != null ? [t, 100 - t] : []),
    ];
    return {
      leftRight: l != null ? `${l}/${100 - l}` : null,
      topBottom: t != null ? `${t}/${100 - t}` : null,
      bothAxes: lrOk && tbOk,
      worstAxisPct: Math.max(...worstCandidates),
      widths: {
        left: left?.median ?? null, right: right?.median ?? null,
        top: top?.median ?? null, bottom: bottom?.median ?? null,
      },
      spread: {
        left: left?.spreadPct ?? null, right: right?.spreadPct ?? null,
        top: top?.spreadPct ?? null, bottom: bottom?.spreadPct ?? null,
      },
    };
  } catch (e: any) {
    console.warn(`[ZOOM] centering measurement error: ${e.message}`);
    return null;
  }
}

/** Shoelace-area sanity check for a detected quad (normalized 0-1000 space). */
function quadPlausible(quadNorm: Pt[] | undefined, minFrac = 0.10, maxFrac = 0.95): quadNorm is Pt[] {
  if (!Array.isArray(quadNorm) || quadNorm.length !== 4) return false;
  if (!quadNorm.every(p => Number.isFinite(p?.x) && Number.isFinite(p?.y) && p.x >= 0 && p.x <= 1000 && p.y >= 0 && p.y <= 1000)) return false;
  const q = quadNorm;
  const area = Math.abs((q[0].x * (q[1].y - q[3].y) + q[1].x * (q[2].y - q[0].y) + q[2].x * (q[3].y - q[1].y) + q[3].x * (q[0].y - q[2].y)) / 2);
  const frac = area / (1000 * 1000);
  return frac >= minFrac && frac <= maxFrac;
}

async function cropFace(imageBuf: Buffer, face: 'front' | 'back', quadNorm?: Pt[]): Promise<RegionSpec[]> {
  const img = sharp(imageBuf, { failOn: 'none' });
  const meta = await img.metadata();
  const w = meta.width!, h = meta.height!;
  const P = face === 'front' ? 'F' : 'B';

  // Card-relative crops when a plausible quad was detected (margin photos).
  if (quadPlausible(quadNorm)) {
    const q = quadNorm.map(p => ({ x: (p.x / 1000) * w, y: (p.y / 1000) * h })) as Quad;
    const defs = cardRelativeBoxes(P, face, q, w, h);
    console.log(`[ZOOM] ${face}: card-relative crops from detected quad`);
    const regions: RegionSpec[] = [];
    for (const d of defs) {
      const buf = await sharp(imageBuf, { failOn: 'none' })
        .extract({ left: d.left, top: d.top, width: d.width, height: d.height })
        .resize(MAX_REGION_EDGE, MAX_REGION_EDGE, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();
      regions.push({ id: d.id, face, category: d.category, label: d.label, buf });
    }
    return regions;
  }

  const cw = Math.round(w * 0.26), ch = Math.round(h * 0.26); // corner boxes
  const es = Math.round(Math.min(w, h) * 0.12);               // edge strip thickness
  const hw = Math.ceil(w / 2), hh = Math.ceil(h / 2);         // surface quadrant size

  const defs: Array<{ id: string; category: RegionSpec['category']; label: string; left: number; top: number; width: number; height: number }> = [
    { id: `${P}-COR-TL`, category: 'corners', label: `${face} top-left corner`, left: 0, top: 0, width: cw, height: ch },
    { id: `${P}-COR-TR`, category: 'corners', label: `${face} top-right corner`, left: w - cw, top: 0, width: cw, height: ch },
    { id: `${P}-COR-BL`, category: 'corners', label: `${face} bottom-left corner`, left: 0, top: h - ch, width: cw, height: ch },
    { id: `${P}-COR-BR`, category: 'corners', label: `${face} bottom-right corner`, left: w - cw, top: h - ch, width: cw, height: ch },
    // v9.3: edge strips are SEGMENTED (3 overlapping segments per edge) instead of one
    // full-length strip. A full strip (e.g. 267×3000) hit the 1024px resize cap on its
    // LONG side and reached the model at ~91px wide — one third of native resolution,
    // BLURRIER than the full-card photo. Measured live (Xerosic, 2026-07-10): plainly
    // visible dark-border edge whitening → 24 regions × 5 samples → 0 findings. With
    // ~0.4-length segments both dimensions stay at/near native under the 1024 cap.
    ...(['T', 'B', 'L', 'R'] as const).flatMap((side) => {
      const vertical = side === 'L' || side === 'R';
      const L = vertical ? h : w; // long-axis length of the strip
      const segLen = Math.ceil(L * 0.4);
      const names: Record<string, string> = { T: 'top', B: 'bottom', L: 'left', R: 'right' };
      return [0, 1, 2].map((i) => {
        const start = Math.min(Math.round(i * 0.3 * L), L - segLen);
        return {
          id: `${P}-EDG-${side}-${i + 1}`,
          category: 'edges' as const,
          label: `${face} ${names[side]} edge, segment ${i + 1} of 3`,
          left: side === 'R' ? w - es : vertical ? 0 : start,
          top: side === 'B' ? h - es : vertical ? start : 0,
          width: vertical ? es : segLen,
          height: vertical ? segLen : es,
        };
      });
    }),
    { id: `${P}-SUR-Q1`, category: 'surface', label: `${face} surface upper-left quadrant`, left: 0, top: 0, width: hw, height: hh },
    { id: `${P}-SUR-Q2`, category: 'surface', label: `${face} surface upper-right quadrant`, left: w - hw, top: 0, width: hw, height: hh },
    { id: `${P}-SUR-Q3`, category: 'surface', label: `${face} surface lower-left quadrant`, left: 0, top: h - hh, width: hw, height: hh },
    { id: `${P}-SUR-Q4`, category: 'surface', label: `${face} surface lower-right quadrant`, left: w - hw, top: h - hh, width: hw, height: hh },
  ];

  const regions: RegionSpec[] = [];
  for (const d of defs) {
    const buf = await sharp(imageBuf, { failOn: 'none' })
      .extract({ left: d.left, top: d.top, width: d.width, height: d.height })
      .resize(MAX_REGION_EDGE, MAX_REGION_EDGE, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();
    regions.push({ id: d.id, face, category: d.category, label: d.label, buf });
  }
  return regions;
}

const ZOOM_SYSTEM_PROMPT = `You are a trading-card DEFECT DETECTOR examining ZOOMED CROPS of one card. Each numbered region is a magnified portion (corner, edge strip, or surface quadrant) of the card's front or back.

For EACH region, report only CLEARLY VISIBLE physical defects:
- whitening (white cardstock/fiber exposure on corners or edges)
- chip (coating loss), nick, softening/rounding (corner no longer sharp)
- scratch, scuff, dent/indentation, stain, print_line
- crease / bend / fold line (a line where the surface plane physically breaks — often a lighter or shadowed line crossing design elements; check EVERY quadrant — a crease anywhere is critical)
FOIL/METALLIC REFLECTION CAVEAT (avoid false creases): on metallic, foil, refractor, prizm, chrome or embossed cards the shiny surface shows bright/dark REFLECTION BANDS and embossed design lines that look like creases but are NOT damage. Only call a crease/bend/fold when the line clearly BREAKS THE CARD'S PHYSICAL PLANE — i.e. it deforms the card outline/edge, casts a raised-ridge shadow, or shows the same physical line at the matching spot on the other face. A straight bright or dark streak that follows the foil/design and does not deform the card is a reflection — do NOT report it as a crease.

SEVERITY (visibility test — imagine the full card at reading distance):
- "minor": would be detectable only on close inspection of the full card
- "moderate": would be plainly noticeable at normal viewing distance
- "heavy": would be immediately obvious
DARK-BORDER RULE (high-contrast wear rule): white flecks against a DARK border (black, dark blue, the
dark back of vintage cards) are high-contrast and plainly visible at normal distance —
classify as "moderate" whenever there are multiple flecks or any run of whitening along the
border; "minor" is reserved for a single pinpoint fleck.
LIGHT-BORDER RULE (do NOT rely on color contrast): on WHITE, cream, silver, gray or other light borders,
whitening is white-on-white and will NOT appear as a color change — you must NOT skip it just because
there is no obvious contrast. Instead detect it by TEXTURE and EDGE SHAPE: fiber/paper roughness or
fraying at the cut line, loss of the smooth factory sheen, a fuzzy/feathered rather than crisp edge,
a corner tip that is rounded/soft rather than a sharp point, or tiny lifted flecks at the very corner.
A corner or edge on a light border that is not crisply sharp and clean IS whitening/softening — report it
(minor for slight softening, moderate for a clearly rough or frayed run). Treat light-border corners with
the same scrutiny as dark-border corners.

BACKGROUND CHECK FIRST (photos with wide margins): each crop may contain mostly or entirely the BACKGROUND SURFACE the card is lying on (desk, leather, cloth, mat) instead of the card. Before reporting anything, decide what part of the crop is actually CARD. Specks, dust, texture, grain or marks on the background surface are NEVER card defects — a crop that shows no card content at all is automatically clean:true.
LIGHT BACKGROUND BEHIND A CORNER/EDGE IS NOT WHITENING: whitening is white showing ON the card's own cut surface or face. A white/cream background (felt, paper, cloth) visible BEYOND the cut line — including directly behind a corner tip — is background, not damage. On light backgrounds judge corners by GEOMETRY (sharp point vs rounded/frayed) and by fiber texture ON the card itself; stains and specks on the background surface near the card belong to the background.
NOT defects (do NOT report): holographic sparkle/patterns, printed design lines and textures, the card's border color itself, image compression noise, glare/reflection bands that have soft gradual edges, background surfaces outside the card and anything ON them, sleeve/holder edges.
IMPORTANT context: crops from the SAME card — a straight uniform line at the outermost boundary is the card's cut edge, not damage. White showing AT the cut line on a dark border IS whitening.

Reply ONLY with JSON (compact — clean regions are listed by id only):
{"clean":["<region id>", ...],"findings":[{"id":"<region id>","card_area":"most|some|none","defects":[{"type":"whitening|chip|nick|softening|scratch|scuff|dent|stain|print_line|crease|bend|warp","severity":"minor|moderate|heavy","description":"<one concise sentence, location within the region>"}]}]}
- "clean": every region with NO defects — just its id, nothing else.
- "findings": ONLY regions with at least one defect, with full detail.
- Every region id you were given MUST appear in exactly one of the two lists.
card_area is decided FIRST for each findings entry, before its defects:
- "most": the card (or its border/edge) fills most of this crop
- "some": the crop is mostly the background surface, with only a small part of the card visible
- "none": no card material in this crop at all
When card_area is "some" or "none", the crop is dominated by the surface the card is lying on — fabric weave, leather grain, desk texture. Fibers, specks and shadows there belong to the BACKGROUND, not the card. Only report a defect from such a crop if it is unmistakably ON the card portion.`;

export async function runZoomInspection(
  frontImageUrl: string,
  backImageUrl: string,
  options?: { priorityNote?: string; model?: string }
): Promise<ZoomResult> {
  const empty: ZoomResult = { ok: false, regionsInspected: 0, defects: [], faceCaps: {}, structuralFindings: [] };
  try {
    const [frontRes, backRes] = await Promise.all([fetch(frontImageUrl), fetch(backImageUrl)]);
    if (!frontRes.ok || !backRes.ok) throw new Error(`image download failed (${frontRes.status}/${backRes.status})`);
    const [frontBuf, backBuf] = await Promise.all([
      frontRes.arrayBuffer().then(b => Buffer.from(b)),
      backRes.arrayBuffer().then(b => Buffer.from(b)),
    ]);

    // v9.4.1 KILL SWITCH: set ZOOM_DISABLED=1 (Vercel env) to skip the regioned zoom
    // entirely — grading falls back to the holistic ensemble, and the fallback is
    // persisted in consensus_notes so affected grades are identifiable in the DB.
    if (process.env.ZOOM_DISABLED === '1') {
      console.log('[ZOOM] disabled via ZOOM_DISABLED env — skipping regioned inspection');
      return { ...empty, error: 'disabled via ZOOM_DISABLED env' };
    }

    // v9.4.1 FRAME-FILL GATE (decisive fix for background false positives):
    // image-relative crops are only trustworthy when the card nearly fills the frame.
    // Production FPs (2026-07-12, multiple customers): cards photographed small on
    // light fabric — edge/corner crops were pure cloth, and a crumb on the tablecloth
    // graded as a "moderate stain". Per-crop card-vs-background classification cannot
    // work (a white border on white cloth is undecidable in an isolated strip) and
    // sharp-trim fails on textured surfaces — but the FULL image shows the card
    // boundary unambiguously. One tiny detail:'low' call (~85 tok/image, temp 0)
    // measures frame fill; small-card photos skip the zoom with a persisted reason.
    // Proper card-quad geometry (grading-v9.2-joey-fixes port) supersedes this later.
    // v9.4.1 GEOMETRY GATE: one small call on the FULL images (where the card boundary
    // is unambiguous) returns frame-fill percentage AND the card's corner quad.
    //  - fill ≥ MIN_FILL: blind edge-hugging crops (proven path — image edges ARE the
    //    card's cut edges; card-relative boxes shifted inward would MISS edge whitening).
    //  - fill < MIN_FILL + plausible quad: CARD-RELATIVE crops centered on the real
    //    corners/edges (ported from grading-v9.2-joey-fixes) — margin photos get a real
    //    magnified inspection instead of grading the tablecloth.
    //  - fill < MIN_FILL + no plausible quad: skip zoom with a persisted reason.
    // detail:'high' on the gate images (~1.1K tok each): corner coordinates need more
    // precision than the 512px 'low' thumbnail provides.
    const openaiGate = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const MIN_FILL_PERCENT = 68;
    const geometry: { front?: Pt[]; back?: Pt[] } = {};
    const measureGeometry: { front?: Pt[]; back?: Pt[] } = {};
    try {
      const fillRes = await openaiGate.chat.completions.create({
        model: options?.model || 'gpt-5.1',
        temperature: 0,
        max_completion_tokens: 400,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system', content: 'You locate a trading card in each photo. Reply ONLY with JSON:\n' +
              '{"front_fill_percent": <0-100>, "front_corners": [{"x":<0-1000>,"y":<0-1000>} x4], "back_fill_percent": <0-100>, "back_corners": [{"x":<0-1000>,"y":<0-1000>} x4]}\n' +
              'fill_percent = share of the image area covered by the card itself (not sleeve/holder/background).\n' +
              'corners = the card\'s four outer corners in NORMALIZED coordinates (x: 0=left edge of image, 1000=right; y: 0=top, 1000=bottom), ordered [top-left, top-right, bottom-right, bottom-left]. Locate them precisely at the card\'s printed corner tips.'
          },
          {
            role: 'user', content: [
              { type: 'text', text: 'Photo 1 (front):' },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${frontBuf.toString('base64')}`, detail: 'high' } },
              { type: 'text', text: 'Photo 2 (back):' },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${backBuf.toString('base64')}`, detail: 'high' } },
            ] as any,
          },
        ],
      }, { timeout: 45_000 });
      const fill = JSON.parse(fillRes.choices[0]?.message?.content || '{}');
      const worst = Math.min(Number(fill.front_fill_percent ?? 100), Number(fill.back_fill_percent ?? 100));
      console.log(`[ZOOM] frame-fill: front ${fill.front_fill_percent}% / back ${fill.back_fill_percent}%`);
      // v9.5: quads are captured for CENTERING MEASUREMENT whenever plausible,
      // independent of the fill decision (measureGeometry). Card-relative CROPS
      // still engage only for margin photos (fill < threshold) — for full-frame
      // photos blind edge-hugging crops remain better (they hug the cut edges).
      if (quadPlausible(fill.front_corners)) measureGeometry.front = fill.front_corners;
      if (quadPlausible(fill.back_corners)) measureGeometry.back = fill.back_corners;
      if (Number.isFinite(worst) && worst < MIN_FILL_PERCENT) {
        if (quadPlausible(fill.front_corners) && quadPlausible(fill.back_corners)) {
          geometry.front = fill.front_corners;
          geometry.back = fill.back_corners;
          console.log(`[ZOOM] card fills ~${worst}% of frame — using CARD-RELATIVE crops from detected corner quads`);
        } else {
          console.log(`[ZOOM] card fills only ~${worst}% of frame and no plausible corner quad detected — skipping regioned inspection`);
          return { ...empty, error: `card fills only ~${worst}% of the frame and its corners could not be located — magnified inspection needs the card closer to the camera` };
        }
      }
    } catch (e: any) {
      console.warn(`[ZOOM] geometry gate errored (${e.message}) — proceeding with blind crops as before`);
    }

    // v9.5 CV CENTERING: deterministic border measurement from the detected quad.
    // Pure pixel math (no extra API call). Confidence-gated — a null result means
    // "fall back to the model's centering estimate" (exact current behavior).
    const centering = {
      front: measureGeometry.front ? await measureCentering(frontBuf, measureGeometry.front) : null,
      back: measureGeometry.back ? await measureCentering(backBuf, measureGeometry.back) : null,
    };
    if (centering.front) console.log(`[ZOOM] centering measured (front): L/R ${centering.front.leftRight} T/B ${centering.front.topBottom} (spread L${centering.front.spread.left}/R${centering.front.spread.right}/T${centering.front.spread.top}/B${centering.front.spread.bottom}%)`);
    else console.log('[ZOOM] centering measurement (front): low confidence — model estimate stands');
    if (centering.back) console.log(`[ZOOM] centering measured (back): L/R ${centering.back.leftRight} T/B ${centering.back.topBottom}`);

    const regions = [...await cropFace(frontBuf, 'front', geometry.front), ...await cropFace(backBuf, 'back', geometry.back)];

    // v9.3 BATCH-SIZE FIX: sending all crops in ONE call collapsed per-region attention.
    // Measured (Xerosic, 2026-07-10, plainly visible dark-border corner whitening):
    //   the crop alone → detected 3/3 samples; in a 10-crop batch → 3/3; 20-crop → 2/3;
    //   the full single-call batch (24-40 crops) → 0/5. Detection is a direct function
    //   of images-per-call. Chunk regions into batches of ≤ZOOM_MAX_BATCH and run the
    //   calls in PARALLEL — same crops, same n=5 voting per batch, same wall-clock.
    const ZOOM_MAX_BATCH = 8;
    const batches: RegionSpec[][] = [];
    for (let i = 0; i < regions.length; i += ZOOM_MAX_BATCH) batches.push(regions.slice(i, i + ZOOM_MAX_BATCH));

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    // v9.1: the zoom is an n=5 ensemble with per-region MAJORITY VOTING (threshold 2).
    // Bumped 3→5 because faint defects — especially white-on-white whitening on light
    // borders — register in only some samples; requiring 2-of-3 dropped them (the same
    // card graded 8 when caught, 10 when missed). At 2-of-5 a defect seen in 40% of
    // samples now survives, so detection is far more consistent run-to-run. Voting still
    // filters pure single-sample noise. Output is tiny, so the extra completions cost
    // ~a cent and no wall-clock (parallel decode).
    const batchResults = await Promise.all(batches.map(async (batch) => {
      const content: any[] = [];
      if (options?.priorityNote) {
        content.push({ type: 'text', text: `PRIORITY: ${options.priorityNote}` });
      }
      for (const r of batch) {
        content.push({ type: 'text', text: `REGION ${r.id} — ${r.label}:` });
        content.push({
          type: 'image_url',
          image_url: { url: `data:image/jpeg;base64,${r.buf.toString('base64')}`, detail: 'high' },
        });
      }
      content.push({ type: 'text', text: 'Inspect every region above and return the JSON verdict for ALL of them.' });
      const response = await openai.chat.completions.create({
        model: options?.model || 'gpt-5.1',
        temperature: 0.1,
        seed: 7,
        n: 5,
        max_completion_tokens: 6000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: ZOOM_SYSTEM_PROMPT },
          { role: 'user', content },
        ],
      }, { timeout: 90_000 });
      const batchSamples: any[] = [];
      for (const choice of response.choices) {
        try {
          if (!choice?.message?.content) continue;
          const raw = JSON.parse(choice.message.content);
          // v9.5 compact format: {"clean":[ids], "findings":[{id, card_area, defects}]}.
          // Normalize to the internal per-region list; tolerate the legacy
          // {"regions":[...]} shape so a format-drifting sample still parses.
          let normalized: any[];
          if (Array.isArray(raw.findings) || Array.isArray(raw.clean)) {
            normalized = (raw.findings ?? []).map((f: any) => ({ id: f.id, card_area: f.card_area, clean: false, defects: f.defects }));
            const accounted = new Set([...(raw.clean ?? []), ...normalized.map((f: any) => f.id)]);
            const missing = batch.filter(r => !accounted.has(r.id)).length;
            if (missing > 0) console.warn(`[ZOOM] sample omitted ${missing}/${batch.length} region id(s) — treating omissions as clean`);
          } else {
            normalized = raw.regions ?? [];
          }
          batchSamples.push({ regions: normalized });
        } catch { /* discard unparseable zoom sample */ }
      }
      const u: any = (response as any).usage;
      return { batchSamples, promptTokens: u?.prompt_tokens ?? 0, completionTokens: u?.completion_tokens ?? 0 };
    }));
    // Each batch votes independently; merge every batch's samples into one list —
    // the per-(region,type) tally below only counts votes for regions a sample saw
    // (a region appears in exactly one batch, so its max vote count stays 5).
    const samples: any[] = batchResults.flatMap(b => b.batchSamples);
    const usageTotals = batchResults.reduce((a, b) => ({ p: a.p + b.promptTokens, c: a.c + b.completionTokens }), { p: 0, c: 0 });
    const samplesPerBatch = Math.round(samples.length / Math.max(1, batches.length));
    if (samples.length === 0) throw new Error('no parseable zoom samples');
    const regionById = new Map(regions.map(r => [r.id, r]));
    const voteThreshold = 2;

    // Tally votes per (region, defect type) across the independent zoom samples
    const SEV_ORDER: Record<string, number> = { minor: 0, moderate: 1, heavy: 2 };
    // v9.4.1: per-region card_area votes. Image-relative crops on wide-margin photos are
    // mostly the BACKGROUND surface; production FPs (2026-07-12) showed fabric weave read
    // as "fiber whitening" and cloth shadows as "corner softening". Each sample now
    // classifies card-vs-background per crop FIRST; a region whose majority verdict is
    // "some"/"none" card contributes NO cosmetic findings (structural still counts —
    // creases are card-scale and confirmed separately by verifyStructuralClaim).
    const cardAreaVotes = new Map<string, { most: number; total: number }>();
    for (const sample of samples) {
      for (const reg of sample.regions ?? []) {
        if (!regionById.has(reg.id)) continue;
        const v = cardAreaVotes.get(reg.id) ?? { most: 0, total: 0 };
        v.total++;
        if (String(reg.card_area || 'most').toLowerCase() === 'most') v.most++; // missing field → legacy behavior
        cardAreaVotes.set(reg.id, v);
      }
    }
    const regionIsCard = (id: string) => {
      const v = cardAreaVotes.get(id);
      return !v || v.total === 0 || v.most * 2 >= v.total; // majority "most" (ties → card)
    };
    const votes = new Map<string, { spec: RegionSpec; type: string; severities: string[]; description: string }>();
    let backgroundSuppressed = 0;
    for (const sample of samples) {
      for (const reg of sample.regions ?? []) {
        const spec = regionById.get(reg.id);
        if (!spec || reg.clean === true || !Array.isArray(reg.defects)) continue;
        if (!regionIsCard(reg.id) && !(reg.defects || []).some((d: any) => STRUCTURAL_TYPES.has(String(d?.type || '').toLowerCase()))) {
          backgroundSuppressed++;
          continue;
        }
        const seenThisSample = new Set<string>();
        for (const d of reg.defects) {
          if (!d?.type || !d?.severity) continue;
          const type = String(d.type).toLowerCase();
          const key = `${reg.id}|${type}`;
          if (seenThisSample.has(key)) continue; // one vote per sample per region+type
          seenThisSample.add(key);
          const severity = ['minor', 'moderate', 'heavy'].includes(String(d.severity)) ? String(d.severity) : 'minor';
          const entry = votes.get(key) ?? { spec, type, severities: [], description: String(d.description || '').slice(0, 300) };
          entry.severities.push(severity);
          votes.set(key, entry);
        }
      }
    }

    const defects: ZoomDefect[] = [];
    const structuralFindings: ZoomResult['structuralFindings'] = [];
    let minorityDropped = 0;
    for (const [key, v] of votes) {
      // Median severity (2 votes → the milder one: boundary benefit of the doubt)
      const sorted = [...v.severities].sort((a, b) => SEV_ORDER[a] - SEV_ORDER[b]);
      const severity = sorted[Math.floor((sorted.length - 1) / 2)] as ZoomDefect['severity'];
      // v9.4.2: MINOR findings need 3 of 5 votes (moderate/heavy keep 2 of 5).
      // Production (Jul 13-16): 56% of zoom adjustments were minor-only, and owners
      // dispute a large share — 2-vote minors from partially-correlated samples are
      // the noise floor. A real minor defect that 3+ samples independently report
      // still caps; borderline two-vote flecks no longer generate disputed report text.
      const required = severity === 'minor' ? Math.min(3, samples.length) : voteThreshold;
      if (v.severities.length < required) { minorityDropped++; continue; }
      const region = key.split('|')[0];
      if (STRUCTURAL_TYPES.has(v.type)) {
        defects.push({ region, face: v.spec.face, category: 'structural', type: v.type, severity, description: v.description });
        structuralFindings.push({ type: v.type, location: v.spec.label, description: v.description });
      } else {
        defects.push({ region, face: v.spec.face, category: v.spec.category, type: v.type, severity, description: v.description });
      }
    }
    if (minorityDropped > 0) {
      console.log(`[ZOOM] majority vote: ${minorityDropped} single-sample finding(s) dropped (needed ${voteThreshold}/${samples.length} votes)`);
    }
    if (backgroundSuppressed > 0) {
      const bgRegions = [...cardAreaVotes.entries()].filter(([id]) => !regionIsCard(id)).map(([id]) => id);
      console.log(`[ZOOM] background gate: ${backgroundSuppressed} cosmetic finding(s) suppressed from ${bgRegions.length} background-dominated region(s): ${bgRegions.join(', ')}`);
    }

    // Deterministic face caps from the ladders (v9.3 recalibrated for overlapping crops).
    // Regions physically OVERLAP (edge segments share ends with corner crops; surface
    // quadrants contain both) — so the same worn corner used to register as 3+ "distinct
    // regions" and trigger the spread penalty, and quadrant-reported border wear was
    // capping the SURFACE category (measured: a clean-Gem control fell 10→8 on region
    // double-counting alone). Rules:
    //  - each category caps ONLY from its NATIVE crops (corners from COR, edges from EDG);
    //  - edge segments dedup to their physical side (EDG-L-2 → EDG-L);
    //  - surface caps ONLY from true surface defect types in SUR crops — border-wear
    //    types there duplicate what the sharper COR/EDG crops already report;
    //  - worst severity sets the cap; 3+ distinct PHYSICAL locations lowers it one more.
    const BORDER_WEAR_TYPES = new Set(['whitening', 'softening', 'chip', 'nick', 'fray', 'fraying']);
    // v9.4.2 EVIDENCE CROPS: persist the exact magnified crop behind every surviving
    // finding, so reports can SHOW the defect instead of asserting it ("minor
    // whitening" disputes → shared look at the actual crop). One upload per flagged
    // region; a 1-year signed URL is attached to each defect. Strictly fail-safe:
    // any storage error just leaves the defect without an evidence link.
    if (defects.length > 0 && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const storage = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY).storage.from('cards');
        const groupId = randomUUID();
        const flaggedRegions = [...new Set(defects.map(d => d.region))];
        const urlByRegion = new Map<string, { path: string; url: string }>();
        await Promise.all(flaggedRegions.map(async (regionId) => {
          const spec = regionById.get(regionId);
          if (!spec) return;
          const path = `zoom-evidence/${groupId}/${regionId}.jpg`;
          const { error } = await storage.upload(path, spec.buf, { contentType: 'image/jpeg', upsert: true });
          if (error) { console.warn(`[ZOOM] evidence upload failed for ${regionId}: ${error.message}`); return; }
          const { data: signed } = await storage.createSignedUrl(path, 60 * 60 * 24 * 365);
          if (signed?.signedUrl) urlByRegion.set(regionId, { path, url: signed.signedUrl });
        }));
        for (const d of defects) {
          const e = urlByRegion.get(d.region);
          if (e) { d.evidencePath = e.path; d.evidenceUrl = e.url; }
        }
        console.log(`[ZOOM] evidence crops stored: ${urlByRegion.size}/${flaggedRegions.length} region(s) under zoom-evidence/${groupId}/`);
      } catch (e: any) {
        console.warn(`[ZOOM] evidence storage skipped (${e.message})`);
      }
    }

    const physicalLocation = (region: string) => region.replace(/^([FB]-EDG-[TBLR])-\d+$/, '$1');
    const nativePrefix: Record<string, string> = { corners: 'COR', edges: 'EDG', surface: 'SUR' };
    const faceCaps: Record<string, number> = {};
    for (const face of ['front', 'back'] as const) {
      for (const category of ['corners', 'edges', 'surface'] as const) {
        const hits = defects.filter(d =>
          d.face === face &&
          d.category === category &&
          d.region.includes(`-${nativePrefix[category]}-`) &&
          (category !== 'surface' || !BORDER_WEAR_TYPES.has(d.type))
        );
        if (hits.length === 0) continue;
        const worst = Math.min(...hits.map(d => SEVERITY_CAP[d.severity]));
        const distinctLocations = new Set(hits.map(d => physicalLocation(d.region))).size;
        // Structure-based bias gate (docs/COSMETIC_VERIFICATION_REFINEMENT_SCOPE.md §4):
        // UNIFORM MINOR findings — "minor" everywhere, nothing moderate+ — are the
        // fingerprint of the detector's border bias, not damage (real handling wear is
        // uneven: specific spots, mixed severities). Minor-only never caps below 9.
        // KNOWN GAP: a genuinely evenly-worn card whose wear reads all-minor also gets
        // the benefit of the doubt (a 9 instead of 8) — border-color scoping needs the
        // card-quad geometry port (grading-v9.2-joey-fixes branch) to fix properly.
        // The spread penalty (3+ locations → one lower) applies to moderate/heavy only.
        const minorOnly = hits.every(d => d.severity === 'minor');
        faceCaps[`${category}_${face}`] = minorOnly
          ? SEVERITY_CAP.minor
          : Math.max(1, distinctLocations >= 3 ? worst - 1 : worst);
      }
    }

    console.log(`[ZOOM] ${regions.length} regions in ${batches.length} batch(es) × ~${samplesPerBatch} samples → ${defects.length} majority defect(s), ${structuralFindings.length} structural; caps=${JSON.stringify(faceCaps)}; tokens p=${usageTotals.p} c=${usageTotals.c}`);

    return { ok: true, regionsInspected: regions.length, defects, faceCaps, structuralFindings, centering };
  } catch (err: any) {
    console.error('[ZOOM] inspection failed (grading continues without it):', err?.message || err);
    return { ...empty, error: String(err?.message || err) };
  }
}
