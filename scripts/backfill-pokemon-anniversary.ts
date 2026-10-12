/**
 * Backfill: Pokémon anniversary reprints saved as the ORIGINAL printing, and
 * Trick or Trade set-name normalization (Oct 2026).
 *
 * SECTION A — anniversary badge. The 30th Celebration Classic Collection
 * (me55c) and Celebrations Classic Collection (cel25c) reprints keep the
 * original number and copyright line, so cards were saved as 1999 Base,
 * Aquapolis, Paldea Evolved... A suspect is a Pokémon card, not deleted, whose
 * name + printed number match a me55/me55c card (graded since 2026-09-16) or a
 * cel25/cel25c card (graded since 2021-10-08) but is saved as another set. Each
 * suspect's front photo (the display copy when there is one) gets ONE badge
 * question (identification/anniversaryBadgeCheck.ts). Only the badge decides:
 * people do grade real 1999 Charizards.
 *   - 2026 window: any name + numerator hit is checked (incl. other denominators);
 *     before it, only exact printed-number twins of cel25/cel25c are checked.
 *   - only a CERTAIN kind is written (resolveBadgeKind: one possible anniversary, or the
 *     sparkle border for Charizard 4/102); an uncertain digit read is listed, not written.
 *   - owner-confirmed cards are skipped unless their saved set is still the
 *     original; those are listed separately and only written with APPLY_CONFIRMED=1.
 *
 * SECTION B — Trick or Trade. Lists every card whose set says Trick or Trade
 * (or the "Trick of Treat" typo) and the ONE canonical value it would get
 * ("Trick or Trade <bundle year>", pokemonTrickOrTrade.ts). No vision calls.
 * "Trick or Treat Cards" rows are listed but never changed (not this product).
 *
 * Writes go exactly the way an owner correction does: saveCardIdentity (admin
 * actor) → verifyAndSavePokemonCard link-only → rebuildLabels → refreshCardPrice.
 *
 *   npx tsx --env-file=../../.env.local scripts/backfill-pokemon-anniversary.ts            # dry run (A + B)
 *   ONLY=tot npx tsx ...                                                                   # B only, no OpenAI calls
 *   APPLY=1 npx tsx ...                                                                    # write A "yes" verdicts + B
 *   LIMIT=5 / ONLY=anniv / APPLY_CONFIRMED=1
 *
 * Production-DB rules: light columns only, keyset pages of 250 by id, one
 * full row read per card actually written, stop on 522/timeouts.
 */
import { createClient } from '@supabase/supabase-js';
import { namesAgree } from '../src/lib/identity/nameAgreement';
import { samePrintedFraction, loadFrontPhoto, resolveBadgeKind } from '../src/lib/identity/anniversaryBadgeNet';
import { checkAnniversaryBadge, type BadgeCheckResult } from '../src/lib/identification/anniversaryBadgeCheck';
import { pokemonPrintedNumber, ANNIVERSARY_SET_IDS, badgeOfSetId, type AnniversaryBadge } from '../src/lib/pokemonAnniversary';
import { verifyPokemonCard } from '../src/lib/pokemonApiVerification';
import { isTrickOrTradeSetName, trickOrTradeIdentity } from '../src/lib/pokemonTrickOrTrade';
import { saveCardIdentity } from '../src/lib/identity/saveCardIdentity';
import { verifyAndSavePokemonCard, rebuildLabels } from '../src/lib/identity/pokemonCatalogLink';
import { REFRESH_CARD_SELECT, parseCardInfo, classifyCategory, refreshCardPrice } from '../src/lib/pricing/batchPriceRefresh';

const APPLY = process.env.APPLY === '1';
const APPLY_CONFIRMED = process.env.APPLY_CONFIRMED === '1';
const ONLY = process.env.ONLY || '';
const LIMIT = Number(process.env.LIMIT || 0) || Infinity;
const ACTOR_ID = '4740b08b-a979-45f4-a23a-1f6736c3480d';
const PAGE = 250;
const SINCE_30 = '2026-09-16';
const SINCE_25 = '2021-10-08';
// gpt-5.6-luna per-million rates (apiUsageLogger.ts)
const RATE_IN = 0.20, RATE_OUT = 1.20;

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

interface Row {
  id: string; serial: string | null; card_name: string | null; featured: string | null; card_set: string | null;
  card_number: string | null; release_date: string | null; pokemon_api_id: string | null; created_at: string;
  identity_revision: number | null; identity_confirmed_revision: number | null;
}
interface AnnCard { id: string; name: string; set_id: string; set_name: string; year: string; printed: string }

