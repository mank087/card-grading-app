/**
 * Accuracy monitor: a READ-ONLY weekly report on grading accuracy signals,
 * compared against the previous window of equal length.
 *
 * Run (from the repo root, or a worktree whose .env.local lives two levels up):
 *   npx tsx --env-file=.env.local scripts/accuracy-monitor.ts                 # last 7 days vs the 7 before
 *   npx tsx --env-file=.env.local scripts/accuracy-monitor.ts --from 2026-10-05 --to 2026-10-11
 *   npx tsx --env-file=.env.local scripts/accuracy-monitor.ts --from 2026-10-12   # to = now
 * Dates are UTC days; --to is inclusive. The previous window is the same length,
 * ending where this one starts.
 *
 * Sections
 *   1. Volume            completed grades (conversational_whole_grade set) by category, by cards.created_at
 *   2. Distribution      10 / 9 / 8 / <=7 shares by category (+ C/D image-confidence share)
 *   3. Structural        confirmed-damage caps, structural v2 "could not confirm or rule out" holds, grades <=4
 *   4. 9-holds           share of 9s carrying a Gem Mint hold note, by reason; zoom-held 9s
 *   5. Identity          card_identity_history: real corrections vs blank fills, per category and field
 *   6. Grade reviews     card_grade_reviews requested / completed in the window, by outcome
 *   7. Photos            pre-charge photo check: short side < 1000 px share, blocks by reason
 *   8. API spend         api_usage_log cost_usd by operation
 *   9. Anniversary       printed_badge on grades, anniversary_badge_check calls + stored verdicts
 *
 * WORDING COUPLING: sections 3 and 4 count stored customer sentences. The phrases
 * live in src/lib/monitoring/accuracyPhrases.ts, each copied from the engine module
 * that writes it; src/lib/monitoring/accuracyPhrases.test.ts runs the engine's own
 * functions and fails if the wording drifts. A few hold sentences are written inline
 * in visionGrader.ts and are coupled by hand (see accuracyPhrases.ts).
 *
 * DATABASE SAFETY (Aug 8 outage): production is fragile. This script
 *   - never selects conversational_grading (the big TEXT report). The structural v2
 *     hold note lives only inside that column, so it is matched with a server-side
 *     LIKE restricted to the window and to grades <= the hold cap; only ids return.
 *   - selects light columns and `->>` JSON paths only, pages at 500 rows (keyset on
 *     created_at), and stops on the first error or timeout.
 *   - makes no writes and no model calls.
 * Calibration-harness runs call the model without logging to api_usage_log, so
 * section 8 understates true spend on days the harness runs.
 */
import { createClient } from '@supabase/supabase-js';
import { isNoOpIdentityChange } from '../src/lib/identity/reviewClient';
import {
  holdBucket, isGemMintHold, isStructuralCap, HOLD_REASON_PATTERNS,
  STRUCTURAL_UNSURE_PHRASE, ZOOM_HELD_NINE_PHRASE, type HoldBucket,
} from '../src/lib/monitoring/accuracyPhrases';
import { structuralUnsureCap } from '../src/lib/grading/structuralV2';

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!URL_ || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (pass --env-file).');
  process.exit(1);
}
const db = createClient(URL_, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const PAGE = 500;
/** The identity fields the report breaks out (others are folded into "other"). */
const ID_FIELDS = ['card_set', 'release_date', 'card_number', 'card_name', 'featured', 'subset_variant', 'parallel_type'];
/** The production hold cap (STRUCTURAL_V2_UNSURE_CAP env, default 6). */
const UNSURE_CAP = structuralUnsureCap();

// ---------------------------------------------------------------- args / windows
interface Window { from: Date; to: Date; label: string }

function parseArgs(): { cur: Window; prev: Window } {
  const args = process.argv.slice(2);
  const get = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const day = (s: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`bad date ${s} (want YYYY-MM-DD)`);
    return new Date(`${s}T00:00:00Z`);
  };
  const now = new Date();
  const fromArg = get('--from');
  const toArg = get('--to');
  const to = toArg ? new Date(day(toArg).getTime() + 86_400_000) : now; // --to is inclusive
  const from = fromArg ? day(fromArg) : new Date(to.getTime() - 7 * 86_400_000);
  if (from >= to) throw new Error('--from must be before --to');
  const len = to.getTime() - from.getTime();
  const pFrom = new Date(from.getTime() - len);
  const fmt = (d: Date) => d.toISOString().slice(0, 16).replace('T', ' ');
  return {
    cur: { from, to, label: `${fmt(from)} -> ${fmt(to)} UTC` },
    prev: { from: pFrom, to: from, label: `${fmt(pFrom)} -> ${fmt(from)} UTC` },
  };
}

