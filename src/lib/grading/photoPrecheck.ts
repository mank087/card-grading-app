/**
 * Pre-charge photo check (Sept 2026).
 *
 * WHY. Sept 19-24, grades failed AFTER the credit was taken (then refunded)
 * because the photos could never have been graded: a selfie as the back, the
 * front and back of two different cards, several cards in one photo, a comic
 * book, a blurry photo of a page, a back cropped right to the card edge, a
 * screenshot of an eBay listing. The owner waited ~40s to learn that. This runs
 * ONE small vision call over both photos before the credit is deducted, and
 * stops only the photos it is sure about, with a message saying what to fix.
 *
 * WHAT IT IS NOT. It is not a grader and not the capture gate. Anything it is
 * unsure of passes: the grading pipeline keeps its own checks (geometry gate,
 * declined-ensemble reasons), and a grade that fails there is refunded. A
 * paying customer wrongly blocked here is the worse error, so every blocking
 * rule needs the model to say it is certain, and the pixel-level rules need a
 * deterministic signal to agree.
 *
 * FAILS OPEN. Any error, timeout or malformed answer returns verdict 'pass'
 * with failed_open set; grading then proceeds exactly as it did before.
 *
 * Reasons reuse the owner-facing vocabulary in inspectionMessageText.ts
 * (no_card, different_cards, multiple_cards, not_a_card, framing) plus
 * 'blurry' and 'screenshot', so web and app render one set of messages.
 */
import OpenAI from 'openai';
import sharp from 'sharp';
import { applyModelCompat } from './modelRouter';
import { logOpenAIUsage } from '../apiUsageLogger';

export const PRECHARGE_CHECK_VERSION = 'pc-1';

/** The model is pinned here, not inherited from the grading router: a model change moves block rates. */
export const PRECHARGE_MODEL = process.env.PRECHARGE_PHOTO_CHECK_MODEL || 'gpt-5.6-luna';

/** Overall budget for download + model call. Past this the check fails open. */
export const PRECHARGE_TIMEOUT_MS = 12_000;

/** Long edge of the copy sent to the model. */
const MODEL_EDGE = 768;

/**
 * A model "illegible_blur" call blocks only when the pixels agree: Laplacian
 * variance at 512px/mitchell (the scale src/utils/imageQuality.ts was
 * calibrated at) below this. The Aug calibration put every D-confidence card
 * under 700 and the C median at ~2200; the two blurry production failures
 * measured 555 and 846. Not a blocker on its own: a graded-normally sleeved
 * card measured 436 (Sept 25 sample), which is why the model must agree.
 */
export const BLUR_CORROBORATION_MAX = 1000;

/**
 * Framing blocks when at least this many of the card's four sides run off the
 * photo. Sept 25 sample: 0 of 51 graded-normally cards had even one side cut
 * across three runs; every photo marked 2+ had failed grading at the zoom or
 * geometry stage. Env PRECHARGE_FRAMING_MIN_CUT_SIDES (2-4) raises it without
 * a deploy if production shows false blocks.
 */
export function framingMinCutSides(): number {
  const raw = Number(process.env.PRECHARGE_FRAMING_MIN_CUT_SIDES);
  return Number.isInteger(raw) && raw >= 2 && raw <= 4 ? raw : 2;
}

/** Phone screenshots are ~2.1-2.2:1; camera photos are 4:3 or 16:9 (1.78). */
export const SCREENSHOT_ASPECT_MIN = 1.9;

/** Below this short side an image is a web thumbnail, not a camera capture. */
export const LOW_RES_SHORT_SIDE = 600;

export type PrechargeReason =
  | 'no_card'
  | 'different_cards'
  | 'multiple_cards'
  | 'not_a_card'
  | 'framing'
  | 'blurry'
  | 'screenshot';

export type PhotoSide = 'front' | 'back' | 'both';

/** Env PRECHARGE_PHOTO_CHECK: default ON; 'off' | '0' | 'false' disables. */
export function isPrechargePhotoCheckEnabled(): boolean {
  const v = (process.env.PRECHARGE_PHOTO_CHECK || '').trim().toLowerCase();
  return !(v === 'off' || v === '0' || v === 'false');
}