const LIGHT = 'id, serial, card_name, featured, card_set, card_number, release_date, pokemon_api_id, created_at, identity_revision, identity_confirmed_revision';
const CJK = /[぀-ヿ一-鿿가-힯]/;
const numerator = (v: unknown) => String(v ?? '').trim().replace(/^#/, '').split('/')[0].trim().toUpperCase().replace(/^0+(?=\d)/, '');
const pad = (v: unknown, n: number) => String(v ?? '').slice(0, n).padEnd(n);

async function withRetry<T>(label: string, fn: () => PromiseLike<{ data: T | null; error: any }>): Promise<T> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const { data, error } = await fn();
    if (!error) return data as T;
    console.warn(`${label}: ${error.message}`);
    if (/522|timeout/i.test(error.message) && attempt >= 2) throw error;
    await new Promise(r => setTimeout(r, 1500 * attempt));
  }
  throw new Error(`${label}: failed 4 times`);
}

async function loadAnniversaryCards(): Promise<AnnCard[]> {
  const rows = await withRetry<any[]>('catalog', () => db.from('pokemon_cards')
    .select('id, name, number, set_id, set_name, set_printed_total, set_release_date').in('set_id', [...ANNIVERSARY_SET_IDS]).limit(1000));
  return rows.map(r => ({
    id: r.id, name: r.name, set_id: r.set_id, set_name: r.set_name, year: String(r.set_release_date || '').slice(0, 4),
    printed: pokemonPrintedNumber(r.id, String(r.number), r.set_printed_total || 0),
  }));
}

async function scanPokemon(since: string, onRow: (r: Row) => void): Promise<number> {
  let afterId = '';
  let n = 0;
  for (;;) {
    const rows = await withRetry<Row[]>('cards page', () => {
      let q = db.from('cards').select(LIGHT).eq('category', 'Pokemon').is('deleted_at', null).gte('created_at', since)
        .order('id', { ascending: true }).limit(PAGE);
      if (afterId) q = q.gt('id', afterId);
      return q;
    });
    if (!rows.length) return n;
    rows.forEach(onRow);
    n += rows.length;
    afterId = rows[rows.length - 1].id;
  }
}

const isAnniversarySaved = (r: Row) =>
  ANNIVERSARY_SET_IDS.some(s => String(r.pokemon_api_id || '').startsWith(`${s}-`)) || /30th|celebrations/i.test(r.card_set || '');

interface Suspect { row: Row; hits: AnnCard[]; strict: boolean; confirmed: boolean }

async function findSuspects(catalog: AnnCard[]): Promise<{ suspects: Suspect[]; scanned: number; nonEnglish: Row[] }> {
  const suspects: Suspect[] = [];
  const nonEnglish: Row[] = [];
  const consider = (r: Row) => {
    if (isAnniversarySaved(r)) return;
    const name = r.featured || r.card_name || '';
    if (!name || !r.card_number) return;
    const in30 = r.created_at >= SINCE_30;
    const hits = catalog.filter(c => {
      const thirty = c.set_id.startsWith('me55');
      if (thirty && !in30) return false;
      if (numerator(c.printed) !== numerator(r.card_number)) return false;
      if (!namesAgree(name.replace(/\s*\(.*\)\s*$/, ''), c.name).agrees && !namesAgree(name, c.name).agrees) return false;
      // Before the 30th window only exact twins are worth a question.
      return in30 || (String(r.card_number).includes('/') && c.printed.includes('/') && samePrintedFraction(r.card_number, c.printed));
    });
    if (!hits.length) return;
    if (CJK.test(name)) { if (in30) nonEnglish.push(r); return; }
    const strict = hits.some(c => samePrintedFraction(r.card_number, c.printed));
    suspects.push({ row: r, hits, strict, confirmed: r.identity_confirmed_revision != null });
  };
  const scanned = await scanPokemon(SINCE_25, consider);
  suspects.sort((a, b) => a.row.created_at.localeCompare(b.row.created_at));
  return { suspects, scanned, nonEnglish };
}

async function propose(s: Suspect, badge: '30' | '25'): Promise<{ id: string | null; set: string | null; year: string | null; error?: string }> {
  const name = s.row.featured || s.row.card_name || '';
  const r = await verifyPokemonCard({ card_name: name, player_or_character: name, card_number: s.row.card_number || '', card_number_raw: s.row.card_number || '', year: s.row.release_date || '', printed_badge: badge });
  if (!r.success || !r.pokemon_api_data) return { id: null, set: null, year: null, error: r.error || 'no match' };
  return { id: r.pokemon_api_data.id, set: r.pokemon_api_data.set.name, year: r.pokemon_api_data.set.releaseDate?.slice(0, 4) || null };
}

async function readFull(id: string): Promise<Record<string, any>> {
  return withRetry<Record<string, any>>('card row', () => db.from('cards').select('*').eq('id', id).single());
}

