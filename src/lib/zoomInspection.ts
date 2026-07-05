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
  const part = String(regionId || '').replace(/^[FB]-/i, '').toUpperCase();
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

async function cropFace(imageBuf: Buffer, face: 'front' | 'back'): Promise<RegionSpec[]> {
  const img = sharp(imageBuf, { failOn: 'none' });
  const meta = await img.metadata();
  const w = meta.width!, h = meta.height!;
  const P = face === 'front' ? 'F' : 'B';

  const cw = Math.round(w * 0.26), ch = Math.round(h * 0.26); // corner boxes
  const es = Math.round(Math.min(w, h) * 0.12);               // edge strip thickness
  const hw = Math.ceil(w / 2), hh = Math.ceil(h / 2);         // surface quadrant size

  const defs: Array<{ id: string; category: RegionSpec['category']; label: string; left: number; top: number; width: number; height: number }> = [
    { id: `${P}-COR-TL`, category: 'corners', label: `${face} top-left corner`, left: 0, top: 0, width: cw, height: ch },
    { id: `${P}-COR-TR`, category: 'corners', label: `${face} top-right corner`, left: w - cw, top: 0, width: cw, height: ch },
    { id: `${P}-COR-BL`, category: 'corners', label: `${face} bottom-left corner`, left: 0, top: h - ch, width: cw, height: ch },
    { id: `${P}-COR-BR`, category: 'corners', label: `${face} bottom-right corner`, left: w - cw, top: h - ch, width: cw, height: ch },
    { id: `${P}-EDG-T`, category: 'edges', label: `${face} top edge strip`, left: 0, top: 0, width: w, height: es },
    { id: `${P}-EDG-B`, category: 'edges', label: `${face} bottom edge strip`, left: 0, top: h - es, width: w, height: es },
    { id: `${P}-EDG-L`, category: 'edges', label: `${face} left edge strip`, left: 0, top: 0, width: es, height: h },
    { id: `${P}-EDG-R`, category: 'edges', label: `${face} right edge strip`, left: w - es, top: 0, width: es, height: h },
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

NOT defects (do NOT report): holographic sparkle/patterns, printed design lines and textures, the card's border color itself, image compression noise, glare/reflection bands that have soft gradual edges, background surfaces outside the card, sleeve/holder edges.
IMPORTANT context: crops from the SAME card — a straight uniform line at the outermost boundary is the card's cut edge, not damage. White showing AT the cut line on a dark border IS whitening.

Reply ONLY with JSON:
{"regions":[{"id":"<region id>","clean":true|false,"defects":[{"type":"whitening|chip|nick|softening|scratch|scuff|dent|stain|print_line|crease|bend|warp","severity":"minor|moderate|heavy","description":"<one concise sentence, location within the region>"}]}]}
Every region id you were given MUST appear exactly once.`;

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

    const regions = [...await cropFace(frontBuf, 'front'), ...await cropFace(backBuf, 'back')];

    const content: any[] = [];
    if (options?.priorityNote) {
      content.push({ type: 'text', text: `PRIORITY: ${options.priorityNote}` });
    }
    for (const r of regions) {
      content.push({ type: 'text', text: `REGION ${r.id} — ${r.label}:` });
      content.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${r.buf.toString('base64')}`, detail: 'high' },
      });
    }
    content.push({ type: 'text', text: 'Inspect every region above and return the JSON verdict for ALL of them.' });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    // v9.1: the zoom is an n=5 ensemble with per-region MAJORITY VOTING (threshold 2).
    // Bumped 3→5 because faint defects — especially white-on-white whitening on light
    // borders — register in only some samples; requiring 2-of-3 dropped them (the same
    // card graded 8 when caught, 10 when missed). At 2-of-5 a defect seen in 40% of
    // samples now survives, so detection is far more consistent run-to-run. Voting still
    // filters pure single-sample noise. Output is tiny, so the extra completions cost
    // ~a cent and no wall-clock (parallel decode).
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

    const samples: any[] = [];
    for (const choice of response.choices) {
      try { if (choice?.message?.content) samples.push(JSON.parse(choice.message.content)); }
      catch { /* discard unparseable zoom sample */ }
    }
    if (samples.length === 0) throw new Error('no parseable zoom samples');
    const regionById = new Map(regions.map(r => [r.id, r]));
    const voteThreshold = samples.length >= 2 ? 2 : 1;

    // Tally votes per (region, defect type) across the independent zoom samples
    const SEV_ORDER: Record<string, number> = { minor: 0, moderate: 1, heavy: 2 };
    const votes = new Map<string, { spec: RegionSpec; type: string; severities: string[]; description: string }>();
    for (const sample of samples) {
      for (const reg of sample.regions ?? []) {
        const spec = regionById.get(reg.id);
        if (!spec || reg.clean === true || !Array.isArray(reg.defects)) continue;
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

    // Deterministic face caps from the ladders (v9.1 recalibrated). Worst severity sets
    // the cap; THREE OR MORE affected regions in the same face+category lowers it one
    // more (two regions confirm the same wear level rather than compounding it).
    const faceCaps: Record<string, number> = {};
    for (const face of ['front', 'back'] as const) {
      for (const category of ['corners', 'edges', 'surface'] as const) {
        const hits = defects.filter(d => d.face === face && d.category === category);
        if (hits.length === 0) continue;
        const worst = Math.min(...hits.map(d => SEVERITY_CAP[d.severity]));
        const distinctRegions = new Set(hits.map(d => d.region)).size;
        faceCaps[`${category}_${face}`] = Math.max(1, distinctRegions >= 3 ? worst - 1 : worst);
      }
    }

    const usage: any = (response as any).usage;
    console.log(`[ZOOM] ${regions.length} regions × ${samples.length} samples → ${defects.length} majority defect(s), ${structuralFindings.length} structural; caps=${JSON.stringify(faceCaps)}; tokens p=${usage?.prompt_tokens} c=${usage?.completion_tokens}`);

    return { ok: true, regionsInspected: regions.length, defects, faceCaps, structuralFindings };
  } catch (err: any) {
    console.error('[ZOOM] inspection failed (grading continues without it):', err?.message || err);
    return { ...empty, error: String(err?.message || err) };
  }
}
