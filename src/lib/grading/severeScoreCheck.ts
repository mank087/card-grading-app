/**
 * Low-score verification (Sept 2026).
 *
 * Every gate in the grader guarded the way UP (unanimity, holder, confidence
 * letter, dissent) and only creases had a check on the way DOWN. A cosmetic
 * category could fall to 1 on two evaluations' say-so with nothing else looking.
 * Production case a9eca6ef (Espeon-GX full art): surface passes 1 / 10 / 1 — two
 * evaluations read the artwork's printed cyan outline as "handwritten lines" —
 * while the magnified inspection found all 28 regions clean. The card published
 * at 1 beside corners, edges and centering of 10.
 *
 * A severe cosmetic score (<= SEVERE_MAX) is now verified before it can decide
 * the grade when the evidence around it disagrees: the evaluations are 4+
 * points apart on that category, or the magnified inspection found nothing in
 * that category. One dedicated call asks whether the flaw is physical (damage or
 * an added mark) or printed design / a photo artifact.
 *
 *   confirmed -> the score stands
 *   refuted   -> the category takes the evaluations' clean reading (the highest
 *                pass score), still bounded by any magnified-inspection cap
 *   unknown   -> the score stands, and the record says it was not verified
 *
 * Structural damage is excluded: it has its own verifier (Step 3.9).
 */
import OpenAI from 'openai';
import sharp from 'sharp';
import { logOpenAIUsage } from '../apiUsageLogger';
import { applyModelCompat, BASELINE_MODEL } from './modelRouter';
import { completedChoice } from './inspectionCompleteness';
import { fetchCardOriginals, type CardOriginals } from '../images/originalImages';

export type SevereCategory = 'corners' | 'edges' | 'surface';

/** A category score at or below this needs corroboration when the evidence disagrees. */
export const SEVERE_MAX = 4;
/** Pass spread on one category that counts as the evaluations disagreeing. */
export const SEVERE_SPREAD = 4;

export interface SevereTrigger {
  cat: SevereCategory;
  score: number;
  passScores: number[];
  spread: number;
  zoomClean: boolean;
  reasons: string[];
}

export interface SevereTriggerInput {
  scores: Record<SevereCategory, number>;
  passScores: Record<SevereCategory, number[]>;
  /** null when the magnified inspection did not run or failed. */
  zoomDefectCategories: Set<string> | null;
  /** Surface held by a verified structural finding is not re-checked here. */
  structuralDetected: boolean;
}

/** Which severe scores need a second look. Pure. */
export function severeScoreTriggers(input: SevereTriggerInput): SevereTrigger[] {
  const out: SevereTrigger[] = [];
  for (const cat of ['corners', 'edges', 'surface'] as const) {
    const score = input.scores[cat];
    if (typeof score !== 'number' || score > SEVERE_MAX) continue;
    if (cat === 'surface' && input.structuralDetected) continue;
    const passScores = (input.passScores[cat] || []).filter((n): n is number => typeof n === 'number');
    const spread = passScores.length ? Math.max(...passScores) - Math.min(...passScores) : 0;
    const zoomClean = input.zoomDefectCategories !== null && !input.zoomDefectCategories.has(cat);
    const reasons: string[] = [];
    if (spread >= SEVERE_SPREAD) reasons.push(`evaluations ${passScores.join('/')} disagree`);
    if (zoomClean) reasons.push('magnified inspection found no defect in this category');
    if (reasons.length) out.push({ cat, score, passScores, spread, zoomClean, reasons });
  }
  return out;
}

export type SevereVerdict = { ok: boolean; confirmed: boolean | null; reason: string; votes?: string[] };

/**
 * The score a category takes after verification. Pure.
 * Refuted: the highest pass score, bounded by any magnified-inspection cap.
 */
export function resolveSevereScore(trigger: SevereTrigger, verdict: SevereVerdict, zoomCap: number | null): number {
  if (verdict.confirmed !== false) return trigger.score;
  const clean = Math.max(trigger.score, ...trigger.passScores);
  return zoomCap == null ? clean : Math.max(trigger.score, Math.min(clean, zoomCap));
}