async function writeIdentity(id: string, body: Record<string, any>, confirm: boolean): Promise<string> {
  const card = await readFull(id);
  const saved = await saveCardIdentity(db, {
    cardId: id, card, actorId: ACTOR_ID, actorRole: 'admin', body, confirm, dismiss: false, expectedRevision: card.identity_revision,
  });
  if (saved.status !== 'saved') return `identity ${saved.status}${saved.error ? `: ${saved.error}` : ''}`;
  const link = await verifyAndSavePokemonCard(db, id, { force: true, linkOnly: true, trigger: 'owner-edit' });
  await rebuildLabels(db, id, '[backfill-anniversary]');
  const priced = await withRetry<Record<string, any>>('price row', () => db.from('cards').select(REFRESH_CARD_SELECT).eq('id', id).single());
  const info = parseCardInfo(priced);
  let price = 'no card info';
  if (info) {
    const r = await refreshCardPrice(priced, info, classifyCategory(String(priced.category)), Number(priced.conversational_decimal_grade) || 8);
    price = `${r.source} ${r.estimate ?? '-'}`;
  }
  return `saved rev ${saved.identityRevision}; link ${link.body?.success ? link.body.pokemon_api_id : 'cleared'}; price ${price}`;
}

async function sectionAnniversary() {
  const catalog = await loadAnniversaryCards();
  const { suspects, scanned, nonEnglish } = await findSuspects(catalog);
  const checked = suspects.slice(0, LIMIT); // anniversary-saved cards never become suspects
  console.log(`\n=== A. Anniversary badge — scanned ${scanned} Pokémon cards since ${SINCE_25}; ${suspects.length} suspects (${suspects.filter(s => s.strict).length} exact printed twins); ${nonEnglish.length} non-English skipped ===`);
  console.log('    (Japanese/Korean/Chinese 30th cards have no catalog set; listed at the end, not checked.)\n');

  const results: Array<{ s: Suspect; check: BadgeCheckResult | null; kind?: { badge: AnniversaryBadge; certain: boolean } | null; proposal?: Awaited<ReturnType<typeof propose>>; applied?: string }> = [];
  let tokIn = 0, tokOut = 0;
  const queue = [...checked];
  const worker = async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      const front = await loadFrontPhoto(db, s.row.id);
      const check = front ? await checkAnniversaryBadge(front, { cardId: s.row.id }) : null;
      if (check) { tokIn += check.tokens.in; tokOut += check.tokens.out; }
      const entry: (typeof results)[number] = { s, check };
      // Same rule as the live net: presence + the candidates' kinds (+ the sparkle border) decide, not the tiny digits.
      entry.kind = check ? resolveBadgeKind(check, s.hits.map(h => badgeOfSetId(h.set_id)).filter((b): b is AnniversaryBadge => !!b)) : null;
      if (entry.kind) entry.proposal = await propose(s, entry.kind.badge);
      results.push(entry);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  results.sort((a, b) => a.s.row.created_at.localeCompare(b.s.row.created_at));

  const header = `${pad('serial', 7)} ${pad('card', 26)} ${pad('number', 8)} ${pad('current set', 30)} ${pad('twin', 6)} ${pad('verdict', 30)} ${pad('where', 34)} proposed`;
  const print = (list: typeof results) => {
    console.log(header);
    for (const r of list) {
      const v = r.check ? `${r.check.answer}${r.kind ? ` ${r.kind.badge}${r.kind.certain ? '' : '?'}` : ''}${r.check.answer === 'yes' ? ` (read ${r.check.badge ?? '-'}, ${r.check.sparkle_border === true ? 'sparkle' : r.check.sparkle_border === false ? 'plain' : '?'})` : ''}` : 'NO ANSWER';
      const p = r.proposal ? (r.proposal.id ? `${r.proposal.id} (${r.proposal.set})` : `- ${r.proposal.error}`) : '';
      console.log(`${pad(r.s.row.serial, 7)} ${pad(r.s.row.featured || r.s.row.card_name, 26)} ${pad(r.s.row.card_number, 8)} ${pad(r.s.row.card_set || '(blank)', 30)} ${pad(r.s.strict ? 'exact' : 'num', 6)} ${pad(v, 30)} ${pad(r.check?.where || '', 34)} ${p}${r.applied ? `  → ${r.applied}` : ''}`);
    }
  };

  if (APPLY) {
    for (const r of results) {
      if (r.check?.answer !== 'yes' || !r.kind?.certain || !r.proposal?.id || !r.proposal.set) continue;
      if (r.s.confirmed && !APPLY_CONFIRMED) { r.applied = 'skipped (owner-confirmed)'; continue; }
      try {
        r.applied = await writeIdentity(r.s.row.id, { card_set: r.proposal.set, release_date: r.proposal.year }, false);
      } catch (e: any) {
        r.applied = `FAILED ${e?.message || e}`;
        if (/522|timeout/i.test(String(e?.message))) break;
      }
    }
  }

  const open = results.filter(r => !r.s.confirmed);
  const confirmed = results.filter(r => r.s.confirmed);
  print(open);
  console.log(`\n--- owner-confirmed, saved set still the original (${confirmed.length}; written only with APPLY_CONFIRMED=1) ---`);
  print(confirmed);
  if (nonEnglish.length) {
    console.log(`\n--- non-English, not checked (${nonEnglish.length}) ---`);
    nonEnglish.forEach(r => console.log(`${pad(r.serial, 7)} ${pad(r.featured || r.card_name, 26)} ${pad(r.card_number, 8)} ${r.card_set || '(blank)'}`));
  }
  const count = (a: string) => results.filter(r => r.check?.answer === a).length;
  const cost = (tokIn / 1e6) * RATE_IN + (tokOut / 1e6) * RATE_OUT;
  console.log(`\nVerdicts: yes ${count('yes')} | no ${count('no')} | unclear ${count('unclear')} | no answer ${results.filter(r => !r.check).length} — of ${results.length} checked`);
  console.log(`Tokens ${tokIn} in / ${tokOut} out ≈ $${cost.toFixed(4)} (gpt-5.6-luna list rates)`);
}

