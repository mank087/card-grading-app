/**
 * DCM Comic Grader v0 — ADMIN COMIC LAB ONLY (not wired to any user-facing route).
 *
 * A deliberately small transplant of the card engine's earned architecture:
 *  - 3-completion ensemble in one call, server-side per-category MEDIAN consensus
 *  - deterministic weakest-link + structural ceilings computed in code
 *  - decimal comic scale with snapping to valid CGC-style steps (photo ceiling 9.8)
 *  - spine-focused regioned zoom in parallel batches of <=8 crops (the card
 *    attention-collapse lesson), compact output format, majority voting
 *  - evidence rule: a category deduction with no recorded defect is reconciled up
 *  - every gate/skip persisted in the returned notes
 */
import OpenAI from 'openai';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

export type ComicEra = 'golden' | 'silver' | 'bronze' | 'copper' | 'modern';
export type ComicCategory = 'spine' | 'corners' | 'edges' | 'surface' | 'wrap';
const CATEGORIES: ComicCategory[] = ['spine', 'corners', 'edges', 'surface', 'wrap'];

// Valid scale steps, descending. Photo ceiling: 9.8 (9.9/10 require physical inspection).
const SCALE: number[] = [9.8, 9.6, 9.4, 9.2, 9.0, 8.5, 8.0, 7.5, 7.0, 6.5, 6.0, 5.5, 5.0, 4.5, 4.0, 3.5, 3.0, 2.5, 2.0, 1.8, 1.5, 1.0, 0.5];
const GRADE_LABELS: Array<[number, string]> = [
  [9.8, 'Near Mint/Mint'], [9.6, 'Near Mint+'], [9.4, 'Near Mint'], [9.2, 'Near Mint-'],
  [9.0, 'Very Fine/Near Mint'], [8.5, 'Very Fine+'], [8.0, 'Very Fine'], [7.5, 'Very Fine-'],
  [7.0, 'Fine/Very Fine'], [6.5, 'Fine+'], [6.0, 'Fine'], [5.5, 'Fine-'], [5.0, 'Very Good/Fine'],
  [4.5, 'Very Good+'], [4.0, 'Very Good'], [3.5, 'Very Good-'], [3.0, 'Good/Very Good'],
  [2.5, 'Good+'], [2.0, 'Good'], [1.8, 'Good-'], [1.5, 'Fair/Good'], [1.0, 'Fair'], [0.5, 'Poor'],
];

export function snapToScale(value: number): number {
  // Snap DOWN to the nearest valid step at or below value (conservative), capped at 9.8.
  const v = Math.min(9.8, value);
  for (const s of SCALE) if (s <= v + 1e-9) return s;
  return 0.5;
}
export function comicGradeLabel(grade: number): string {
  for (const [g, label] of GRADE_LABELS) if (grade >= g - 1e-9) return label;
  return 'Poor';
}

// Structural ceilings (mirror of the rubric's list) applied deterministically.
const STRUCTURAL_CEILINGS: Array<{ match: RegExp; ceiling: number; label: string }> = [
  { match: /missing back cover/i, ceiling: 1.0, label: 'missing back cover' },
  { match: /detached/i, ceiling: 2.0, label: 'detached cover/centerfold' },
  { match: /piece missing|chunk missing|coupon/i, ceiling: 3.5, label: 'missing piece' },
  { match: /water/i, ceiling: 4.0, label: 'water damage' },
  { match: /writing|pen|marker/i, ceiling: 6.0, label: 'writing on cover' },
];

// Zoom severity → category ceiling (comic scale). Uniform-minor bias gate carried
// over from cards: minor-only findings never pull a category below 9.4.
const ZOOM_SEVERITY_CEILING: Record<string, number> = { minor: 9.4, moderate: 8.5, heavy: 6.0 };

export interface ComicGradeInput {
  frontBuf: Buffer;
  backBuf: Buffer;
  spineBuf?: Buffer | null;
  pageEdgeBuf?: Buffer | null;
  era: ComicEra;
}

export interface ComicGradeResult {
  ok: boolean;
  error?: string;
  finalGrade: number;
  gradeLabel: string;
  categories: Record<ComicCategory, { score: number; condition: string; defects: any[] }>;
  pageQuality: { value: string; basis: string };
  comicInfo: any;
  packaging: any;
  imageQuality: any;
  structural: { detected: boolean; findings: any[] };
  zoom: { ran: boolean; regions: number; findings: any[]; ceilings: Record<string, number>; note: string };
  consensusNotes: string[];
  summary: string;
  engineVersion: string;
  raw: { passScores: Array<Record<ComicCategory, number>> };
}