const VERIFY_EDGE = 1600;
/** Quadrant crops are enlarged to this edge so fine detail survives the model's image tiling. */
const QUADRANT_EDGE = 1024;
const CLASSES = new Set(['physical', 'printed_design', 'photo_artifact', 'cannot_tell']);

/**
 * A claim reduced to neutral facts. The evaluations' descriptions carry their
 * conclusion ("handwritten marker strokes"), and passing that verbatim primed
 * the verifier into agreeing with it (Espeon anchor: 3/3 "marker" in one run,
 * 3/3 "printed design" in the next). Keep the category, face and location only.
 */
export function neutralClaim(raw: string): { text: string; face: 'front' | 'back' | null } {
  const lower = raw.toLowerCase();
  const face = /\bback\b/.test(lower) ? 'back' : /\bfront\b/.test(lower) ? 'front' : null;
  const head = raw.split(':')[0].replace(/\s+/g, ' ').trim();
  return { text: head.slice(0, 160), face };
}

/**
 * Ask whether the claimed flaws are physical. n=3, majority decides; anything
 * short of three complete answers is unknown.
 */
export async function verifySevereClaim(
  frontImageUrl: string,
  backImageUrl: string,
  cat: SevereCategory,
  claims: string[],
  opts?: { model?: string; images?: CardOriginals; reasoningEffort?: string },
): Promise<SevereVerdict> {
  try {
    let bufs: { front: Buffer; back: Buffer };
    try {
      const originals = opts?.images ?? (await fetchCardOriginals(frontImageUrl, backImageUrl));
      bufs = { front: originals.front, back: originals.back };
    } catch {
      return { ok: false, confirmed: null, reason: 'verification image fetch failed' };
    }
    const shrink = (b: Buffer) => sharp(b, { failOn: 'none' })
      .resize({ width: VERIFY_EDGE, height: VERIFY_EDGE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 }).toBuffer();
    // Enlarged quadrants of each flagged face: the tell (printed text sitting on
    // top of a line, or a mark crossing over the text) is a few pixels wide.
    const quadrants = async (b: Buffer): Promise<Buffer[]> => {
      const meta = await sharp(b, { failOn: 'none' }).metadata();
      const w = meta.width!, h = meta.height!, hw = Math.floor(w / 2), hh = Math.floor(h / 2);
      const boxes = [[0, 0, hw, hh], [w - hw, 0, hw, hh], [0, h - hh, hw, hh], [w - hw, h - hh, hw, hh]];
      return Promise.all(boxes.map(([left, top, width, height]) => sharp(b, { failOn: 'none' })
        .extract({ left, top, width, height })
        .resize({ width: QUADRANT_EDGE, height: QUADRANT_EDGE, fit: 'inside' })
        .jpeg({ quality: 90 }).toBuffer()));
    };
    const neutral = claims.slice(0, 6).map(neutralClaim);
    const flaggedFaces = [...new Set(neutral.map(c => c.face).filter((f): f is 'front' | 'back' => f !== null))];
    const faces: Array<'front' | 'back'> = flaggedFaces.length ? flaggedFaces : ['front', 'back'];
    const [front, back] = await Promise.all([shrink(bufs.front), shrink(bufs.back)]);
    const faceQuads = await Promise.all(faces.map(f => quadrants(bufs[f])));

    const claimList = neutral.length
      ? neutral.map((c, i) => `${i + 1}. ${c.text}`).join('\n')
      : '(no description recorded)';
    const text = `A card-grading system scored this trading card's ${cat.toUpperCase()} very low (${SEVERE_MAX} or below on a 1-10 scale) because of the flaw(s) below. Other evidence disagrees, so decide what the flaw actually is.

CLAIMED FLAW(S):
${claimList}

Classify the claimed flaw as ONE of:
- "physical": real damage or an alteration of the physical card — a scratch, dent, stain, crease, whitening, chipping, missing material, or ink/marker/pen ADDED after printing.
- "printed_design": part of the card as manufactured — artwork outlines and strokes, full-art or illustration line work, textures, holofoil/foil/rainbow/etched patterns, borders, design elements.
- "photo_artifact": produced by the photo, not the card — glare or reflections (including off a sleeve, top loader or case), screen moire, compression blocks, blur, shadows.
- "cannot_tell": the photo does not show enough to decide.

HOW TO TELL PRINTED FROM ADDED:
- Printed text, symbols or borders that sit cleanly ON TOP of the line, undistorted, mean the line is under the ink layer: it is printed_design. Added ink sits on top of the printing and crosses over text.
- A printed line follows the artwork's shapes (the outline of the character, the design's geometry) and is reproduced with the same sharpness and holo behaviour as the surrounding print.
- Added marks look hand-drawn: uneven pressure, ink pooling, strokes that ignore the artwork, sheen different from the card's gloss.
- Full-art and illustration cards often outline the character in a bright contrasting colour. That is design, not damage.

Look at the enlarged quarters before deciding, and report what you OBSERVE first:
- "overlap": where the flagged line or mark meets printed text or symbols, which is on top? "printed_text_on_top" (the text is crisp and uninterrupted over the line), "mark_on_top_of_text" (the mark covers or crosses over letters), "no_overlap" (they never meet), or "cannot_tell".
- "follows_artwork": true if the line traces the shapes of the artwork (a character's outline, the design's geometry), false if it ignores them.

Reply ONLY JSON: {"overlap":"printed_text_on_top|mark_on_top_of_text|no_overlap|cannot_tell","follows_artwork":true|false,"classification":"physical|printed_design|photo_artifact|cannot_tell","reason":"<one sentence naming what you saw>"}`;

    const img = (b: Buffer) => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b.toString('base64')}`, detail: 'high' } });
    const content: any[] = [
      { type: 'text', text },
      { type: 'text', text: 'FRONT (whole card):' }, img(front),
      { type: 'text', text: 'BACK (whole card):' }, img(back),
    ];
    const QUARTERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    faces.forEach((face, fi) => faceQuads[fi].forEach((q, qi) => {
      content.push({ type: 'text', text: `${face.toUpperCase()}, enlarged ${QUARTERS[qi]} quarter:` }, img(q));
    }));

    const model = opts?.model || BASELINE_MODEL;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const started = Date.now();
    const { config } = applyModelCompat({
      model,
      temperature: 0,
      seed: 7,
      n: 3,
      max_completion_tokens: 2000,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content }],
    }, model, { reasoningEffort: opts?.reasoningEffort });
    const response = await openai.chat.completions.create(config as any, { timeout: 60_000, maxRetries: 0 });
    logOpenAIUsage({
      operation: 'severe_score_verify',
      model,
      usage: (response as any).usage,
      durationMs: Date.now() - started,
      metadata: { n: 3, category: cat },
    });
    return tallySevereVotes(response.choices);
  } catch (e: any) {
    return { ok: false, confirmed: null, reason: `verification failed: ${e?.message || e}` };
  }
}

/** Majority of three complete answers. Pure (exported for tests). */
export function tallySevereVotes(choices: any[]): SevereVerdict {
  const votes: string[] = [];
  const reasons: string[] = [];
  for (const choice of choices || []) {
    if (!completedChoice(choice)) continue;
    try {
      const v = JSON.parse(choice.message?.content || '');
      if (!CLASSES.has(v?.classification) || typeof v?.reason !== 'string' || !v.reason.trim()) continue;
      // Printed text observed sitting cleanly on top of the line puts the line
      // under the ink layer, whatever the sample concluded from it.
      votes.push(v?.overlap === 'printed_text_on_top' && v.classification === 'physical' ? 'printed_design' : v.classification);
      reasons.push(v.reason.trim());
    } catch { /* unparseable sample */ }
  }
  if (votes.length !== 3) return { ok: false, confirmed: null, reason: 'verification incomplete — three complete answers required', votes };
  const physical = votes.filter(v => v === 'physical').length;
  const notDamage = votes.filter(v => v === 'printed_design' || v === 'photo_artifact').length;
  const reason = reasons[0];
  if (physical >= 2) return { ok: true, confirmed: true, reason, votes };
  if (notDamage >= 2) return { ok: true, confirmed: false, reason, votes };
  return { ok: true, confirmed: null, reason: `no majority (${votes.join(', ')})`, votes };
}
