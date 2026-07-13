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

export interface ZoomDefect {
  region: string;
  face: 'front' | 'back';
  category: 'corners' | 'edges' | 'surface' | 'structural';
  type: string;
  severity: 'minor' | 'moderate' | 'heavy';
  description: string;
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
  findings: Array<{ type?: string; location?: string; description?: string }>
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
      text: `A card-grading system flagged possible CREASE/BEND lines on this trading card. Your ONLY job: decide whether each claimed line is PHYSICAL DAMAGE or a LIGHTING/REFLECTION artifact.

THE DISCRIMINATOR:
- CREASE/FOLD (damage): a THIN line or ridge — the brightness disturbance is confined to the line itself (often a paired highlight+shadow along a ridge, may break ink or show fiber). The surface tone on BOTH sides of the line MATCHES.
- LIGHTING/REFLECTION BAND (not damage): a BROAD tonal step — one ENTIRE side of the boundary is uniformly brighter or darker than the other (glossy/metallic cards reflect room lighting as straight bands). No ridge, no ink break, no fiber.
- Also NOT damage: printed/etched design lines, foil patterns, sleeve edges.

Reply ONLY JSON: {"verdicts":[{"claim":"<label>","physical_damage":true|false,"reason":"<one sentence>"}]}`,
    }];
    for (const c of crops) {
      content.push({ type: 'text', text: `CLAIM — ${c.label}:` });
      content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${c.buf.toString('base64')}`, detail: 'high' } });
    }

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

    // Majority vote across samples: damage confirmed only if >=2 of 3 samples
    // find at least one physically-damaged claim.
    let damageVotes = 0, parsed = 0;
    const reasons: string[] = [];
    for (const choice of response.choices) {
      try {
        const v = JSON.parse(choice.message?.content || '');
        parsed++;
        const anyDamage = (v.verdicts || []).some((x: any) => x.physical_damage === true);
        if (anyDamage) damageVotes++;
        else reasons.push((v.verdicts || []).map((x: any) => x.reason).filter(Boolean)[0] || 'lighting band');
      } catch { /* skip unparseable */ }
    }
    if (parsed === 0) return { ok: false, confirmed: true, reason: 'verification unparseable — cap stands (fail-safe)' };
    const confirmed = damageVotes >= Math.ceil(parsed / 2);
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
      if (v.severities.length < voteThreshold) { minorityDropped++; continue; }
      // Median severity (2 votes → the milder one: boundary benefit of the doubt)
      const sorted = [...v.severities].sort((a, b) => SEV_ORDER[a] - SEV_ORDER[b]);
      const severity = sorted[Math.floor((sorted.length - 1) / 2)] as ZoomDefect['severity'];
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

    return { ok: true, regionsInspected: regions.length, defects, faceCaps, structuralFindings };
  } catch (err: any) {
    console.error('[ZOOM] inspection failed (grading continues without it):', err?.message || err);
    return { ...empty, error: String(err?.message || err) };
  }
}
