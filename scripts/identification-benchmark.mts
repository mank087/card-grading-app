/**
 * identification-benchmark.mts — measure the independent identification pass
 * (src/lib/identification/identifyCard.ts) against cards whose true identity we
 * know, so a prompt or model change can be judged instead of guessed.
 *
 *   npx tsx scripts/identification-benchmark.mts
 *   npx tsx scripts/identification-benchmark.mts --repeat 3 --model gpt-5.1
 *   npx tsx scripts/identification-benchmark.mts --cases docs/my-cases.json
 *   npx tsx scripts/identification-benchmark.mts --from-corrections --limit 40
 *
 * Cases file: [{ card_id, truth: { name, set?, year?, number? } }]
 * Default: docs/identification-benchmark-cases.json (the two verified misses).
 *
 * --from-corrections APPENDS every card a human corrected through Manual Grade
 * Review (conversational_card_info.manual_details_correction), using the
 * corrected columns as truth. Those are, by construction, the cards the
 * in-grading identification got wrong — the hardest available test set.
 *
 * PRODUCTION SAFETY (repo rule: never hammer the DB or the API):
 *  - selects six narrow columns; NEVER bulk-selects ai_grading /
 *    conversational_grading,
 *  - a hard cap on cards (--limit, default 25) and on repeats,
 *  - 250 ms between model calls,
 *  - stops on the first 5xx/522 from Supabase.
 *
 * Cost: one ~300-token call per card per repeat. The default run (2 seed cards
 * x 2 repeats) is 4 small calls.
 */
import { config } from 'dotenv';
config({ path: '.env.local', override: true });

import { readFile } from 'node:fs/promises';

const { createClient } = await import('@supabase/supabase-js');
const { identifyCardFromImages } = await import('../src/lib/identification/identifyCard');
const { namesAgree, numbersAgree, normalizeName } = await import('../src/lib/identification/reconcile');

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const CASES_PATH = flag('cases') || 'docs/identification-benchmark-cases.json';
const REPEAT = Math.max(1, Math.min(10, Number(flag('repeat') ?? 2)));
const LIMIT = Math.max(1, Math.min(200, Number(flag('limit') ?? 25)));
const MODEL = flag('model') || undefined;
const FROM_CORRECTIONS = argv.includes('--from-corrections');
const SLEEP_MS = 250;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const storage = supabase.storage.from('cards');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isServerError(err: any): boolean {
  const status = Number(err?.status ?? err?.statusCode ?? 0);
  if (status >= 500) return true;
  return /\b(5\d\d|522)\b/.test(String(err?.message || ''));
}

// ---------------------------------------------------------------- cases
interface Truth { name?: string | null; set?: string | null; year?: string | null; number?: string | null }
interface BenchCase { card_id: string; truth: Truth; note?: string; category?: string | null }

async function loadCases(): Promise<BenchCase[]> {
  const cases: BenchCase[] = [];
  try {
    const raw = JSON.parse(await readFile(CASES_PATH, 'utf8'));
    if (Array.isArray(raw)) cases.push(...raw);
  } catch (err: any) {
    console.warn(`[bench] could not read ${CASES_PATH}: ${err?.message}`);
  }

  if (FROM_CORRECTIONS) {
    // Narrow select only — conversational_card_info is a small JSON blob; the
    // heavy conversational_grading / ai_grading columns are never touched.
    const { data, error } = await supabase
      .from('cards')
      .select('id, card_name, card_set, release_date, card_number, card_type, conversational_card_info')
      .not('conversational_card_info', 'is', null)
      .order('created_at', { ascending: false })
      .limit(400);
    if (error) {
      if (isServerError(error)) throw error;
      console.warn(`[bench] --from-corrections query failed: ${error.message}`);
    }
    for (const row of data || []) {
      const info: any = typeof row.conversational_card_info === 'string'
        ? (() => { try { return JSON.parse(row.conversational_card_info as string); } catch { return null; } })()
        : row.conversational_card_info;
      if (!info?.manual_details_correction) continue;
      if (cases.some((c) => c.card_id === row.id)) continue;
      cases.push({
        card_id: row.id,
        category: row.card_type ?? null,
        note: 'manual correction',
        truth: {
          name: row.card_name ?? null,
          set: row.card_set ?? null,
          year: row.release_date ? String(row.release_date).slice(0, 4) : null,
          number: row.card_number ?? null,
        },
      });
    }
  }
  return cases.slice(0, LIMIT);
}

// ---------------------------------------------------------------- images
async function download(path: string): Promise<Buffer | null> {
  try {
    const { data, error } = await storage.createSignedUrl(path, 300);
    if (error || !data?.signedUrl) return null;
    const res = await fetch(data.signedUrl);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- scoring
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)];
};
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '  -');
const pad = (s: string, w: number) => (s.length >= w ? s.slice(0, w) : s + ' '.repeat(w - s.length));

interface Tally { runs: number; name: number; number: number; set: number; year: number; confidentWrong: number; unresolved: number }
const blank = (): Tally => ({ runs: 0, name: 0, number: 0, set: 0, year: 0, confidentWrong: 0, unresolved: 0 });

