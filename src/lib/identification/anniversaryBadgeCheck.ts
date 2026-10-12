/**
 * anniversaryBadgeCheck.ts — one short vision question: does this card carry a
 * printed "30" (2026 30th Celebration) or "25" (2021 Celebrations) badge?
 *
 * Why: the Classic Collection reprints (me55c, cel25c) keep the ORIGINAL card
 * number and copyright line, so the catalog cannot tell a 2026 Pikachu 58/102
 * from the 1999 one. The badge is the only printed difference, and the grading
 * call misses it often enough that production card 911451 was saved as Base.
 * This runs only when a catalog match lands on a card with a Classic Collection
 * twin and no read reported a badge (identity/anniversaryBadgeNet.ts).
 *
 * Same conventions as identifyCard.ts: short prompt, one ~768px front image,
 * hard timeout, NEVER THROWS (null on any failure), usage logged.
 */
import OpenAI from 'openai';
import sharp from 'sharp';
import { applyModelCompat } from '@/lib/grading/modelRouter';
import { logOpenAIUsage } from '@/lib/apiUsageLogger';
import type { AnniversaryBadge } from '@/lib/pokemonAnniversary';

const CHECK_TIMEOUT_MS = 20_000;
const IMAGE_WIDTH = 768;
const DEFAULT_MODEL = 'gpt-5.6-luna';
export const BADGE_CHECK_OPERATION = 'anniversary_badge_check';

export type BadgeAnswer = 'yes' | 'no' | 'unclear';

export interface BadgeCheck {
  answer: BadgeAnswer;
  /** The digits as read, when answer is "yes". They are tiny: on 8 known cards
   *  (Oct 12) the read flipped between runs, so the kind is settled in
   *  identity/anniversaryBadgeNet.ts (resolveBadgeKind), not here. */
  badge: AnniversaryBadge | null;
  where: string | null;
  /** Sparkle foil over the whole card incl. the border: the 2026 Classic Collection look. */
  sparkle_border: boolean | null;
}

export interface BadgeCheckResult extends BadgeCheck {
  model: string;
  tokens: { in: number; out: number };
  ms: number;
}

export const BADGE_CHECK_PROMPT = [
  'This is the FRONT of a Pokémon trading card. Question 1: is there a small printed ANNIVERSARY BADGE on it?',
  'The badge is a yellow PIKACHU-HEAD emblem (two black-tipped ears) with two small red digits in its lower corners where the cheeks are: "3" and "0" (2026 30th Celebration) or "2" and "5" (2021 Celebrations).',
  'On reprints of older cards it overlaps the lower-left or lower-right corner of the artwork box; on new cards it is near the set symbol or card number.',
  'Do NOT count the card number, HP, attack damage, a set symbol, or a Halloween pumpkin stamp.',
  'Question 2: does glitter/sparkle foil cover the WHOLE card, the outer border included (not just the artwork)?',
  'Return JSON only: {"answer": "yes" | "no" | "unclear", "badge": "30" | "25" | null, "where": "short location of the badge, or null", "sparkle_border": true | false | null}.',
  'Answer "unclear" when glare, blur, a sleeve or the photo size stops you from telling.',
].join(' ');

/** The model's JSON → a checked verdict, or null when it is not one. */
export function parseBadgeCheck(text: unknown): BadgeCheck | null {
  let raw: any = text;
  if (typeof text === 'string') {
    const body = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    try { raw = JSON.parse(body); } catch { return null; }
  }
  if (!raw || typeof raw !== 'object') return null;
  const answer = String(raw.answer ?? '').trim().toLowerCase();
  if (answer !== 'yes' && answer !== 'no' && answer !== 'unclear') return null;
  const b = String(raw.badge ?? '').trim();
  const badge: AnniversaryBadge | null = b === '30' || b === '25' ? b : null;
  const where = typeof raw.where === 'string' && raw.where.trim() && !/^null$/i.test(raw.where.trim())
    ? raw.where.trim().slice(0, 120) : null;
  const sparkle_border = raw.sparkle_border === true || raw.sparkle_border === 'true' ? true
    : raw.sparkle_border === false || raw.sparkle_border === 'false' ? false : null;
  if (answer === 'yes') return { answer, badge, where, sparkle_border };
  return { answer, badge: null, where: answer === 'unclear' ? where : null, sparkle_border };
}

async function dataUrl(buffer: Buffer): Promise<string> {
  const jpeg = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize({ width: IMAGE_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

/** NEVER THROWS: null means "no opinion" (no key, bad image, timeout, non-JSON). */
export async function checkAnniversaryBadge(
  front: Buffer | null | undefined,
  opts: { cardId?: string | null; model?: string } = {},
): Promise<BadgeCheckResult | null> {
  const started = Date.now();
  try {
    if (!front?.length || !process.env.OPENAI_API_KEY) return null;
    const model = opts.model || process.env.IDENTIFICATION_MODEL || process.env.GRADING_MODEL || DEFAULT_MODEL;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 1 });
    const { config } = applyModelCompat({
      model,
      temperature: 0,
      top_p: 1,
      max_completion_tokens: 1500, // reasoning tokens count here; the answer is ~40
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: [
        { type: 'text', text: BADGE_CHECK_PROMPT },
        { type: 'image_url', image_url: { url: await dataUrl(front), detail: 'high' } },
      ] }],
    } as Record<string, any>, model);
    delete (config as Record<string, any>).prompt_cache_retention; // every request has different image bytes
    const response: any = await openai.chat.completions.create(config as any, { timeout: CHECK_TIMEOUT_MS });
    const ms = Date.now() - started;
    logOpenAIUsage({ operation: BADGE_CHECK_OPERATION, model, usage: response?.usage, durationMs: ms, cardId: opts.cardId ?? null });
    const parsed = parseBadgeCheck(response?.choices?.[0]?.message?.content);
    if (!parsed) {
      console.warn(`[badge-check] unusable answer (finish_reason=${response?.choices?.[0]?.finish_reason ?? '?'})`);
      return null;
    }
    const usage = response?.usage || {};
    const result: BadgeCheckResult = {
      ...parsed, model, ms,
      tokens: { in: Number(usage.prompt_tokens ?? 0) || 0, out: Number(usage.completion_tokens ?? 0) || 0 },
    };
    console.log(`[badge-check] ${opts.cardId ?? '-'} answer=${result.answer} badge=${result.badge ?? '-'} where="${result.where ?? '-'}" tokens=${result.tokens.in}/${result.tokens.out} ms=${ms}`);
    return result;
  } catch (err: any) {
    console.warn(`[badge-check] failed after ${Date.now() - started}ms: ${err?.message || err}`);
    return null;
  }
}
