/**
 * Runs the first-look contract (firstLook.ts) and records the answer.
 *
 * SHADOW MODE: nothing here feeds the grade, the stored identity, labels or
 * pricing. The result is written to cards.first_look so a week of production
 * answers can be compared with owner corrections before anything relies on it.
 *
 * Two passes, both on the full-resolution photos:
 *   1. the contract alone (~7K input tokens);
 *   2. the same contract with OpenAI web search, ONLY when pass 1 could not
 *      read the set off the card (or found no card number) and
 *      FIRST_LOOK_SEARCH=1. Measured on owner-corrected cards: set 7 → 13 of 20,
 *      year 7 → 12 of 16, and it is what separates look-alike products
 *      (1977 Wonder Bread vs Topps Star Wars). Search is text-only: the photo
 *      goes to OpenAI and nowhere else.
 * Search is never used for the parallel — measured, it over-calls variations
 * on base cards (27 → 22 of 30 correct).
 *
 * NEVER THROWS. A paid grade must not be delayed or failed by this.
 */

import OpenAI from 'openai';
import sharp from 'sharp';
import { FIRST_LOOK_PROMPT, FIRST_LOOK_SCHEMA, FIRST_LOOK_VERSION, normalizeFirstLook, type FirstLook } from './firstLook';
import { logOpenAIUsage } from '../apiUsageLogger';
import { actionableItemType } from './itemType';

const DEFAULT_MODEL = 'gpt-5.6-luna';
const PASS_TIMEOUT_MS = 45_000;
const MAX_EDGE = 1600;

const SEARCH_ADDENDUM = `

WEB SEARCH: before filling "identity", search the web. The same subject and year usually exist in several products (flagship set, inserts, food/retail premiums, stickers, regional issues, reprints, same-art reprint sets), and the most famous one is the easiest to assume wrongly.
- Your FIRST search must NOT name the set you suspect. Build it only from what is on the card: the printed name/title, the year, and the distinctive design traits you can see (border colour, where the logo sits, an actor or team line, how the card number is written — e.g. spelled out as a word, the back layout).
- Then search to confirm the product whose cards look like THIS one, including its set name, year and card number. At most 3 searches.
- Do not settle on the most famous set unless its design matches these photos; if a less famous product matches the border, layout and numbering style better, it wins, and the famous set goes in alternatives.
A value you confirmed by search but that is not printed on the card has source "recognized". Do NOT use search to decide the parallel: decide that only from the photos.`;

export interface FirstLookRecord {
  version: string;
  measured_at: string;
  model: string;
  /** Which pass produced `result`. */
  pass: 'contract' | 'contract_with_search';
  search_ran: boolean;
  searches: number;
  ms: number;
  repairs: string[];
  result: FirstLook;
  /** Pass 1's identity when pass 2 replaced it — the comparison is the point of shadow mode. */
  contract_identity?: FirstLook['identity'];
  /** Pass 1's item_type when pass 2 ran: acting on a non-card needs both passes to agree. */
  contract_item_type?: string | null;
}

export function firstLookShadowEnabled(): boolean {
  return process.env.FIRST_LOOK_SHADOW === '1';
}

/** Search is worth its cost only when the card does not name its own product. */
export function needsSearchPass(v: FirstLook): boolean {
  return v.identity.set_name.source !== 'printed' || v.identity.card_number.value === null;
}

