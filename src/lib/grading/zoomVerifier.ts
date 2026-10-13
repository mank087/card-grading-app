/**
 * Zoom findings verifier (Oct 2026, v9.36; on by default, ZOOM_VERIFIER_V1=off is the kill switch).
 *
 * Calibration Oct 13 (texture set, 24 cards x 3 runs): exact grade 43% -> 47%,
 * printed-design false positives recurring 53% -> 46%, real-defect detection
 * 15/15 kept, cost about the same. Most of the remaining printed-design misses
 * come from the whole-card evaluations, which this does not touch.
 *
 * The regioned zoom pass reads each magnified crop in isolation, so printed
 * design on a border or frame is read as wear: the aged-parchment frame of an
 * MTG Smaug as "heavy edge whitening", foil/refractor borders and Garbage Pail
 * Kids sticker art as chips and scratches. A prompt rule inside the zoom pass
 * did not move it (v9.34 calibration, branch wip/zoom-texture: MAE 1.12 ->
 * 1.17); the detector's own question leaves printed design nowhere to go.
 *
 * Same idea as structural v2: a second call with one job. Every cosmetic
 * finding that survived the zoom vote is shown with
 *   - the crop it was made from,
 *   - the matching crop from the opposite position on the same face (printing
 *     repeats around a frame; handling wear is uneven), and
 *   - the whole face, so the design is visible,
 * and CLASSIFIED: physical_wear (with a stated physical sign), printed_design,
 * photo_artifact, or cannot_tell. A finding is dropped only when a majority of
 * the complete samples call it printed_design or photo_artifact. cannot_tell,
 * an incomplete reply or any failure keeps the finding: the verifier can only
 * remove a wrong deduction, never add one, and an outage changes nothing.
 *
 * Structural findings are not touched (structural v2 verifies those).
 * Everything except verifyZoomFindings is pure.
 */
import OpenAI from 'openai';
import sharp from 'sharp';
import { logOpenAIUsage } from '../apiUsageLogger';
import { applyModelCompat, BASELINE_MODEL } from './modelRouter';
import { completedChoice } from './inspectionCompleteness';

export function zoomVerifierEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = String(env.ZOOM_VERIFIER_V1 ?? '').trim().toLowerCase();
  return !(v === '0' || v === 'off' || v === 'false');
}

export const ZV_CLASSES = ['physical_wear', 'printed_design', 'photo_artifact', 'cannot_tell'] as const;
export type ZvClass = typeof ZV_CLASSES[number];
export const ZV_EVIDENCE = ['ragged_or_frayed_cut', 'exposed_stock_at_cut', 'material_missing', 'gloss_break', 'mark_crosses_print'] as const;

/** Findings per request; each brings two crops. */
export const ZV_MAX_PER_CALL = 6;

export interface ZvFinding {
  region: string;
  face: 'front' | 'back';
  category: string;
  type: string;
  severity: string;
}

/**
 * The crop at the opposite position on the same face: diagonal corner,
 * opposite edge (same segment), diagonal surface quadrant. Pure.
 */
export function referenceRegionId(region: string): string | null {
  const m = /^([FB])-(COR|EDG|SUR)-([A-Z0-9]+)(-\d+)?$/.exec(String(region || ''));
  if (!m) return null;
  const [, P, kind, part, seg = ''] = m;
  const map: Record<string, Record<string, string>> = {
    COR: { TL: 'BR', BR: 'TL', TR: 'BL', BL: 'TR' },
    EDG: { T: 'B', B: 'T', L: 'R', R: 'L' },
    SUR: { Q1: 'Q4', Q4: 'Q1', Q2: 'Q3', Q3: 'Q2', HB: 'VB', VB: 'HB' },
  };
  const opp = map[kind]?.[part];
  return opp ? `${P}-${kind}-${opp}${seg}` : null;
}

const STRUCTURAL = new Set(['crease', 'bend', 'fold', 'warp', 'tear']);
/**
 * Stains are not verified. Calibration (Oct 13): a 1984 Star Jordan with real
 * pink ring stains scattered over its plain white back had every stain dropped
 * as "repeated printed speckle" - real stains repeat too. The zoom pass's own
 * PRINTED TEXTURE rule already handles stain-vs-print.
 */
const UNVERIFIED_TYPES = new Set(['stain', 'discoloration', 'discolor', 'toning', 'spot', 'dirt', 'residue']);
/** Cosmetic zoom findings other than stains are verified; structural ones are not. Pure. */
export function isVerifiable(d: { category?: string; type?: string }): boolean {
  const type = String(d.type || '').toLowerCase();
  return d.category !== 'structural' && !STRUCTURAL.has(type) && !UNVERIFIED_TYPES.has(type);
}