// ── Model contract ──────────────────────────────────────────────────────────

export type PhotoSubject =
  | 'one_trading_card'
  | 'several_cards'
  | 'person'
  | 'no_card_other'
  | 'comic_magazine_or_book'
  | 'printed_page_or_document';

export interface PhotoAssessment {
  subject: PhotoSubject;
  subject_certain: boolean;
  screen_capture: boolean;
  screen_capture_certain: boolean;
  /** How many of the card's four sides run off the edge of the photo (0-4). */
  sides_cut_off: number;
  print_legibility: 'sharp' | 'soft_but_legible' | 'illegible_blur' | 'no_card';
  note: string;
}

export interface ModelAssessment {
  front: PhotoAssessment;
  back: PhotoAssessment;
  same_card: 'yes' | 'no' | 'cannot_tell';
  same_card_certain: boolean;
  same_card_evidence: string;
}

const PHOTO_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['subject', 'subject_certain', 'screen_capture', 'screen_capture_certain', 'sides_cut_off', 'print_legibility', 'note'],
  properties: {
    subject: { type: 'string', enum: ['one_trading_card', 'several_cards', 'person', 'no_card_other', 'comic_magazine_or_book', 'printed_page_or_document'] },
    subject_certain: { type: 'boolean' },
    screen_capture: { type: 'boolean' },
    screen_capture_certain: { type: 'boolean' },
    sides_cut_off: { type: 'integer', enum: [0, 1, 2, 3, 4] },
    print_legibility: { type: 'string', enum: ['sharp', 'soft_but_legible', 'illegible_blur', 'no_card'] },
    note: { type: 'string' },
  },
} as const;

export const PRECHARGE_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['front', 'back', 'same_card', 'same_card_certain', 'same_card_evidence'],
  properties: {
    front: PHOTO_SCHEMA,
    back: PHOTO_SCHEMA,
    same_card: { type: 'string', enum: ['yes', 'no', 'cannot_tell'] },
    same_card_certain: { type: 'boolean' },
    same_card_evidence: { type: 'string' },
  },
} as const;

export const PRECHARGE_SYSTEM_PROMPT = `You screen photos submitted for trading-card grading BEFORE the customer pays. Photo 1 should show the FRONT of one card, photo 2 the BACK of the same card. You are NOT grading condition. Answer only what is plainly visible. When unsure, set the *_certain flag to false — a wrong rejection costs a paying customer, a missed problem costs nothing (a later check catches it).

For EACH photo:
- subject:
  one_trading_card: one card is the subject. Includes a card in a sleeve, toploader, magnetic holder or graded slab; a card held in a hand; a card with several panels or players printed on it (one piece of cardboard); a card photographed on a playmat, table, fabric or busy background; oversized, custom, sticker and non-sport cards; a card shown with its back side up (sides swapped is fine).
  several_cards: two or more separate cards are each substantially visible and none is clearly the subject (a pile, a binder page, a spread). A sliver of another card at the photo border does not count.
  person: a person or face is the subject and no card is.
  no_card_other: no trading card at all (room, floor, blank table, pet, random object, pure blur with no card).
  comic_magazine_or_book: a comic book, magazine, book cover or its interior page.
  printed_page_or_document: a sheet of paper, form, letter, receipt or printout that is not a card.
- subject_certain: true only if you would bet heavily on the subject.
- screen_capture: true if this image is a SCREENSHOT or a photo of a screen: phone status bar (clock, battery, signal), app or browser chrome, "1 of 6" gallery counters, listing/price/seller text, UI buttons, monitor pixels or moire. A card photo with a phone's own camera is NOT a screen capture.
- screen_capture_certain: true only if the screen/app elements are unmistakable.
- sides_cut_off: how many of the CARD's four sides (top, bottom, left, right) have part of the card running PAST the edge of the photo, so that edge of the card is not visible. A card edge that is visible but close to the photo border is NOT cut off. 0 when no card.
- print_legibility: can the printed text on the card (name, numbers, small print) be read? sharp; soft_but_legible (somewhat soft, glare, or small but readable); illegible_blur (motion/focus blur so strong the large text itself is smeared); no_card.
- note: at most 12 words on what the photo shows.

same_card: do both photos show the same physical card? Card backs are often generic (every Pokemon or Magic back looks the same) — then answer yes unless something contradicts it. Answer no only on clear contradiction: two different card FRONTS (different names/artwork), a back naming a different player/character/number than the front, backs of different games or brands, or one photo not being a card at all. cannot_tell when unsure. same_card_certain: true only for an obvious contradiction or obvious match. same_card_evidence: at most 15 words.`;