const ENGINE_VERSION = 'DCM_Comic_Lab_v0.1';

function loadComicRubric(): string {
  return fs.readFileSync(path.join(process.cwd(), 'prompts', 'comic_master_rubric_v0.txt'), 'utf-8');
}

function median(xs: number[]): number {
  const v = [...xs].sort((a, b) => a - b);
  return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
}

// ---------------------------------------------------------------------------
// Spine-focused zoom: covers only. Regions per cover face: 3 spine-side
// segments (front-left / back-right strip = the bound edge), 4 corners,
// 2 open-edge segments. Plus, when a dedicated spine photo exists, 3 segments
// of it at native resolution. Batches of <=8, n=3, compact output, 2-vote
// majority — all lessons transplanted from zoomInspection.ts.
// ---------------------------------------------------------------------------
const COMIC_ZOOM_PROMPT = `You inspect MAGNIFIED crops of ONE comic book, one crop per labeled region.
Report only CLEARLY VISIBLE physical defects per region:
- stress_tick (spine stress mark; state color_breaking true/false), crease, spine roll edge, split
- corner blunting/rounding/crease, edge chip, tear, stain, soiling, writing, foxing
Severity: "minor" = visible only at this magnification · "moderate" = visible holding the comic at reading distance · "heavy" = obvious at a glance.
NOT defects: printing screentones/dots, bag or board edges and their reflections, glare bands with soft edges, background surfaces and anything on them, the cut edge itself.
For each crop FIRST decide card_area: "most" (comic fills most of the crop) | "some" | "none" (background only). Defects from "some"/"none" crops count only if unmistakably ON the comic.
Reply ONLY with JSON: {"clean":["<region id>",...],"findings":[{"id":"<region id>","card_area":"most|some|none","defects":[{"type":"...","severity":"minor|moderate|heavy","color_breaking":true|false|null,"description":"<one sentence with location>"}]}]}
Every region id appears in exactly one list.`;

interface ComicRegion { id: string; label: string; buf: Buffer; category: ComicCategory }

async function comicCrops(buf: Buffer, face: 'front' | 'back'): Promise<ComicRegion[]> {
  const meta = await sharp(buf, { failOn: 'none' }).metadata();
  const w = meta.width!, h = meta.height!;
  const P = face === 'front' ? 'F' : 'B';
  // Spine side: LEFT edge of the front cover, RIGHT edge of the back cover.
  const spineOnLeft = face === 'front';
  const es = Math.round(w * 0.14);
  const cw = Math.round(w * 0.28), ch = Math.round(h * 0.2);
  const segLen = Math.ceil(h * 0.4);
  const defs: Array<{ id: string; category: ComicCategory; label: string; left: number; top: number; width: number; height: number }> = [];
  for (const i of [0, 1, 2]) {
    const top = Math.min(Math.round(i * 0.3 * h), h - segLen);
    defs.push({
      id: `${P}-SPINE-${i + 1}`, category: 'spine',
      label: `${face} cover spine edge, segment ${i + 1} of 3 (the bound edge)`,
      left: spineOnLeft ? 0 : w - es, top, width: es, height: segLen,
    });
    defs.push({
      id: `${P}-OPEN-${i + 1}`, category: 'edges',
      label: `${face} cover open edge, segment ${i + 1} of 3`,
      left: spineOnLeft ? w - es : 0, top, width: es, height: segLen,
    });
  }
  defs.push({ id: `${P}-COR-TL`, category: 'corners', label: `${face} top-left corner`, left: 0, top: 0, width: cw, height: ch });
  defs.push({ id: `${P}-COR-TR`, category: 'corners', label: `${face} top-right corner`, left: w - cw, top: 0, width: cw, height: ch });
  defs.push({ id: `${P}-COR-BL`, category: 'corners', label: `${face} bottom-left corner`, left: 0, top: h - ch, width: cw, height: ch });
  defs.push({ id: `${P}-COR-BR`, category: 'corners', label: `${face} bottom-right corner`, left: w - cw, top: h - ch, width: cw, height: ch });
  const out: ComicRegion[] = [];
  for (const d of defs) {
    const crop = await sharp(buf, { failOn: 'none' })
      .extract({ left: d.left, top: d.top, width: d.width, height: d.height })
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 }).toBuffer();
    out.push({ id: d.id, label: d.label, buf: crop, category: d.category });
  }
  return out;
}