async function sectionTrickOrTrade() {
  const rows = await withRetry<any[]>('trick rows', () => db.from('cards')
    .select(`${LIGHT}, ci_set:conversational_card_info->>set_name`)
    .eq('category', 'Pokemon').is('deleted_at', null)
    .ilike('card_set', '%trick%').limit(500)); // a JSON-path filter here timed out on the full table
  const ids = [...new Set(rows.map(r => r.pokemon_api_id).filter(Boolean))];
  const years = new Map<string, string>();
  if (ids.length) {
    const cat = await withRetry<any[]>('catalog years', () => db.from('pokemon_cards').select('id, set_release_date').in('id', ids));
    cat.forEach(c => years.set(c.id, String(c.set_release_date || '').slice(0, 4)));
  }
  console.log(`\n=== B. Trick or Trade — ${rows.length} cards whose set mentions "trick" ===`);
  console.log(`${pad('serial', 7)} ${pad('card', 18)} ${pad('number', 8)} ${pad('catalog', 11)} ${pad('current card_set', 30)} ${pad('year', 5)} ${pad('confirmed', 9)} proposed`);
  let changed = 0;
  for (const r of rows as Array<Row & { ci_set: string | null }>) {
    const set = r.card_set || r.ci_set;
    const isTot = isTrickOrTradeSetName(set);
    const name = r.featured || r.card_name || '';
    const stamp = isTot ? trickOrTradeIdentity({ player_or_character: name, card_number: r.card_number, set_name: set }, years.get(r.pokemon_api_id || '')) : null;
    const body: Record<string, any> = {};
    if (stamp && stamp.set_name !== r.card_set) body.card_set = stamp.set_name;
    if (stamp?.year && stamp.year !== r.release_date) body.release_date = stamp.year;
    let note = !isTot ? 'not Trick or Trade (left alone; owner to review)' : Object.keys(body).length ? `${stamp!.set_name}${stamp!.year ? ` / ${stamp!.year}` : ' (year unknown)'}` : 'already canonical';
    if (APPLY && isTot && Object.keys(body).length) {
      try {
        note += `  → ${await writeIdentity(r.id, body, r.identity_confirmed_revision != null && Number(r.identity_confirmed_revision) >= Number(r.identity_revision ?? 0))}`;
      } catch (e: any) { note += `  → FAILED ${e?.message || e}`; }
    }
    if (isTot && Object.keys(body).length) changed++;
    console.log(`${pad(r.serial, 7)} ${pad(name, 18)} ${pad(r.card_number, 8)} ${pad(r.pokemon_api_id || '-', 11)} ${pad(set, 30)} ${pad(r.release_date, 5)} ${pad(r.identity_confirmed_revision != null ? 'yes' : '', 9)} ${note}`);
  }
  console.log(`\n${changed} would change${APPLY ? ' (written above)' : ''}.`);
}

async function main() {
  console.log(APPLY ? `APPLY${APPLY_CONFIRMED ? ' (incl. owner-confirmed)' : ''}` : 'DRY RUN — nothing is written');
  if (ONLY !== 'tot') await sectionAnniversary();
  if (ONLY !== 'anniv') await sectionTrickOrTrade();
  if (!APPLY) console.log('\nDry run only. APPLY=1 writes section A "yes" verdicts and section B normalizations.');
}

main().catch(e => { console.error(e); process.exit(1); });