// ── Deterministic signals ───────────────────────────────────────────────────

export interface ImageSignals {
  width: number;
  height: number;
  /** long/short, orientation-independent. */
  aspect: number;
  format: string | null;
  /** Laplacian variance at 512px long edge, mitchell kernel. null when unmeasurable. */
  blurVariance: number | null;
}

/** Same math as scripts/_tmp-blur-calibration.ts and src/utils/imageQuality.ts checkBlur. */
async function laplacianVariance(buf: Buffer): Promise<number | null> {
  try {
    const { data, info } = await sharp(buf, { failOn: 'none' })
      .rotate()
      .resize(512, 512, { fit: 'inside', withoutEnlargement: true, kernel: sharp.kernel.mitchell })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const w = info.width, h = info.height, ch = info.channels;
    if (w < 3 || h < 3) return null;
    const luma = new Float32Array(w * h);
    for (let i = 0, p = 0; p < luma.length; i += ch, p++) {
      luma[p] = ch >= 3 ? 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2] : data[i];
    }
    let sum = 0, count = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const lap = -luma[i - w - 1] - luma[i - w] - luma[i - w + 1]
          - luma[i - 1] + 8 * luma[i] - luma[i + 1]
          - luma[i + w - 1] - luma[i + w] - luma[i + w + 1];
        sum += lap * lap;
        count++;
      }
    }
    return count ? sum / count : null;
  } catch {
    return null;
  }
}

export async function computeImageSignals(buf: Buffer): Promise<ImageSignals | null> {
  try {
    const meta = await sharp(buf, { failOn: 'none' }).metadata();
    let w = meta.width ?? 0, h = meta.height ?? 0;
    if (!w || !h) return null;
    // EXIF orientation 5-8 swaps the axes.
    if ((meta.orientation ?? 1) >= 5) [w, h] = [h, w];
    return {
      width: w,
      height: h,
      aspect: Math.max(w, h) / Math.min(w, h),
      format: meta.format ?? null,
      blurVariance: await laplacianVariance(buf),
    };
  } catch {
    return null;
  }
}