function setsAgree(a: unknown, b: unknown): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

// ---------------------------------------------------------------- main
const cases = await loadCases();
if (cases.length === 0) {
  console.error('No cases to run.');
  process.exit(1);
}
console.log(`[bench] ${cases.length} case(s) x ${REPEAT} repeat(s) = ${cases.length * REPEAT} calls${MODEL ? ` on ${MODEL}` : ''}\n`);

const overall = blank();
const latencies: number[] = [];
let tokensIn = 0;
let tokensOut = 0;
const rows: string[] = [];

for (const c of cases) {
  const { data: card, error } = await supabase
    .from('cards')
    .select('id, front_path, back_path, card_type')
    .eq('id', c.card_id)
    .maybeSingle();
  if (error && isServerError(error)) { console.error('[bench] Supabase 5xx — stopping.'); break; }
  if (!card?.front_path) {
    rows.push(`${pad(c.card_id.slice(0, 8), 10)}${pad(String(c.truth.name ?? '?'), 22)}no front_path — skipped`);
    continue;
  }

  const front = await download(card.front_path);
  const back = card.back_path ? await download(card.back_path) : null;
  if (!front) {
    rows.push(`${pad(c.card_id.slice(0, 8), 10)}${pad(String(c.truth.name ?? '?'), 22)}download failed — skipped`);
    continue;
  }

  const tally = blank();
  const seenNames: string[] = [];
  const seenNumbers: string[] = [];
  for (let r = 0; r < REPEAT; r++) {
    const out = await identifyCardFromImages({ front, back }, { category: c.category ?? card.card_type ?? null, model: MODEL });
    tally.runs++; overall.runs++;
    if (!out) { tally.unresolved++; overall.unresolved++; await sleep(SLEEP_MS); continue; }

    latencies.push(out.ms);
    tokensIn += out.tokens.in; tokensOut += out.tokens.out;

    const gotName = out.printed_name_seen || out.player_or_character || out.card_name;
    const gotNumber = out.card_number || out.card_number_text_seen;
    seenNames.push(String(gotName ?? '-'));
    seenNumbers.push(String(gotNumber ?? '-'));

    const nameOk = !!c.truth.name && !!gotName && namesAgree(c.truth.name, gotName);
    // Number accuracy is EXACT (after separator normalization) — the whole
    // point of the guard is that "8" and "8 OF 12" must not both count as 101.
    const numberOk = !!c.truth.number && !!gotNumber && numbersAgree(c.truth.number, gotNumber);
    const setOk = !!c.truth.set && setsAgree(c.truth.set, out.set_name);
    const yearOk = !!c.truth.year && !!out.year_hint && String(out.year_hint).slice(0, 4) === String(c.truth.year).slice(0, 4);

    if (nameOk) { tally.name++; overall.name++; }
    if (numberOk) { tally.number++; overall.number++; }
    if (setOk) { tally.set++; overall.set++; }
    if (yearOk) { tally.year++; overall.year++; }
    // The dangerous failure: a wrong answer delivered as "high".
    if (out.confidence === 'high' && ((c.truth.name && !nameOk) || (c.truth.number && !numberOk))) {
      tally.confidentWrong++; overall.confidentWrong++;
    }
    if (out.confidence === 'low') { tally.unresolved++; overall.unresolved++; }
    await sleep(SLEEP_MS);
  }

  rows.push(
    `${pad(c.card_id.slice(0, 8), 10)}${pad(String(c.truth.name ?? '?'), 22)}` +
    `${pad(pct(tally.name, tally.runs), 7)}${pad(pct(tally.number, tally.runs), 8)}` +
    `${pad(pct(tally.set, tally.runs), 6)}${pad(pct(tally.year, tally.runs), 7)}` +
    `${pad(String(tally.confidentWrong), 6)}${pad(String(tally.unresolved), 6)}` +
    `saw: ${[...new Set(seenNames)].join(' | ')} #${[...new Set(seenNumbers)].join(' | ')}`
  );
}

console.log(
  `${pad('card', 10)}${pad('truth', 22)}${pad('name', 7)}${pad('number', 8)}${pad('set', 6)}${pad('year', 7)}${pad('cf.wr', 6)}${pad('unres', 6)}reads`
);
console.log('-'.repeat(120));
for (const r of rows) console.log(r);
console.log('-'.repeat(120));
console.log(
  `${pad('TOTAL', 32)}${pad(pct(overall.name, overall.runs), 7)}${pad(pct(overall.number, overall.runs), 8)}` +
  `${pad(pct(overall.set, overall.runs), 6)}${pad(pct(overall.year, overall.runs), 7)}` +
  `${pad(String(overall.confidentWrong), 6)}${pad(String(overall.unresolved), 6)}runs=${overall.runs}`
);
console.log(
  `\nmedian latency ${median(latencies)} ms · tokens in/out ${tokensIn}/${tokensOut} ` +
  `(avg ${Math.round(tokensIn / Math.max(1, latencies.length))}/${Math.round(tokensOut / Math.max(1, latencies.length))} per call)`
);
console.log('NOTE: `year` is advisory only — the pass is measurably unreliable on it and nothing consumes year_hint as truth.');