// ---------------------------------------------------------------- paging
/**
 * Keyset-paged read of one table over [from, to) on a timestamp column. 500 rows
 * per page; rows sharing the boundary timestamp are de-duplicated by id. Throws
 * (stopping the run) on any error, including statement timeouts.
 */
async function pageAll<T extends { id: string }>(
  table: string, columns: string, tsCol: string, w: Window,
  filter: (q: any) => any = q => q,
): Promise<T[]> {
  const out: T[] = [];
  const seenAtBoundary = new Set<string>();
  let lower = w.from.toISOString();
  for (let page = 0; page < 400; page++) {
    let q = db.from(table).select(columns).gte(tsCol, lower).lt(tsCol, w.to.toISOString())
      .order(tsCol, { ascending: true }).order('id', { ascending: true }).limit(PAGE);
    q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table} page ${page}: ${error.message} (stopping; nothing written)`);
    const rows = (data ?? []) as unknown as Array<T & Record<string, any>>;
    const fresh = rows.filter(r => !seenAtBoundary.has(r.id));
    out.push(...fresh);
    if (rows.length < PAGE) return out;
    const lastTs = rows[rows.length - 1][tsCol] as string;
    if (lastTs === lower && fresh.length === 0) throw new Error(`${table}: >${PAGE} rows share one timestamp; cannot page`);
    if (lastTs !== lower) seenAtBoundary.clear();
    for (const r of rows) if (r[tsCol] === lastTs) seenAtBoundary.add(r.id);
    lower = lastTs;
  }
  throw new Error(`${table}: page limit reached (>200k rows) - narrow the window`);
}

// ---------------------------------------------------------------- data
interface CardRow {
  id: string; category: string | null; created_at: string;
  conversational_whole_grade: number | null;
  conversational_prompt_version: string | null;
  conversational_image_confidence: string | null;
  conversational_final_grade_summary: string | null;
  badge: string | null; fl_badge: string | null;
  bc_answer: string | null; bc_badge: string | null;
}
interface HistRow { id: string; card_id: string; action: string; changed_fields: string[]; before: any; after: any; created_at: string }
interface ReviewRow { id: string; status: string; outcome: string | null; requested_at: string; completed_at: string | null }
interface UsageRow { id: string; operation: string; cost_usd: number | null; status: string | null; created_at: string; dims: unknown; verdict: string | null; reason: string | null; failed_open: string | null }

interface Data {
  cards: CardRow[];
  unsureIds: Set<string>;
  hist: HistRow[];
  histCategory: Map<string, string>;
  reviewsRequested: ReviewRow[];
  reviewsCompleted: ReviewRow[];
  usage: UsageRow[];
}

async function load(w: Window): Promise<Data> {
  // Light columns + JSON paths only. conversational_final_grade_summary is a
  // short (<= ~700 char) text; conversational_grading is never selected.
  const cards = await pageAll<CardRow>('cards',
    'id, category, created_at, conversational_whole_grade, conversational_image_confidence, conversational_prompt_version, conversational_final_grade_summary, '
    + 'badge:conversational_card_info->>printed_badge, fl_badge:first_look->result->printed_text->>printed_badge, '
    + 'bc_answer:conversational_card_info->anniversary_badge_check->>answer, bc_badge:conversational_card_info->anniversary_badge_check->>badge',
    'created_at', w, q => q.not('conversational_whole_grade', 'is', null));

  // Structural v2 "could not confirm or rule out" holds. The note is stored only in
  // conversational_grading (structural_damage.unconfirmed_note), so the LIKE runs
  // server side over the window's grades at or below the hold cap; ids only return.
  const unsure = await pageAll<{ id: string }>('cards', 'id, created_at', 'created_at', w,
    q => q.not('conversational_whole_grade', 'is', null).lte('conversational_whole_grade', UNSURE_CAP)
      .like('conversational_grading', `%${STRUCTURAL_UNSURE_PHRASE}%`));

  const hist = await pageAll<HistRow>('card_identity_history',
    'id, card_id, action, changed_fields, before, after, created_at', 'created_at', w);
  const histCategory = new Map<string, string>();
  const ids = [...new Set(hist.map(h => h.card_id))];
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await db.from('cards').select('id, category').in('id', ids.slice(i, i + 150));
    if (error) throw new Error(`cards category lookup: ${error.message}`);
    for (const r of data ?? []) histCategory.set(r.id, r.category ?? 'Unknown');
  }

  const reviewCols = 'id, status, outcome, requested_at, completed_at';
  const reviewsRequested = await pageAll<ReviewRow>('card_grade_reviews', reviewCols, 'requested_at', w);
  const reviewsCompleted = await pageAll<ReviewRow>('card_grade_reviews', reviewCols, 'completed_at', w);

  const usage = await pageAll<UsageRow>('api_usage_log',
    'id, operation, cost_usd, status, created_at, dims:request_metadata->dims, verdict:request_metadata->>verdict, '
    + 'reason:request_metadata->>reason, failed_open:request_metadata->>failed_open',
    'created_at', w);

  return { cards, unsureIds: new Set(unsure.map(u => u.id)), hist, histCategory, reviewsRequested, reviewsCompleted, usage };
}

// ---------------------------------------------------------------- formatting
const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : '-');
const pad = (s: string | number, n: number) => String(s).padEnd(n);
const lpad = (s: string | number, n: number) => String(s).padStart(n);
/** "cur (prev)" cell. */
const cmp = (c: string | number, p: string | number) => `${c} (${p})`;
const groupBy = <T,>(xs: T[], key: (x: T) => string) => {
  const m = new Map<string, T[]>();
  for (const x of xs) { const k = key(x); if (!m.has(k)) m.set(k, []); m.get(k)!.push(x); }
  return m;
};
const cat = (c: { category: string | null }) => c.category || 'Unknown';
function categories(a: Data, b: Data): string[] {
  const counts = new Map<string, number>();
  for (const c of [...a.cards, ...b.cards]) counts.set(cat(c), (counts.get(cat(c)) ?? 0) + 1);
  return [...counts.entries()].sort((x, y) => y[1] - x[1]).map(([k]) => k);
}
const head = (s: string) => console.log(`\n== ${s} ==`);

// ---------------------------------------------------------------- sections
function volume(cur: Data, prev: Data, cats: string[]) {
  head('1. Volume: completed grades by category   current (previous)');
  const c = groupBy(cur.cards, cat), p = groupBy(prev.cards, cat);
  for (const k of cats) console.log(`  ${pad(k, 12)} ${lpad(cmp(c.get(k)?.length ?? 0, p.get(k)?.length ?? 0), 14)}`);
  console.log(`  ${pad('TOTAL', 12)} ${lpad(cmp(cur.cards.length, prev.cards.length), 14)}`);
  // Engine versions in the window: a window straddling a deploy mixes old and new behaviour.
  const vers = (d: Data) => [...groupBy(d.cards, c => (c.conversational_prompt_version || '?').replace('DCM_Grading_', '')).entries()]
    .sort((x, y) => y[1].length - x[1].length).map(([k, v]) => `${k} ${v.length}`).join(', ');
  console.log(`  engine versions: ${vers(cur)}  (prev ${vers(prev)})`);
}

function dist(rows: CardRow[]) {
  const n = rows.length;
  const g = (f: (x: number) => boolean) => rows.filter(r => f(r.conversational_whole_grade as number)).length;
  const cd = rows.filter(r => ['C', 'D'].includes(String(r.conversational_image_confidence || '').toUpperCase())).length;
  return { n, s10: pct(g(x => x === 10), n), s9: pct(g(x => x === 9), n), s8: pct(g(x => x === 8), n), s7: pct(g(x => x <= 7), n), cd: pct(cd, n) };
}
function distribution(cur: Data, prev: Data, cats: string[]) {
  head('2. Grade distribution   current (previous)');
  console.log(`  ${pad('category', 12)} ${lpad('n', 12)} ${lpad('10', 16)} ${lpad('9', 16)} ${lpad('8', 16)} ${lpad('<=7', 16)} ${lpad('img C/D', 16)}`);
  const c = groupBy(cur.cards, cat), p = groupBy(prev.cards, cat);
  const row = (label: string, a: CardRow[], b: CardRow[]) => {
    const x = dist(a), y = dist(b);
    console.log(`  ${pad(label, 12)} ${lpad(cmp(x.n, y.n), 12)} ${lpad(cmp(x.s10, y.s10), 16)} ${lpad(cmp(x.s9, y.s9), 16)} ${lpad(cmp(x.s8, y.s8), 16)} ${lpad(cmp(x.s7, y.s7), 16)} ${lpad(cmp(x.cd, y.cd), 16)}`);
  };
  for (const k of cats) row(k, c.get(k) ?? [], p.get(k) ?? []);
  row('ALL', cur.cards, prev.cards);
}

function structural(cur: Data, prev: Data) {
  head('3. Structural   current (previous)');
  const f = (d: Data) => {
    const n = d.cards.length;
    const cap = d.cards.filter(c => isStructuralCap(c.conversational_final_grade_summary)).length;
    const unsure = d.cards.filter(c => d.unsureIds.has(c.id));
    const atCap = unsure.filter(c => c.conversational_whole_grade === UNSURE_CAP).length;
    const le4 = d.cards.filter(c => (c.conversational_whole_grade as number) <= 4).length;
    return { n, cap, unsure: unsure.length, atCap, le4 };
  };
  const a = f(cur), b = f(prev);
  console.log(`  confirmed structural cap ("This card has structural damage"): ${cmp(`${a.cap} = ${pct(a.cap, a.n)}`, `${b.cap} = ${pct(b.cap, b.n)}`)}`);
  console.log(`  v2 unresolved-line holds ("${STRUCTURAL_UNSURE_PHRASE}"): ${cmp(`${a.unsure} = ${pct(a.unsure, a.n)}`, `${b.unsure} = ${pct(b.unsure, b.n)}`)}; final exactly ${UNSURE_CAP}: ${cmp(a.atCap, b.atCap)}`);
  console.log(`  grades <= 4 overall: ${cmp(`${a.le4} = ${pct(a.le4, a.n)}`, `${b.le4} = ${pct(b.le4, b.n)}`)}`);
}

function nineHolds(cur: Data, prev: Data) {
  head('4. 9-holds (share of 9s)   current (previous)');
  const f = (d: Data) => {
    const nines = d.cards.filter(c => c.conversational_whole_grade === 9);
    const buckets = new Map<HoldBucket, number>();
    let held = 0;
    for (const c of nines) {
      const b = holdBucket(c.conversational_final_grade_summary);
      if (b) { held++; buckets.set(b, (buckets.get(b) ?? 0) + 1); }
    }
    const zoom = nines.filter(c => (c.conversational_final_grade_summary || '').includes(ZOOM_HELD_NINE_PHRASE)).length;
    // A 10 -> 9 hold note on a non-9 means another cap fired after the hold; should be ~0.
    const strays = d.cards.filter(c => c.conversational_whole_grade !== 9 && isGemMintHold(c.conversational_final_grade_summary)).length;
    return { n9: nines.length, held, buckets, zoom, strays };
  };
  const a = f(cur), b = f(prev);
  console.log(`  9s: ${cmp(a.n9, b.n9)}; "presents at Gem Mint level" holds: ${cmp(`${a.held} = ${pct(a.held, a.n9)}`, `${b.held} = ${pct(b.held, b.n9)}`)}`);
  const order: HoldBucket[] = [...HOLD_REASON_PATTERNS.map(p => p.bucket), 'other'];
  for (const k of order) {
    const x = a.buckets.get(k) ?? 0, y = b.buckets.get(k) ?? 0;
    if (!x && !y) continue;
    console.log(`    ${pad(k, 22)} ${lpad(cmp(`${x} = ${pct(x, a.n9)}`, `${y} = ${pct(y, b.n9)}`), 28)}`);
  }
  console.log(`  zoom-held 9s ("${ZOOM_HELD_NINE_PHRASE}"): ${cmp(`${a.zoom} = ${pct(a.zoom, a.n9)}`, `${b.zoom} = ${pct(b.zoom, b.n9)}`)}`);
  if (a.strays || b.strays) console.log(`  hold note on a non-9 grade: ${cmp(a.strays, b.strays)}`);
}

/**
 * Identity: per history row, each changed field is classified as
 *   noop      - isNoOpIdentityChange() says it did not change what the card says
 *   prefill   - stored value was blank and the owner accepted first look's prefill
 *               (tagged in after._meta.prefill_accepted_fields; untagged on older rows)
 *   blank     - stored value was blank, owner typed/accepted something (not tagged as prefill)
 *   real      - a stored, non-blank value was changed: a true correction of DCM's identification
 * Rate = cards with >=1 real correction / cards whose identity was confirmed or edited.
 */
function identity(cur: Data, prev: Data) {
  head('5. Identity corrections (card_identity_history)   current (previous)');
  const isBlank = (k: string, v: unknown) => isNoOpIdentityChange(k, null, v);
  const f = (d: Data) => {
    const rows = d.hist.filter(h => h.action !== 'pricing_selection' && h.action !== 'dismiss');
    const perCat = new Map<string, { cards: Set<string>; real: Set<string>; fillOnly: Set<string> }>();
    const perField = new Map<string, { real: number; blank: number; prefill: number }>();
    const otherNames = new Map<string, number>();
    for (const h of rows) {
      const c = d.histCategory.get(h.card_id) ?? 'Unknown';
      if (!perCat.has(c)) perCat.set(c, { cards: new Set(), real: new Set(), fillOnly: new Set() });
      const pc = perCat.get(c)!;
      pc.cards.add(h.card_id);
      const tagged: string[] = Array.isArray(h.after?._meta?.prefill_accepted_fields) ? h.after._meta.prefill_accepted_fields : [];
      let real = false, fill = false;
      for (const k of h.changed_fields ?? []) {
        const before = h.before?.[k], after = h.after?.[k];
        if (isNoOpIdentityChange(k, before, after)) continue;
        const fk = ID_FIELDS.includes(k) ? k : 'other';
        if (fk === 'other') otherNames.set(k, (otherNames.get(k) ?? 0) + 1);
        if (!perField.has(fk)) perField.set(fk, { real: 0, blank: 0, prefill: 0 });
        const pf = perField.get(fk)!;
        if (isBlank(k, before)) {
          fill = true;
          if (tagged.includes(k)) pf.prefill++; else pf.blank++;
        } else { real = true; pf.real++; }
      }
      if (real) pc.real.add(h.card_id); else if (fill) pc.fillOnly.add(h.card_id);
    }
    // a card corrected in one row and filled in another counts as corrected only
    for (const pc of perCat.values()) for (const id of pc.real) pc.fillOnly.delete(id);
    return { rows: rows.length, perCat, perField, otherNames, actions: groupBy(d.hist, h => h.action) };
  };
  const a = f(cur), b = f(prev);
  const acts = (x: typeof a) => [...x.actions.entries()].map(([k, v]) => `${k} ${v.length}`).join(', ');
  console.log(`  history rows: ${cur.hist.length} [${acts(a)}]  (prev ${prev.hist.length} [${acts(b)}])`);
  console.log(`  ${pad('category', 12)} ${lpad('cards', 12)} ${lpad('real corrected', 26)} ${lpad('blank-fill only', 26)}`);
  const cats = [...new Set([...a.perCat.keys(), ...b.perCat.keys()])].sort((x, y) => (a.perCat.get(y)?.cards.size ?? 0) - (a.perCat.get(x)?.cards.size ?? 0));
  const tot = (x: typeof a) => {
    let cards = 0, real = 0, fill = 0;
    for (const v of x.perCat.values()) { cards += v.cards.size; real += v.real.size; fill += v.fillOnly.size; }
    return { cards, real, fill };
  };
  const line = (k: string, x: { cards: number; real: number; fill: number }, y: { cards: number; real: number; fill: number }) =>
    console.log(`  ${pad(k, 12)} ${lpad(cmp(x.cards, y.cards), 12)} ${lpad(cmp(`${x.real} = ${pct(x.real, x.cards)}`, `${y.real} = ${pct(y.real, y.cards)}`), 26)} ${lpad(cmp(`${x.fill} = ${pct(x.fill, x.cards)}`, `${y.fill} = ${pct(y.fill, y.cards)}`), 26)}`);
  const sz = (v?: { cards: Set<string>; real: Set<string>; fillOnly: Set<string> }) => ({ cards: v?.cards.size ?? 0, real: v?.real.size ?? 0, fill: v?.fillOnly.size ?? 0 });
  for (const k of cats) line(k, sz(a.perCat.get(k)), sz(b.perCat.get(k)));
  line('ALL', tot(a), tot(b));
  console.log(`  per field (real = changed a stored non-blank value; blank = filled a blank; prefill = filled with first look's tagged prefill):`);
  for (const k of [...ID_FIELDS, 'other']) {
    const x = a.perField.get(k) ?? { real: 0, blank: 0, prefill: 0 }, y = b.perField.get(k) ?? { real: 0, blank: 0, prefill: 0 };
    if (!x.real && !x.blank && !x.prefill && !y.real && !y.blank && !y.prefill) continue;
    console.log(`    ${pad(k, 15)} real ${lpad(cmp(x.real, y.real), 10)}  blank ${lpad(cmp(x.blank, y.blank), 10)}  prefill ${lpad(cmp(x.prefill, y.prefill), 10)}`);
  }
  const topOther = [...a.otherNames.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([k, v]) => `${k} ${v}`).join(', ');
  if (topOther) console.log(`    other = ${topOther}${a.otherNames.size > 6 ? ', ...' : ''}`);
  console.log('    (a yes/no flag going false -> true counts as a blank fill: a blank flag and false are the same no-op value)');
}

function reviews(cur: Data, prev: Data) {
  head('6. Manual grade reviews (card_grade_reviews)   current (previous)');
  const by = (rows: ReviewRow[], k: (r: ReviewRow) => string) => [...groupBy(rows, k).entries()].map(([x, v]) => `${x} ${v.length}`).join(', ') || 'none';
  console.log(`  requested: ${cur.reviewsRequested.length} (${prev.reviewsRequested.length})  current status: ${by(cur.reviewsRequested, r => r.status)}`);
  console.log(`  completed: ${cur.reviewsCompleted.length} (${prev.reviewsCompleted.length})  outcome: ${by(cur.reviewsCompleted, r => r.outcome ?? 'none')}  [prev: ${by(prev.reviewsCompleted, r => r.outcome ?? 'none')}]`);
}

function shortSide(dims: unknown): number | null {
  if (!Array.isArray(dims)) return null;
  const sides = dims.map(d => {
    const m = /^(\d+)x(\d+)$/.exec(String(d ?? ''));
    return m ? Math.min(Number(m[1]), Number(m[2])) : null;
  }).filter((x): x is number => x !== null);
  return sides.length ? Math.min(...sides) : null;
}
function photos(cur: Data, prev: Data) {
  head('7. Pre-charge photo check   current (previous)');
  const f = (d: Data) => {
    const rows = d.usage.filter(u => u.operation === 'precharge_photo_check');
    const withDims = rows.map(r => shortSide(r.dims)).filter((x): x is number => x !== null);
    const small = withDims.filter(x => x < 1000).length;
    const blocks = rows.filter(r => r.verdict === 'block');
    const failOpen = rows.filter(r => r.failed_open === 'true').length;
    return { n: rows.length, dimsN: withDims.length, small, blocks, failOpen };
  };
  const a = f(cur), b = f(prev);
  console.log(`  checks: ${cmp(a.n, b.n)}; failed open: ${cmp(a.failOpen, b.failOpen)}`);
  console.log(`  short side < 1000 px (smaller of front/back): ${cmp(`${a.small}/${a.dimsN} = ${pct(a.small, a.dimsN)}`, `${b.small}/${b.dimsN} = ${pct(b.small, b.dimsN)}`)}`);
  console.log(`  blocks: ${cmp(`${a.blocks.length} = ${pct(a.blocks.length, a.n)}`, `${b.blocks.length} = ${pct(b.blocks.length, b.n)}`)}`);
  const reasons = [...new Set([...a.blocks, ...b.blocks].map(r => r.reason ?? 'unknown'))];
  for (const r of reasons) console.log(`    ${pad(r, 26)} ${cmp(a.blocks.filter(x => (x.reason ?? 'unknown') === r).length, b.blocks.filter(x => (x.reason ?? 'unknown') === r).length)}`);
}

function spend(cur: Data, prev: Data) {
  head('8. API spend (api_usage_log.cost_usd)   current (previous)');
  const f = (d: Data) => {
    const m = new Map<string, { n: number; usd: number; err: number }>();
    for (const u of d.usage) {
      const v = m.get(u.operation) ?? { n: 0, usd: 0, err: 0 };
      v.n++; v.usd += Number(u.cost_usd ?? 0); if (u.status === 'error') v.err++;
      m.set(u.operation, v);
    }
    return m;
  };
  const a = f(cur), b = f(prev);
  const ops = [...new Set([...a.keys(), ...b.keys()])].sort((x, y) => (a.get(y)?.usd ?? 0) - (a.get(x)?.usd ?? 0));
  let ta = 0, tb = 0;
  for (const op of ops) {
    const x = a.get(op) ?? { n: 0, usd: 0, err: 0 }, y = b.get(op) ?? { n: 0, usd: 0, err: 0 };
    ta += x.usd; tb += y.usd;
    console.log(`  ${pad(op, 26)} $${lpad(cmp(x.usd.toFixed(2), y.usd.toFixed(2)), 17)}  calls ${lpad(cmp(x.n, y.n), 14)}${x.err || y.err ? `  errors ${cmp(x.err, y.err)}` : ''}`);
  }
  console.log(`  ${pad('TOTAL', 26)} $${lpad(cmp(ta.toFixed(2), tb.toFixed(2)), 17)}`);
  const ga = cur.cards.length, gb = prev.cards.length;
  console.log(`  per completed grade: $${cmp(ga ? (ta / ga).toFixed(3) : '-', gb ? (tb / gb).toFixed(3) : '-')}`);
  console.log('  note: calibration-harness runs are not logged to api_usage_log; backfill/sweep scripts that pass through the logger are.');
}

function anniversary(cur: Data, prev: Data) {
  head('9. Pokemon anniversary badges   current (previous)');
  const f = (d: Data) => {
    const poke = d.cards.filter(c => cat(c) === 'Pokemon');
    const badge = groupBy(poke.filter(c => c.badge), c => c.badge as string);
    const flBadge = poke.filter(c => c.fl_badge).length;
    const checked = poke.filter(c => c.bc_answer);
    const answers = groupBy(checked, c => `${c.bc_answer}${c.bc_badge ? `:${c.bc_badge}` : ''}`);
    const calls = d.usage.filter(u => u.operation === 'anniversary_badge_check').length;
    return { n: poke.length, badge, flBadge, checked: checked.length, answers, calls };
  };
  const a = f(cur), b = f(prev);
  const list = (m: Map<string, unknown[]>) => [...m.entries()].map(([k, v]) => `${k} ${v.length}`).join(', ') || 'none';
  console.log(`  Pokemon grades: ${cmp(a.n, b.n)}`);
  console.log(`  printed_badge set (card_info): ${list(a.badge)}  (prev ${list(b.badge)}); first look saw a badge: ${cmp(a.flBadge, b.flBadge)}`);
  console.log(`  anniversary_badge_check calls logged: ${cmp(a.calls, b.calls)} (includes calls on cards graded earlier, e.g. sweeps)`);
  console.log(`  stored verdicts on this window's grades: ${a.checked} [${list(a.answers)}]  (prev ${b.checked} [${list(b.answers)}])`);
}

// ---------------------------------------------------------------- main
async function main() {
  const { cur, prev } = parseArgs();
  const t0 = Date.now();
  const curData = await load(cur);
  const prevData = await load(prev);
  console.log(`ACCURACY MONITOR  (read-only)  generated ${new Date().toISOString().slice(0, 16)}Z`);
  console.log(`  current : ${cur.label}`);
  console.log(`  previous: ${prev.label}`);
  console.log('  grades are counted by cards.created_at (re-grades of older cards are not in the window)');
  const cats = categories(curData, prevData);
  volume(curData, prevData, cats);
  distribution(curData, prevData, cats);
  structural(curData, prevData);
  nineHolds(curData, prevData);
  identity(curData, prevData);
  reviews(curData, prevData);
  photos(curData, prevData);
  spend(curData, prevData);
  anniversary(curData, prevData);
  console.log(`\n(loaded in ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}

main().catch(e => { console.error(`\nSTOPPED: ${e instanceof Error ? e.message : e}`); process.exit(1); });