async function toModelJpeg(buf: Buffer): Promise<Buffer> {
  return sharp(buf, { failOn: 'none' })
    .rotate()
    .resize(MODEL_EDGE, MODEL_EDGE, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
}

// ── Decision ────────────────────────────────────────────────────────────────

export interface PrechargeDecision {
  verdict: 'pass' | 'block';
  reason?: PrechargeReason;
  side?: PhotoSide;
  /** Every rule that fired, blocking or not — for calibration logs. */
  signals: string[];
}

const PRIORITY: PrechargeReason[] = ['screenshot', 'not_a_card', 'no_card', 'multiple_cards', 'different_cards', 'framing', 'blurry'];

function isAssessment(a: any): a is PhotoAssessment {
  return !!a && typeof a === 'object' && typeof a.subject === 'string' && typeof a.subject_certain === 'boolean'
    && typeof a.screen_capture === 'boolean' && typeof a.screen_capture_certain === 'boolean'
    && Number.isInteger(a.sides_cut_off) && typeof a.print_legibility === 'string';
}

export function isModelAssessment(a: any): a is ModelAssessment {
  return !!a && typeof a === 'object' && isAssessment(a.front) && isAssessment(a.back)
    && ['yes', 'no', 'cannot_tell'].includes(a.same_card) && typeof a.same_card_certain === 'boolean';
}

/**
 * Pure: map the model's answer plus pixel signals to a verdict. Only
 * high-confidence problems block; everything else passes with its signals noted.
 */
export function decidePrecharge(
  model: ModelAssessment,
  pixels: { front: ImageSignals | null; back: ImageSignals | null },
): PrechargeDecision {
  const hits = new Map<PrechargeReason, Set<'front' | 'back'>>();
  const signals: string[] = [];
  const hit = (reason: PrechargeReason, side: 'front' | 'back') => {
    if (!hits.has(reason)) hits.set(reason, new Set());
    hits.get(reason)!.add(side);
  };

  for (const side of ['front', 'back'] as const) {
    const a = model[side];
    const px = pixels[side];
    const certain = a.subject_certain;

    // Screenshot: the model must be certain AND the pixels must look like a
    // screen capture rather than a camera photo (phone-screen aspect, or a
    // web-sized image). Neither alone blocks.
    if (a.screen_capture) {
      const screenShape = !!px && (px.aspect >= SCREENSHOT_ASPECT_MIN || Math.min(px.width, px.height) < LOW_RES_SHORT_SIDE);
      signals.push(`${side}:screen_capture${a.screen_capture_certain ? '(certain)' : ''}${screenShape ? '+shape' : ''}`);
      if (a.screen_capture_certain && screenShape) hit('screenshot', side);
    }

    if (a.subject !== 'one_trading_card') {
      signals.push(`${side}:${a.subject}${certain ? '(certain)' : ''}`);
      if (certain) {
        if (a.subject === 'several_cards') hit('multiple_cards', side);
        else if (a.subject === 'person' || a.subject === 'no_card_other') hit('no_card', side);
        // What the ITEM is gets judged from the front. A page or comic as the
        // BACK photo of a card front is "no card in the back photo".
        else if (side === 'front') hit('not_a_card', side);
        else hit('no_card', side);
      }
    }

    if (a.subject === 'one_trading_card' && a.sides_cut_off >= 1) {
      signals.push(`${side}:cut_off_${a.sides_cut_off}`);
      // One cut side never blocks: a tight crop can still be graded, and the
      // grader's own zoom pass reports it. Two or more leaves too much of the
      // card's edge unseen to inspect.
      if (a.sides_cut_off >= framingMinCutSides()) hit('framing', side);
    }

    if (a.print_legibility === 'illegible_blur') {
      const v = px?.blurVariance;
      signals.push(`${side}:illegible_blur(lap=${v == null ? 'n/a' : Math.round(v)})`);
      if (typeof v === 'number' && v < BLUR_CORROBORATION_MAX) hit('blurry', side);
    }
  }

  if (model.same_card === 'no') {
    signals.push(`pair:different${model.same_card_certain ? '(certain)' : ''}`);
    // Only between two real card photos: a selfie back is already no_card.
    const bothCards = model.front.subject === 'one_trading_card' && model.back.subject === 'one_trading_card';
    if (model.same_card_certain && bothCards) {
      hit('different_cards', 'front');
      hit('different_cards', 'back');
    }
  }

  for (const reason of PRIORITY) {
    const sides = hits.get(reason);
    if (sides && sides.size) {
      return { verdict: 'block', reason, side: sides.size === 2 ? 'both' : [...sides][0], signals };
    }
  }
  return { verdict: 'pass', signals };
}

// ── Runner ──────────────────────────────────────────────────────────────────

export interface PrechargeResult extends PrechargeDecision {
  version: string;
  model: string;
  failed_open: boolean;
  error?: string;
  latency_ms: number;
  cost_usd?: number | null;
  assessment?: ModelAssessment;
  pixels?: { front: ImageSignals | null; back: ImageSignals | null };
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    p.finally(() => clearTimeout(timer)),
    new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms); }),
  ]);
}

// luna list price per 1M tokens (keep in step with apiUsageLogger MODEL_RATES).
function estimateCost(usage: any): number | null {
  const p = usage?.prompt_tokens, c = usage?.completion_tokens;
  if (typeof p !== 'number' || typeof c !== 'number') return null;
  const cached = usage?.prompt_tokens_details?.cached_tokens ?? 0;
  return ((p - cached) * 0.20 + cached * 0.02 + c * 1.20) / 1e6;
}