export function zoomVerifierPrompt(findings: ZvFinding[], cardLabel: string): string {
  return `A card-grading system's magnified inspection flagged the defect(s) below on this ${cardLabel}. Each one lowers the grade. The flags come from an automated detector that looks at each small crop on its own and often mistakes the card's PRINTING for wear. Decide what each flagged thing actually is.

FLAGGED:
${findings.map((f, i) => `D${i + 1}. ${f.severity} ${f.type} - ${f.face} ${f.category}, crop ${f.region}`).join('\n')}

For each flag you get: the FLAGGED crop, a REFERENCE crop from the opposite position on the same face (opposite corner / opposite edge / opposite quarter), and above them the WHOLE face(s) so you can see the card's design.

CLASSES (one per flag):
- "physical_wear": real damage to the card itself. Whitening = the white/grey paper core exposed AT the cut edge or corner tip, making the cut line ragged, fuzzy or frayed. Chip = material or ink missing at the edge. Softening = a corner tip crushed or blunted compared with the other corners. Scratch/scuff = a line or patch where the surface gloss is broken, catching light differently from the print around it. Stain = a mark with its own boundary that crosses the printing without following it.
- "printed_design": part of the printed card. Printed "aged", "distressed", "worn", parchment, sepia, stone, grunge or weathered frames and borders; foil, refractor, prizm, chrome, holo and rainbow patterns; printed speckle, dots, halftone and texture; light-coloured lines, highlights and edges in the artwork; sticker die-cut outlines and printed peel art; light-coloured borders themselves. Printing is as crisp as the ink around it, sits INSIDE the card's face (the cut line next to it stays straight and clean), follows the design, and usually repeats in the reference crop and around the frame.
- "photo_artifact": made by the photo: glare, reflection, a shadow, blur, compression noise, dust or lint sitting on top, a sleeve or holder edge, the background beyond the card's edge.
- "cannot_tell": the crops do not let you decide.

"evidence" (physical_wear only; [] for every other class), from:
- "ragged_or_frayed_cut": the cut line itself is uneven, fuzzy or frayed where the flag is
- "exposed_stock_at_cut": the paper core (white, grey or brown fibre) shows AT the cut edge or corner tip
- "material_missing": a chip or bite out of the edge, or ink lifted off
- "gloss_break": the surface sheen is broken along a path or patch, unlike the print around it
- "mark_crosses_print": a stain or mark with its own boundary that crosses the printed design

RULES:
- Light or worn-looking colour that is part of the printed design is printed_design, however much it looks like wear. A printed "worn" frame looks worn on EVERY copy; real wear makes the CUT LINE itself ragged.
- For EDGE and CORNER flags: if the reference crop shows the same pattern at the same strength, that points to printing (real handling wear is uneven); if only the flagged crop shows it, look for a physical sign before calling it wear. For SURFACE flags, repetition proves nothing: real marks can be scattered across a card too.
- A mark, line or spot on PLAIN, UNPRINTED card stock (a white border, a blank white back) is never printed_design: there is no printing there for it to be part of.
- physical_wear needs at least one evidence item you can actually see. Without one, use cannot_tell.
- Do not treat the flag itself as evidence.

Reply ONLY JSON: {"flags":[{"id":"D1","class":"physical_wear|printed_design|photo_artifact|cannot_tell","evidence":[],"justification":"<one sentence naming what decides it>"}]} with exactly one entry per flag.`;
}

export interface ZvVerdict { id: number; cls: ZvClass; evidence: string[]; justification: string }

/** One sample; null unless it holds exactly one valid verdict per flag. physical_wear with no evidence becomes cannot_tell. Pure. */
export function parseZoomVerifierSample(content: string, count: number): ZvVerdict[] | null {
  let v: any;
  try { v = JSON.parse(content); } catch { return null; }
  if (!Array.isArray(v?.flags) || v.flags.length !== count) return null;
  const out: ZvVerdict[] = [];
  for (const f of v.flags) {
    const id = Number(/^D(\d+)$/i.exec(String(f?.id ?? '').trim())?.[1]);
    if (!Number.isInteger(id) || id < 1 || id > count || out.some(o => o.id === id)) return null;
    let cls = String(f?.class ?? '') as ZvClass;
    if (!ZV_CLASSES.includes(cls)) return null;
    const evidence = Array.isArray(f?.evidence) ? f.evidence.map(String).filter((e: string) => (ZV_EVIDENCE as readonly string[]).includes(e)) : [];
    if (cls === 'physical_wear' && evidence.length === 0) cls = 'cannot_tell';
    out.push({ id, cls, evidence: cls === 'physical_wear' ? evidence : [], justification: String(f?.justification ?? '').slice(0, 300) });
  }
  return out.sort((a, b) => a.id - b.id);
}

export interface ZvDecision {
  drop: boolean;
  /** Majority class among the complete samples (ties -> the class that keeps the finding). */
  cls: ZvClass;
  notDamageVotes: number;
  samples: number;
  justification: string;
}

/**
 * Per flag: drop when a strict majority of the complete samples (at least two)
 * call it printed_design or photo_artifact. Anything else keeps it. Pure.
 */
