/**
 * identifyCard.ts — an INDEPENDENT read of who/what is printed on a card.
 *
 * WHY THIS EXISTS
 * Card identity is currently a by-product of the ~4,000-line grading call: the
 * ensemble completion whose final grade lands on the median (visionGrader.ts,
 * "MEDIAN-PICK") also donates its `card_info`. Inside that much context — a
 * full condition rubric, per-corner prose, zoom findings — a famous-player
 * prior beats the printed text. Two customer-visible misses this week:
 *
 *   - a 1959 Topps "AL PILARCIK" #7, name set in huge type on BOTH faces,
 *     stored as "Cal Ripken Jr."
 *   - a 1960 Topps Mantle #350 stored as "1957 #35" with a fabricated
 *     "© 1957" as its year evidence.
 *
 * A controlled experiment (Sep 2026) put the SAME images in front of a short,
 * single-purpose prompt — 480px thumbnails at detail:'low', no rubric — and got
 * the correct player in 8/8 runs and the correct number in 7/8, on both
 * gpt-5.6-luna and gpt-5.1, for ~200-500 input tokens and 1-6 s.
 *
 * The YEAR was wrong in most runs on both models (a 1958-1961 spread on the
 * Mantle), so `year_hint` is exactly that — a hint. The year is resolved
 * elsewhere (yearGuard + checklist lookup) and this pass must never set it.
 *
 * HARD RULE, same as cardThumbnails.ts: nothing in this module may ever fail a
 * grade. Every path is try/caught, every failure returns null, every log line
 * is prefixed `[identify]`. A paid grade is worth more than an identity check.
 */

import OpenAI from 'openai';
import { makeThumbnail } from '@/lib/images/cardThumbnails';
import { applyModelCompat } from '@/lib/grading/modelRouter';

/** Hard ceiling on the whole pass. It runs parallel to the ensemble, but a
 *  hung request must not outlive the grade it is annotating. */
const IDENTIFY_TIMEOUT_MS = 20_000;

/** Fallback when neither IDENTIFICATION_MODEL nor GRADING_MODEL is set. */
const DEFAULT_IDENTIFICATION_MODEL = 'gpt-5.6-luna';

export interface IdentificationFields {
  /** Exact name characters as printed, or null when unreadable. Authoritative. */
  printed_name_seen: string | null;
  player_or_character: string | null;
  card_name: string | null;
  set_name: string | null;
  card_number: string | null;
  /** Exact number characters as printed ("8 OF 12", "#350"), or null. */
  card_number_text_seen: string | null;
  /** ADVISORY ONLY — measured unreliable. Never write this to card_info.year. */
  year_hint: string | null;
  language: string | null;
  variant: string | null;
  confidence: 'high' | 'medium' | 'low';
}

export interface IdentificationResult extends IdentificationFields {
  model: string;
  tokens: { in: number; out: number };
  ms: number;
}

export interface IdentifyCardImages {
  front: Buffer;
  back?: Buffer | null;
}

export interface IdentifyCardOptions {
  category?: string | null;
  model?: string;
  /** Caller's abort signal; composed with the internal 20 s timeout. */
  signal?: AbortSignal;
}

/**
 * Deliberately SHORT. The whole finding is that context volume is what breaks
 * identification, so this prompt must never grow a rubric, a scoring ladder, or
 * per-category lore. The one line of category context is a hint for naming
 * conventions, nothing more.
 */
function buildPrompt(category?: string | null): string {
  const hint = category && String(category).trim() ? String(category).trim() : 'unknown';
  return [
    'Identify this trading card from what is PRINTED on it. Return JSON only: ',
    '{"printed_name_seen": "exact text as printed, or null", "player_or_character": "...", ',
    '"card_name": "...", "set_name": "... or null", "card_number": "... or null", ',
    '"card_number_text_seen": "exact text, or null", "year_hint": "YYYY or null", ',
    '"language": "en|ja|...|null", "variant": "parallel/foil/insert text as printed or null", ',
    '"confidence": "high|medium|low"}. ',
    'The printed name is authoritative; never infer a player from the team, uniform number or card number. ',
    'If the card is not readable, use nulls and confidence "low". ',
    `Category hint: ${hint}.`,
  ].join('');
}

function asStringOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  // Models like to emit the schema's own placeholder text back at us.
  if (/^(null|none|n\/?a|unknown|\.\.\.)$/i.test(s)) return null;
  return s;
}

function asConfidence(v: unknown): 'high' | 'medium' | 'low' {
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'high' || s === 'medium' ? s : 'low';
}