async function toDataUrl(buffer: Buffer): Promise<string> {
  const jpeg = await sharp(buffer, { failOn: 'none' }).rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

export async function runFirstLook(
  images: { front: Buffer; back?: Buffer | null },
  opts: { model?: string; allowSearch?: boolean } = {}
): Promise<FirstLookRecord | null> {
  const started = Date.now();
  try {
    if (!images?.front?.length || !process.env.OPENAI_API_KEY) return null;
    const model = opts.model || process.env.FIRST_LOOK_MODEL || DEFAULT_MODEL;
    const urls = [await toDataUrl(images.front)];
    if (images.back?.length) { try { urls.push(await toDataUrl(images.back)); } catch { /* front-only read */ } }
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 1 });

    // Pass 1 — the contract alone.
    const t1 = Date.now();
    const r1: any = await openai.chat.completions.create({
      model, max_completion_tokens: 6000,
      response_format: { type: 'json_schema', json_schema: FIRST_LOOK_SCHEMA },
      messages: [{ role: 'user', content: [{ type: 'text', text: FIRST_LOOK_PROMPT }, ...urls.map(url => ({ type: 'image_url', image_url: { url, detail: 'high' } }))] }],
    } as any, { timeout: PASS_TIMEOUT_MS });
    logOpenAIUsage({ operation: 'first_look', model, usage: r1.usage, durationMs: Date.now() - t1 });
    const c1 = r1.choices?.[0];
    if (c1?.finish_reason !== 'stop' || c1?.message?.refusal || typeof c1?.message?.content !== 'string') return null;
    const first = normalizeFirstLook(JSON.parse(c1.message.content));

    const base: Omit<FirstLookRecord, 'pass' | 'search_ran' | 'searches' | 'repairs' | 'result' | 'ms'> = {
      version: FIRST_LOOK_VERSION, measured_at: new Date().toISOString(), model,
    };
    const allowSearch = opts.allowSearch ?? process.env.FIRST_LOOK_SEARCH === '1';
    if (!allowSearch || !needsSearchPass(first.value)) {
      return { ...base, pass: 'contract', search_ran: false, searches: 0, ms: Date.now() - started, repairs: first.repairs, result: first.value };
    }

    // Pass 2 — same contract, with web search. Any failure keeps pass 1.
    try {
      const t2 = Date.now();
      const r2: any = await (openai as any).responses.create({
        model, tools: [{ type: 'web_search' }],
        text: { format: { type: 'json_schema', name: FIRST_LOOK_SCHEMA.name, schema: FIRST_LOOK_SCHEMA.schema, strict: true } },
        input: [{ role: 'user', content: [{ type: 'input_text', text: FIRST_LOOK_PROMPT + SEARCH_ADDENDUM }, ...urls.map(url => ({ type: 'input_image', image_url: url, detail: 'high' }))] }],
      }, { timeout: PASS_TIMEOUT_MS });
      const searches = (r2.output || []).filter((o: any) => o.type === 'web_search_call').length;
      logOpenAIUsage({ operation: 'first_look_search', model, usage: { prompt_tokens: r2.usage?.input_tokens, completion_tokens: r2.usage?.output_tokens, total_tokens: r2.usage?.total_tokens } as any, durationMs: Date.now() - t2, metadata: { searches } });
      const second = normalizeFirstLook(JSON.parse(r2.output_text));
      // The parallel is decided from the photos only: keep pass 1's.
      second.value.parallel = first.value.parallel;
      return { ...base, pass: 'contract_with_search', search_ran: true, searches, ms: Date.now() - started,
        repairs: [...first.repairs, ...second.repairs], result: second.value, contract_identity: first.value.identity,
        contract_item_type: first.value.photos.item_type };
    } catch (err: any) {
      console.warn(`[first-look] search pass failed (${err?.message || err}) — keeping the contract pass`);
      return { ...base, pass: 'contract', search_ran: true, searches: 0, ms: Date.now() - started, repairs: first.repairs, result: first.value };
    }
  } catch (err: any) {
    console.warn(`[first-look] skipped: ${err?.message || err}`);
    return null;
  }
}

/** Best-effort write to cards.first_look. 42703 = the column is not there yet. */
export async function recordFirstLook(cardId: string | null | undefined, record: FirstLookRecord | null): Promise<boolean> {
  if (!cardId || !record || !/^[0-9a-f-]{36}$/i.test(cardId)) return false;
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return false;
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(url, key);
    // item_type is a scalar copy so list pages and the value guard can read it
    // without selecting the whole first-look JSON. null = treat as a standard card.
    const itemType = actionableItemType(record);
    const withItemType = { first_look: record, item_type: itemType, item_type_evidence: itemType ? String(record.result.photos.item_type_evidence || '').slice(0, 300) : null };
    let { error } = await client.from('cards').update(withItemType).eq('id', cardId);
    // 42703 = a column is not there yet (migration 20260918_item_type not applied): keep the JSON.
    if (error && (error as any).code === '42703') ({ error } = await client.from('cards').update({ first_look: record }).eq('id', cardId));
    if (error && (error as any).code !== '42703') console.warn('[first-look] could not record:', error.message);
    return !error;
  } catch {
    return false;
  }
}