async function spinePhotoCrops(buf: Buffer): Promise<ComicRegion[]> {
  const meta = await sharp(buf, { failOn: 'none' }).metadata();
  const w = meta.width!, h = meta.height!;
  const vertical = h >= w;
  const L = vertical ? h : w;
  const segLen = Math.ceil(L * 0.4);
  const out: ComicRegion[] = [];
  for (const i of [0, 1, 2]) {
    const start = Math.min(Math.round(i * 0.3 * L), L - segLen);
    const crop = await sharp(buf, { failOn: 'none' })
      .extract(vertical
        ? { left: 0, top: start, width: w, height: segLen }
        : { left: start, top: 0, width: segLen, height: h })
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 }).toBuffer();
    out.push({ id: `S-SPINE-${i + 1}`, label: `dedicated spine photo, segment ${i + 1} of 3`, buf: crop, category: 'spine' });
  }
  return out;
}

async function runComicZoom(openai: OpenAI, input: ComicGradeInput): Promise<ComicGradeResult['zoom']> {
  try {
    const regions: ComicRegion[] = [
      ...await comicCrops(input.frontBuf, 'front'),
      ...await comicCrops(input.backBuf, 'back'),
      ...(input.spineBuf ? await spinePhotoCrops(input.spineBuf) : []),
    ];
    const MAX_BATCH = 8;
    const batches: ComicRegion[][] = [];
    for (let i = 0; i < regions.length; i += MAX_BATCH) batches.push(regions.slice(i, i + MAX_BATCH));

    const batchResults = await Promise.all(batches.map(async (batch) => {
      const content: any[] = [];
      for (const r of batch) {
        content.push({ type: 'text', text: `REGION ${r.id} — ${r.label}:` });
        content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${r.buf.toString('base64')}`, detail: 'high' } });
      }
      content.push({ type: 'text', text: 'Inspect every region above and return the JSON verdict for ALL of them.' });
      const res = await openai.chat.completions.create({
        model: 'gpt-5.1', temperature: 0.1, n: 3, max_completion_tokens: 3000,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: COMIC_ZOOM_PROMPT }, { role: 'user', content }],
      }, { timeout: 90_000 });
      const samples: any[] = [];
      for (const c of res.choices) { try { if (c?.message?.content) samples.push(JSON.parse(c.message.content)); } catch { } }
      return samples;
    }));

    const regionById = new Map(regions.map(r => [r.id, r]));
    // 2-of-3 majority per (region, type); card_area gating like the card engine.
    const votes = new Map<string, { region: ComicRegion; type: string; severities: string[]; colorBreaking: boolean; description: string; count: number }>();
    for (const sample of batchResults.flat()) {
      for (const f of sample.findings ?? []) {
        const region = regionById.get(f.id);
        if (!region) continue;
        if (String(f.card_area || 'most').toLowerCase() !== 'most') continue;
        const seen = new Set<string>();
        for (const d of f.defects ?? []) {
          if (!d?.type || !d?.severity) continue;
          const key = `${f.id}|${String(d.type).toLowerCase()}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const e = votes.get(key) ?? { region, type: String(d.type).toLowerCase(), severities: [], colorBreaking: d.color_breaking === true, description: String(d.description || '').slice(0, 200), count: 0 };
          e.severities.push(['minor', 'moderate', 'heavy'].includes(String(d.severity)) ? String(d.severity) : 'minor');
          e.colorBreaking = e.colorBreaking || d.color_breaking === true;
          e.count++;
          votes.set(key, e);
        }
      }
    }
    const findings = [...votes.values()].filter(v => v.count >= 2);

    // Deterministic ceilings per category. Comic twist: a color-breaking spine
    // tick is moderate by definition; uniform minor-only never pulls below 9.4.
    const ceilings: Record<string, number> = {};
    for (const cat of CATEGORIES) {
      const hits = findings.filter(f => f.region.category === cat);
      if (!hits.length) continue;
      let worst = 9.8;
      const minorOnly = hits.every(h => !h.colorBreaking && h.severities.every(s => s === 'minor'));
      for (const h of hits) {
        const sev = [...h.severities].sort((a, b) => ({ minor: 0, moderate: 1, heavy: 2 } as any)[a] - ({ minor: 0, moderate: 1, heavy: 2 } as any)[b])[Math.floor((h.severities.length - 1) / 2)];
        const eff = h.colorBreaking && sev === 'minor' ? 'moderate' : sev;
        worst = Math.min(worst, ZOOM_SEVERITY_CEILING[eff] ?? 9.4);
      }
      ceilings[cat] = minorOnly ? Math.max(worst, 9.4) : worst;
    }
    return {
      ran: true, regions: regions.length,
      findings: findings.map(f => ({ region: f.region.id, category: f.region.category, type: f.type, colorBreaking: f.colorBreaking, votes: f.count, description: f.description })),
      ceilings,
      note: `Magnified inspection ran: ${regions.length} regions in ${batches.length} batches, ${findings.length} majority finding(s).`,
    };
  } catch (e: any) {
    return { ran: false, regions: 0, findings: [], ceilings: {}, note: `Magnified inspection unavailable (${e.message}) — graded from cover photos only.` };
  }
}

// ---------------------------------------------------------------------------
export async function gradeComic(input: ComicGradeInput): Promise<ComicGradeResult> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const rubric = loadComicRubric();
  const consensusNotes: string[] = [];

  const userContent: any[] = [
    { type: 'text', text: `Era (operator-provided): ${input.era}. Photo 1 — FRONT COVER:` },
    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${input.frontBuf.toString('base64')}`, detail: 'high' } },
    { type: 'text', text: 'Photo 2 — BACK COVER:' },
    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${input.backBuf.toString('base64')}`, detail: 'high' } },
  ];
  if (input.spineBuf) {
    userContent.push({ type: 'text', text: 'Photo 3 — SPINE CLOSE-UP:' });
    userContent.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${input.spineBuf.toString('base64')}`, detail: 'high' } });
  }
  if (input.pageEdgeBuf) {
    userContent.push({ type: 'text', text: 'Photo 4 — PAGE-EDGE STACK (for page quality):' });
    userContent.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${input.pageEdgeBuf.toString('base64')}`, detail: 'high' } });
  }

  // Main ensemble + zoom in parallel (zoom failure never fails the grade).
  const [response, zoom] = await Promise.all([
    openai.chat.completions.create({
      model: 'gpt-5.1', temperature: 0.3, top_p: 0.9, n: 3, max_completion_tokens: 6000,
      response_format: { type: 'json_object' },
      prompt_cache_key: 'dcm-comic-lab-v0',
      messages: [{ role: 'system', content: rubric }, { role: 'user', content: userContent }],
    } as any, { timeout: 180_000 }),
    runComicZoom(openai, input),
  ]);

  const passes: any[] = [];
  for (const c of response.choices) { try { if (c?.message?.content) passes.push(JSON.parse(c.message.content)); } catch { } }
  if (passes.length === 0) {
    return { ok: false, error: 'no parseable grading completions', finalGrade: 0, gradeLabel: '', categories: {} as any, pageQuality: { value: 'unknown', basis: '' }, comicInfo: {}, packaging: {}, imageQuality: {}, structural: { detected: false, findings: [] }, zoom, consensusNotes, summary: '', engineVersion: ENGINE_VERSION, raw: { passScores: [] } };
  }
  consensusNotes.push(`${passes.length}-completion ensemble, per-category median consensus.`);
  consensusNotes.push(zoom.note);

  // Median per category, snapped to scale.
  const passScores = passes.map(p => Object.fromEntries(CATEGORIES.map(c => [c, Number(p?.[c]?.score) || 0.5])) as Record<ComicCategory, number>);
  const base = passes[Math.floor(passes.length / 2)]; // representative pass for prose/defects
  const categories: ComicGradeResult['categories'] = {} as any;
  for (const cat of CATEGORIES) {
    let score = snapToScale(median(passScores.map(s => s[cat])));
    const defects = Array.isArray(base?.[cat]?.defects) ? base[cat].defects : [];
    // Evidence rule (card v9.2 lesson): a deduction below 9.4 with zero recorded
    // defects anywhere (any pass) is unexplained — reconcile to 9.4.
    const anyDefectRecorded = passes.some(p => Array.isArray(p?.[cat]?.defects) && p[cat].defects.length > 0);
    if (score < 9.4 && !anyDefectRecorded && !zoom.ceilings[cat]) {
      consensusNotes.push(`Evidence reconciliation: ${cat} ${score} -> 9.4 (no defect recorded by any completion or the magnified inspection).`);
      score = 9.4;
    }
    // Zoom ceilings only ever lower.
    if (zoom.ceilings[cat] != null && zoom.ceilings[cat] < score) {
      consensusNotes.push(`Magnified inspection capped ${cat}: ${score} -> ${zoom.ceilings[cat]}.`);
      score = snapToScale(zoom.ceilings[cat]);
    }
    categories[cat] = { score, condition: String(base?.[cat]?.condition || ''), defects };
  }

  // Structural ceilings (from any pass's structural findings — union).
  const structuralFindings = passes.flatMap(p => (p?.structural?.detected ? p.structural.findings ?? [] : []));
  const structuralDetected = structuralFindings.length > 0;
  let finalGrade = Math.min(...CATEGORIES.map(c => categories[c].score));
  if (structuralDetected) {
    for (const f of structuralFindings) {
      const text = `${f?.type || ''} ${f?.description || ''}`;
      for (const rule of STRUCTURAL_CEILINGS) {
        if (rule.match.test(text) && finalGrade > rule.ceiling) {
          consensusNotes.push(`Structural ceiling applied: ${rule.label} -> ${rule.ceiling}.`);
          finalGrade = rule.ceiling;
        }
      }
    }
  }
  // Top-grade gate (card Gem-10 lesson): 9.8 must be unanimous across passes.
  if (finalGrade >= 9.8) {
    const unanimous = passScores.every(s => CATEGORIES.every(c => s[c] >= 9.8));
    const bagged = passes.some(p => p?.packaging?.type && p.packaging.type !== 'none');
    if (!unanimous || bagged) {
      consensusNotes.push(`9.8 gate: held at 9.6 (${!unanimous ? 'not unanimous across evaluations' : 'book photographed in packaging'}).`);
      finalGrade = 9.6;
    }
  }
  finalGrade = snapToScale(finalGrade);
  const gradeLabel = comicGradeLabel(finalGrade);

  // Deterministic narrator (card v9.5 style: short, human, tail preserved).
  const weakestCats = CATEGORIES.filter(c => categories[c].score === Math.min(...CATEGORIES.map(x => categories[x].score)));
  const worstDefect = categories[weakestCats[0]]?.defects?.[0];
  const opener = finalGrade >= 9.6 ? 'An exceptionally well-preserved book.'
    : finalGrade >= 9.0 ? 'A sharp, lightly handled book.'
    : finalGrade >= 7.5 ? 'A solid book with light wear.'
    : finalGrade >= 5.0 ? 'A moderately worn reader copy with visible handling.'
    : 'A heavily worn book with significant condition issues.';
  // Only narrate a limiting category when the grade is actually CATEGORY-limited:
  // a real weak spot (<= 9.2) in fewer than all five categories. A gate-held 9.6
  // with every category at 9.8 is not "limited by spine and corners and ..." —
  // the gate note tells that story.
  const weakestScore = Math.min(...CATEGORIES.map(c => categories[c].score));
  const gateNote = consensusNotes.find(n => n.startsWith('9.8 gate'));
  const limiting = structuralDetected
    ? ` Structural damage caps this book's grade.`
    : (weakestScore <= 9.2 && weakestCats.length < CATEGORIES.length)
      ? ` The grade comes down to the ${weakestCats.join(' and ')}${worstDefect?.description ? `: ${String(worstDefect.description).replace(/\.$/, '').toLowerCase()}` : ''}.`
      : gateNote
        ? ` Held at ${finalGrade} pending unanimous confirmation of a 9.8.`
        : '';
  const summary = `${opener}${limiting} Interior pages were not inspected. Final grade: ${finalGrade} (${gradeLabel}).`;

  return {
    ok: true, finalGrade, gradeLabel, categories,
    pageQuality: base?.page_quality_estimate ?? { value: 'unknown', basis: 'not provided' },
    comicInfo: base?.comic_info ?? {}, packaging: base?.packaging ?? {}, imageQuality: base?.image_quality ?? {},
    structural: { detected: structuralDetected, findings: structuralFindings },
    zoom, consensusNotes, summary, engineVersion: ENGINE_VERSION,
    raw: { passScores },
  };
}
