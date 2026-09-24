/**
 * Runs the first-look contract (firstLook.ts) and records the answer.
 *
 * It PROPOSES. The result is written to cards.first_look; the owner confirmation
 * dialog pre-fills from it and the owner decides. It never writes the card's
 * identity, grade or price by itself. The one thing it decides alone is
 * item_type, and that needs both passes to agree plus no official copyright line.
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
import { after } from 'next/server';
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
  /** Pass 1's identity when pass 2 replaced it, so the two can be compared. */
  contract_identity?: FirstLook['identity'];
  /** Pass 1's item_type when pass 2 ran: acting on a non-card needs both passes to agree. */
  contract_item_type?: string | null;
}

/**
 * FIRST_LOOK_ENABLED=1 runs first look during grading. Named FIRST_LOOK_SHADOW
 * until Sept 18 2026, when its answer started pre-filling the owner confirmation
 * dialog and deciding item_type: it is no longer a shadow. The old name is still
 * honoured so an environment that has not been updated keeps working.
 */
export function firstLookEnabled(): boolean {
  return process.env.FIRST_LOOK_ENABLED === '1' || process.env.FIRST_LOOK_SHADOW === '1';
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

export interface RunFirstLookOptions {
  model?: string;
  allowSearch?: boolean;
  /**
   * Called with pass 1's record as soon as it is known, BEFORE the optional
   * search pass starts. Only called when a search pass follows (otherwise the
   * returned record is pass 1). Not awaited; errors are swallowed.
   */
  onContractPass?: (record: FirstLookRecord) => unknown;
}

export async function runFirstLook(
  images: { front: Buffer; back?: Buffer | null },
  opts: RunFirstLookOptions = {}
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

    // Pass 1 is already worth saving: it READ the card (Espeon-GX 140/149 was read
    // correctly in pass 1 and only reached the row ~160s later, after the owner
    // had confirmed the wrong number). Hand it out now; the search pass follows.
    if (opts.onContractPass) {
      const contractRecord: FirstLookRecord = { ...base, pass: 'contract', search_ran: false, searches: 0, ms: Date.now() - started, repairs: first.repairs, result: first.value };
      try { Promise.resolve(opts.onContractPass(contractRecord)).catch(() => undefined); } catch { /* never block pass 2 */ }
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

const PASS_RANK: Record<string, number> = { contract: 1, contract_with_search: 2 };

/**
 * May `incoming` replace the stored first-look record? The grading-time run and
 * the dialog's on-demand run can race for the same card; the later writer must
 * not overwrite an answer that is as good or better.
 *   - nothing stored (or unreadable)             → write
 *   - same run (same measured_at): its final record over its pass 1 → write
 *     (never pass 1 over the final, when the two writes cross)
 *   - a strictly richer pass (search > contract) → write
 *   - otherwise (same or poorer pass from another run) → keep what is stored
 */
export function shouldReplaceFirstLook(existing: unknown, incoming: FirstLookRecord): boolean {
  if (!existing || typeof existing !== 'object') return true;
  const stored = existing as Partial<FirstLookRecord>;
  if (!stored.result || !stored.pass) return true;
  const incomingRank = PASS_RANK[incoming.pass] || 0;
  const storedRank = PASS_RANK[stored.pass] || 0;
  // Same run: an upgrade (or its own final record) may land; a late pass-1 write may not.
  if (stored.measured_at && stored.measured_at === incoming.measured_at) return incomingRank >= storedRank;
  return incomingRank > storedRank;
}

/**
 * Best-effort write to cards.first_look, under shouldReplaceFirstLook. 42703 = the
 * column is not there yet. After a write, a Pokémon card whose stored number
 * found no catalog card is re-verified with this read (identity/pokemonCatalogLink).
 */
export async function recordFirstLook(
  cardId: string | null | undefined,
  record: FirstLookRecord | null,
  opts: { reconcile?: boolean } = {},
): Promise<boolean> {
  if (!cardId || !record || !/^[0-9a-f-]{36}$/i.test(cardId)) return false;
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return false;
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(url, key);

    const { data: current, error: readError } = await client.from('cards').select('first_look').eq('id', cardId).maybeSingle();
    if (readError && (readError as any).code === '42703') return false; // no first_look column yet
    const stored = (current as any)?.first_look ?? null;
    if (!readError && !shouldReplaceFirstLook(stored, record)) {
      console.log(`[first-look] kept the stored ${stored?.pass} record (${stored?.measured_at}); not replacing it with a ${record.pass} record`);
      return false;
    }

    // item_type is a scalar copy so list pages and the value guard can read it
    // without selecting the whole first-look JSON. null = treat as a standard card.
    const itemType = actionableItemType(record);
    const withItemType = { first_look: record, item_type: itemType, item_type_evidence: itemType ? String(record.result.photos.item_type_evidence || '').slice(0, 300) : null };
    // Compare-and-set on what was read, so a concurrent writer that got in first
    // is re-judged instead of overwritten.
    const casWrite = (payload: Record<string, unknown>, seen: any) => {
      const q = client.from('cards').update(payload).eq('id', cardId);
      // No record → the slot must still be empty; a record without a timestamp
      // (pre-dates this rule) cannot be compared, so it is written over as before.
      const guarded = seen == null ? q.is('first_look', null)
        : seen.measured_at ? q.eq('first_look->>measured_at', seen.measured_at) : q;
      return guarded.select('id');
    };
    let { data: written, error } = await casWrite(withItemType, stored);
    // 42703 = a column is not there yet (migration 20260918_item_type not applied): keep the JSON.
    if (error && (error as any).code === '42703') ({ data: written, error } = await casWrite({ first_look: record }, stored));
    if (error) {
      if ((error as any).code !== '42703') console.warn('[first-look] could not record:', error.message);
      return false;
    }
    if (!written || written.length === 0) {
      // Another writer got in between the read and the write: judge its record once.
      const again = await client.from('cards').select('first_look').eq('id', cardId).maybeSingle();
      const now = (again.data as any)?.first_look ?? null;
      if (again.error || !shouldReplaceFirstLook(now, record)) return false;
      const retry = await casWrite(withItemType, now);
      if (retry.error || !retry.data?.length) return false;
    }

    if (opts.reconcile !== false) {
      try {
        const { reconcileFirstLookNumber } = await import('../identity/pokemonCatalogLink');
        await reconcileFirstLookNumber(client as any, cardId);
      } catch (e: any) {
        console.warn('[first-look] catalog reconcile skipped:', e?.message || e);
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Keep work running after the response is sent. Next 15's `after()` (Vercel
 * waitUntil underneath) extends the function's life until the promise settles.
 * Outside a request scope (scripts, tests) it throws, and the work simply runs
 * fire-and-forget as it did before.
 */
export function keepAliveAfterResponse(work: Promise<unknown>): void {
  try {
    after(work.then(() => undefined, () => undefined));
  } catch {
    /* not inside a request scope */
  }
}

/**
 * Run first look for a card and record it in two steps: pass 1 is saved as soon
 * as it is read (so the grade's short wait, the owner dialog and catalog
 * verification can use it), and the search pass, when it runs, updates the
 * record afterwards. `contract` settles once pass 1 is saved (or with the final
 * record when there is no search pass); `final` when everything is done.
 * Neither ever rejects. The whole run is kept alive past the response.
 */
export function runAndRecordFirstLook(
  cardId: string | null | undefined,
  images: { front: Buffer; back?: Buffer | null },
  opts: Omit<RunFirstLookOptions, 'onContractPass'> = {},
): { contract: Promise<FirstLookRecord | null>; final: Promise<FirstLookRecord | null> } {
  let settleContract!: (record: FirstLookRecord | null) => void;
  let contractSettled = false;
  const contract = new Promise<FirstLookRecord | null>(resolve => {
    settleContract = record => { if (!contractSettled) { contractSettled = true; resolve(record); } };
  });
  let contractWrite: Promise<unknown> = Promise.resolve();
  const final = runFirstLook(images, {
    ...opts,
    onContractPass: record => {
      contractWrite = recordFirstLook(cardId, record).catch(() => false).finally(() => settleContract(record));
      return contractWrite;
    },
  })
    .then(async record => {
      // Let pass 1's write finish first so the final record lands on top of it.
      await contractWrite;
      if (record) await recordFirstLook(cardId, record);
      settleContract(record);
      return record;
    })
    .catch(() => { settleContract(null); return null; });
  keepAliveAfterResponse(final);
  return { contract, final };
}