export function tallyZoomVerifier(samples: Array<ZvVerdict[] | null>, count: number): ZvDecision[] {
  const valid = samples.filter((s): s is ZvVerdict[] => !!s);
  return Array.from({ length: count }, (_, i) => {
    const verdicts = valid.map(s => s.find(v => v.id === i + 1)!).filter(Boolean);
    const notDamage = verdicts.filter(v => v.cls === 'printed_design' || v.cls === 'photo_artifact');
    const drop = verdicts.length >= 2 && notDamage.length * 2 > verdicts.length;
    const counts = new Map<ZvClass, number>();
    for (const v of verdicts) counts.set(v.cls, (counts.get(v.cls) ?? 0) + 1);
    const order: ZvClass[] = drop ? ['printed_design', 'photo_artifact'] : ['physical_wear', 'cannot_tell', 'printed_design', 'photo_artifact'];
    const cls = order.reduce((best, c) => ((counts.get(c) ?? 0) > (counts.get(best) ?? 0) ? c : best), order[0]);
    const why = verdicts.find(v => v.cls === cls)?.justification ?? '';
    return { drop, cls: verdicts.length ? cls : 'cannot_tell', notDamageVotes: notDamage.length, samples: verdicts.length, justification: why };
  });
}

export interface ZvDropped extends ZvFinding { cls: ZvClass; votes: string; justification: string }

const FACE_EDGE = 1024;

/**
 * Verify cosmetic zoom findings. Returns the indices (into `findings`) to drop.
 * Never throws; a failed or incomplete call drops nothing from its chunk.
 */
export async function verifyZoomFindings(input: {
  findings: ZvFinding[];
  crop: (regionId: string) => Buffer | undefined;
  faces: { front: Buffer; back: Buffer };
  cardLabel: string;
  model?: string;
}): Promise<{ drop: Set<number>; dropped: ZvDropped[]; calls: number; failedCalls: number }> {
  const drop = new Set<number>();
  const dropped: ZvDropped[] = [];
  const idx = input.findings.map((f, i) => ({ f, i })).filter(x => isVerifiable(x.f) && input.crop(x.f.region));
  if (idx.length === 0) return { drop, dropped, calls: 0, failedCalls: 0 };
  const chunks: Array<typeof idx> = [];
  for (let i = 0; i < idx.length; i += ZV_MAX_PER_CALL) chunks.push(idx.slice(i, i + ZV_MAX_PER_CALL));
  const model = input.model || BASELINE_MODEL;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const faceCache: Partial<Record<'front' | 'back', string>> = {};
  const faceB64 = async (face: 'front' | 'back') => (faceCache[face] ??= (await sharp(input.faces[face], { failOn: 'none' })
    .resize(FACE_EDGE, FACE_EDGE, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()).toString('base64'));
  let failedCalls = 0;
  await Promise.all(chunks.map(async (chunk) => {
    try {
      const findings = chunk.map(c => c.f);
      const content: any[] = [{ type: 'text', text: zoomVerifierPrompt(findings, input.cardLabel) }];
      for (const face of [...new Set(findings.map(f => f.face))]) {
        content.push({ type: 'text', text: `WHOLE ${face.toUpperCase()}:` });
        content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${await faceB64(face)}`, detail: 'high' } });
      }
      findings.forEach((f, n) => {
        content.push({ type: 'text', text: `D${n + 1} FLAGGED crop (${f.region}):` });
        content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${input.crop(f.region)!.toString('base64')}`, detail: 'high' } });
        const refId = referenceRegionId(f.region);
        const ref = refId ? input.crop(refId) : undefined;
        if (ref) {
          content.push({ type: 'text', text: `D${n + 1} REFERENCE crop (${refId}, opposite position):` });
          content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${ref.toString('base64')}`, detail: 'high' } });
        }
      });
      const { config } = applyModelCompat({
        model, temperature: 0, seed: 7, n: 3, max_completion_tokens: 2500,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content }],
      }, model);
      const start = Date.now();
      const res = await openai.chat.completions.create(config as any, { timeout: 60_000, maxRetries: 0 });
      logOpenAIUsage({ operation: 'zoom_findings_verify', model, usage: (res as any).usage, durationMs: Date.now() - start, metadata: { n: 3, flags: findings.length } });
      const samples = res.choices.map(ch => (completedChoice(ch) ? parseZoomVerifierSample(ch.message!.content!, findings.length) : null));
      const decisions = tallyZoomVerifier(samples, findings.length);
      decisions.forEach((d, n) => {
        if (!d.drop) return;
        drop.add(chunk[n].i);
        const f = chunk[n].f;
        dropped.push({ region: f.region, face: f.face, category: f.category, type: f.type, severity: f.severity, cls: d.cls, votes: `${d.notDamageVotes}/${d.samples}`, justification: d.justification });
      });
    } catch (e: any) {
      failedCalls++;
      console.warn(`[ZOOM] findings verifier call failed (findings kept): ${e?.message || e}`);
    }
  }));
  return { drop, dropped, calls: chunks.length, failedCalls };
}