function coerce(raw: any): IdentificationFields {
  return {
    printed_name_seen: asStringOrNull(raw?.printed_name_seen),
    player_or_character: asStringOrNull(raw?.player_or_character),
    card_name: asStringOrNull(raw?.card_name),
    set_name: asStringOrNull(raw?.set_name),
    card_number: asStringOrNull(raw?.card_number),
    card_number_text_seen: asStringOrNull(raw?.card_number_text_seen),
    year_hint: asStringOrNull(raw?.year_hint),
    language: asStringOrNull(raw?.language),
    variant: asStringOrNull(raw?.variant),
    confidence: asConfidence(raw?.confidence),
  };
}

/** 480px JPEG data URL. Reuses the grading pipeline's thumbnail encoder so a
 *  change to thumbnail geometry can never silently desync the two. */
async function dataUrl(buffer: Buffer): Promise<string> {
  const thumb = await makeThumbnail(buffer);
  return `data:image/jpeg;base64,${thumb.toString('base64')}`;
}

/**
 * One short vision call against 480px thumbnails.
 *
 * NEVER THROWS and NEVER REJECTS — returns null on any failure (bad buffer,
 * network, timeout, non-JSON body, missing API key). Callers treat null as
 * "no independent opinion" and keep the grading identity untouched.
 */
export async function identifyCardFromImages(
  images: IdentifyCardImages,
  opts: IdentifyCardOptions = {}
): Promise<IdentificationResult | null> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IDENTIFY_TIMEOUT_MS);
  const onOuterAbort = () => controller.abort();

  try {
    if (!images?.front || images.front.length === 0) {
      console.warn('[identify] no front image supplied — skipped');
      return null;
    }
    if (!process.env.OPENAI_API_KEY) {
      console.warn('[identify] OPENAI_API_KEY missing — skipped');
      return null;
    }
    if (opts.signal) {
      if (opts.signal.aborted) controller.abort();
      else opts.signal.addEventListener('abort', onOuterAbort, { once: true });
    }

    const model =
      opts.model ||
      process.env.IDENTIFICATION_MODEL ||
      process.env.GRADING_MODEL ||
      DEFAULT_IDENTIFICATION_MODEL;

    const content: any[] = [{ type: 'text', text: buildPrompt(opts.category) }];
    content.push({ type: 'image_url', image_url: { url: await dataUrl(images.front), detail: 'low' } });
    if (images.back && images.back.length > 0) {
      try {
        content.push({ type: 'image_url', image_url: { url: await dataUrl(images.back), detail: 'low' } });
      } catch (err: any) {
        // A bad back photo must not cost us the front read.
        console.warn(`[identify] back thumbnail failed (${err?.message}) — front only`);
      }
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 1 });

    // gpt-5.6-* 400s on temperature/top_p rather than ignoring them (v9.12 —
    // see modelRouter). applyModelCompat is the only correct way to build a
    // request body, so the sampling params go in and it decides.
    const { config } = applyModelCompat(
      {
        model,
        temperature: 0,
        top_p: 1,
        // Measured Sep 2026: at 400 the answer came back EMPTY on ~half of luna
        // runs — reasoning tokens count against this budget, and a card whose
        // print is hard to read reasons for longer than the ~250-token answer.
        // The ceiling exists to bound a runaway, not to economise; the JSON
        // itself is ~120 tokens.
        max_completion_tokens: 2000,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content }],
      } as Record<string, any>,
      model
    );
    // applyModelCompat asks for 24h prompt-cache retention, which is right for
    // the ~78k-token grading rubric and pointless here: every request carries
    // different image bytes, so the entry can never be hit and the write bills
    // at 1.25x input.
    delete (config as Record<string, any>).prompt_cache_retention;

    const response: any = await openai.chat.completions.create(config as any, { signal: controller.signal });
    const text = response?.choices?.[0]?.message?.content;
    if (!text) {
      console.warn(`[identify] empty completion (finish_reason=${response?.choices?.[0]?.finish_reason ?? '?'}) — skipped`);
      return null;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.warn('[identify] non-JSON completion — skipped');
      return null;
    }

    const ms = Date.now() - started;
    const usage = response?.usage || {};
    const result: IdentificationResult = {
      ...coerce(parsed),
      model,
      tokens: { in: Number(usage.prompt_tokens ?? 0) || 0, out: Number(usage.completion_tokens ?? 0) || 0 },
      ms,
    };
    console.log(
      `[identify] model=${model} name="${result.printed_name_seen ?? result.player_or_character ?? '-'}" ` +
        `number=${result.card_number ?? '-'} confidence=${result.confidence} ` +
        `tokens=${result.tokens.in}/${result.tokens.out} ms=${ms}`
    );
    return result;
  } catch (err: any) {
    const reason = controller.signal.aborted ? 'aborted/timeout' : err?.message || String(err);
    console.warn(`[identify] failed after ${Date.now() - started}ms: ${reason}`);
    return null;
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onOuterAbort);
  }
}