export async function assessPhotos(
  frontBuf: Buffer,
  backBuf: Buffer,
  opts: { timeoutMs?: number; cardId?: string | null; userId?: string | null } = {},
): Promise<{ assessment: ModelAssessment; usage: any; durationMs: number }> {
  const [front, back] = await Promise.all([toModelJpeg(frontBuf), toModelJpeg(backBuf)]);
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 });
  const { config } = applyModelCompat({
    model: PRECHARGE_MODEL,
    max_completion_tokens: 3000,
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'precharge_photo_check', strict: true, schema: PRECHARGE_RESPONSE_SCHEMA },
    },
    messages: [
      { role: 'system', content: PRECHARGE_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Photo 1 (submitted as the FRONT):' },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${front.toString('base64')}`, detail: 'high' } },
          { type: 'text', text: 'Photo 2 (submitted as the BACK):' },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${back.toString('base64')}`, detail: 'high' } },
        ],
      },
    ],
  }, PRECHARGE_MODEL, { reasoningEffort: process.env.PRECHARGE_PHOTO_CHECK_EFFORT || 'low' });
  const started = Date.now();
  const res: any = await client.chat.completions.create(config as any, { timeout: opts.timeoutMs ?? PRECHARGE_TIMEOUT_MS });
  const durationMs = Date.now() - started;
  const choice = res.choices?.[0];
  if (choice?.finish_reason !== 'stop' || typeof choice?.message?.content !== 'string') {
    throw new Error(`incomplete response (${choice?.finish_reason ?? 'none'})`);
  }
  const parsed = JSON.parse(choice.message.content);
  if (!isModelAssessment(parsed)) throw new Error('response did not match the schema');
  return { assessment: parsed, usage: res.usage, durationMs };
}

/**
 * Run the whole check on two image buffers. Never throws; any failure passes
 * with failed_open set.
 */
export async function runPhotoPrecheck(
  frontBuf: Buffer,
  backBuf: Buffer,
  opts: { timeoutMs?: number; cardId?: string | null; userId?: string | null } = {},
): Promise<PrechargeResult> {
  const started = Date.now();
  const budget = opts.timeoutMs ?? PRECHARGE_TIMEOUT_MS;
  const base = { version: PRECHARGE_CHECK_VERSION, model: PRECHARGE_MODEL };
  try {
    const pixelsP = Promise.all([computeImageSignals(frontBuf), computeImageSignals(backBuf)]);
    const { assessment, usage, durationMs } = await withTimeout(
      assessPhotos(frontBuf, backBuf, { ...opts, timeoutMs: Math.max(1000, budget - (Date.now() - started)) }),
      Math.max(1000, budget - (Date.now() - started)),
      'photo check',
    );
    const [front, back] = await pixelsP;
    const decision = decidePrecharge(assessment, { front, back });
    // The api_usage_log row doubles as the calibration record: every verdict
    // and the rules that fired, blocked or not.
    logOpenAIUsage({
      operation: 'precharge_photo_check',
      model: PRECHARGE_MODEL,
      usage,
      durationMs,
      cardId: opts.cardId ?? null,
      userId: opts.userId ?? null,
      metadata: {
        version: PRECHARGE_CHECK_VERSION, verdict: decision.verdict, reason: decision.reason ?? null,
        side: decision.side ?? null, signals: decision.signals, assessment,
        blur: [front?.blurVariance ?? null, back?.blurVariance ?? null].map(v => (v == null ? null : Math.round(v))),
        dims: [front, back].map(p => (p ? `${p.width}x${p.height}` : null)),
      },
    });
    return { ...base, ...decision, failed_open: false, latency_ms: Date.now() - started, cost_usd: estimateCost(usage), assessment, pixels: { front, back } };
  } catch (e: any) {
    logOpenAIUsage({
      operation: 'precharge_photo_check', model: PRECHARGE_MODEL, status: 'error',
      errorMessage: String(e?.message || e).slice(0, 300), durationMs: Date.now() - started,
      cardId: opts.cardId ?? null, userId: opts.userId ?? null,
      metadata: { version: PRECHARGE_CHECK_VERSION, verdict: 'pass', failed_open: true },
    });
    return { ...base, verdict: 'pass', signals: [], failed_open: true, error: String(e?.message || e).slice(0, 300), latency_ms: Date.now() - started };
  }
}
