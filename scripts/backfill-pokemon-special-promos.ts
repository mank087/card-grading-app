/**
 * Backfill: Pokémon one-off special promos (Oct 2026), starting with Ancient Mew.
 *
 * Ancient Mew (Pokémon the Movie 2000 promo) has no catalog row and no number.
 * Production held ~37 of them with card_set null or four different promo
 * spellings, the year all over (1999 / 2000 / "1999-2000" / null), and prices
 * matched to the wrong product ("Mew ex #232" $864-2,438 on 13 cards). Each
 * card found here gets the ONE canonical identity and the PriceCharting pin from
 * src/lib/pokemonSpecialPromos.ts.
 *
 * Finds: Pokémon cards, not deleted, whose card_name / featured / pokemon_featured
 * names an entry, then confirms each with matchSpecialPromo().
 *
 * Writes (APPLY=1), per card, the way an owner correction does:
 *   saveCardIdentity (admin actor; card_name, featured, card_set, card_number '', release_date)
 *   → conversational_card_info.player_or_character / special_promo + pokemon_featured
 *   → dcm_selected_product_id/name by language (stale prices cleared, selection revision bumped)
 *   → verifyAndSavePokemonCard link-only (clears the wrong catalog link)
 *   → rebuildLabels → refreshCardPrice.
 * Skipped: owner-confirmed cards (listed separately), cards already canonical and pinned.
 *
 *   npx tsx --env-file=../../.env.local scripts/backfill-pokemon-special-promos.ts   # dry run
 *   APPLY=1 npx tsx --env-file=../../.env.local scripts/backfill-pokemon-special-promos.ts
 *
 * Production-DB rules: light columns only (JSON paths, never whole blobs in the
 * scan), pages of 500 at most, one full row read per card actually written.
 */
import { createClient } from '@supabase/supabase-js';
import {
  SPECIAL_PROMOS, matchSpecialPromo, specialPromoProduct, isCanonicalSpecialPromo, type SpecialPromoMatch,
} from '../src/lib/pokemonSpecialPromos';
import { saveCardIdentity, PRICING_INVALIDATION_COLUMNS } from '../src/lib/identity/saveCardIdentity';
import { verifyAndSavePokemonCard, rebuildLabels } from '../src/lib/identity/pokemonCatalogLink';
import { REFRESH_CARD_SELECT, parseCardInfo, classifyCategory, refreshCardPrice } from '../src/lib/pricing/batchPriceRefresh';

const APPLY = process.env.APPLY === '1';
const ACTOR_ID = '4740b08b-a979-45f4-a23a-1f6736c3480d';
const PAGE = 500;

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const LIGHT = [
  'id', 'serial', 'card_name', 'featured', 'pokemon_featured', 'card_set', 'card_number', 'release_date', 'language',
  'identity_revision', 'identity_confirmed_revision', 'dcm_selected_product_id', 'dcm_selected_product_name',
  'dcm_price_product_id', 'dcm_price_product_name', 'dcm_price_estimate', 'pokemon_api_id',
  'ci_player:conversational_card_info->>player_or_character',
  'ci_front:conversational_card_info->>card_front_text',
  'ci_yts:conversational_card_info->>year_text_seen',
  'ci_man:conversational_card_info->>manufacturer',
  'ci_lang:conversational_card_info->>language',
].join(', ');

type Row = Record<string, any>;
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

/** ilike patterns from an entry's names: "ancient mew" → "%ancient%mew%". */
const ILIKE = ['%ancient%mew%', '%古代%ミュウ%'];

async function findRows(): Promise<Row[]> {
  const byId = new Map<string, Row>();
  for (const pat of ILIKE) {
    for (let from = 0; ; from += PAGE) {
      const rows = await withRetry<Row[]>('cards', () => db.from('cards').select(LIGHT)
        .eq('category', 'Pokemon').is('deleted_at', null)
        .or(`card_name.ilike.${pat},featured.ilike.${pat},pokemon_featured.ilike.${pat}`)
        .order('id', { ascending: true }).range(from, from + PAGE - 1));
      rows.forEach(r => byId.set(r.id, r));
      if (rows.length < PAGE) break;
    }
  }
  // No conversational_card_info->>player_or_character filter: on the full table it hits the
  // statement timeout (tried Oct 13 2026). A card whose card_name/featured never says
  // Ancient Mew is caught at its next grade or verify instead.
  return [...byId.values()];
}

function infoOf(r: Row): Row {
  return {
    card_name: r.card_name, featured: r.featured, pokemon_featured: r.pokemon_featured, player_or_character: r.ci_player,
    card_front_text: r.ci_front, year_text_seen: r.ci_yts, manufacturer: r.ci_man, language: r.language || r.ci_lang,
    card_number: r.card_number, set_name: r.card_set,
  };
}

const confirmedOf = (r: Row) => r.identity_confirmed_revision !== null && r.identity_confirmed_revision !== undefined;

async function apply(r: Row, m: SpecialPromoMatch): Promise<string> {
  const c = m.promo.canonical;
  const product = specialPromoProduct(m, infoOf(r));
  const card = await withRetry<Row>('card row', () => db.from('cards').select('*').eq('id', r.id).single());
  const body: Record<string, any> = {
    card_name: c.card_name, featured: c.featured, card_set: c.card_set, card_number: '', release_date: c.release_date,
  };
  const saved = await saveCardIdentity(db, {
    cardId: r.id, card, actorId: ACTOR_ID, actorRole: 'admin', body, confirm: false, dismiss: false, expectedRevision: card.identity_revision,
  });
  if (saved.status !== 'saved' && !(saved.status === 'invalid' && /No changes/.test(saved.error || ''))) {
    return `identity ${saved.status}${saved.error ? `: ${saved.error}` : ''}`;
  }

  // Card info + pin, one write.
  const fresh = await withRetry<Row>('card info', () => db.from('cards')
    .select('conversational_card_info, pricing_selection_revision, dcm_selected_product_id').eq('id', r.id).single());
  const info = { ...(fresh.conversational_card_info || {}), player_or_character: c.featured, special_promo: m.promo.id };
  const update: Record<string, any> = { conversational_card_info: info, pokemon_featured: c.featured };
  let pin = 'no pin for this language';
  if (product && fresh.dcm_selected_product_id !== product.productId) {
    for (const col of PRICING_INVALIDATION_COLUMNS) update[col] = null;
    update.dcm_selected_product_id = product.productId;
    update.dcm_selected_product_name = product.productName;
    update.dcm_selected_at = new Date().toISOString();
    update.pricing_selection_revision = (fresh.pricing_selection_revision ?? 0) + 1;
    pin = `pinned ${product.productId}`;
  } else if (product) pin = `pin already ${product.productId}`;
  let q = db.from('cards').update(update).eq('id', r.id);
  if ('pricing_selection_revision' in update) q = q.eq('pricing_selection_revision', fresh.pricing_selection_revision ?? 0);
  const { error } = await q;
  if (error) return `rev ${saved.identityRevision ?? '-'}; card info/pin FAILED ${error.message}`;

  const link = await verifyAndSavePokemonCard(db, r.id, { force: true, linkOnly: true, trigger: 'owner-edit' });
  await rebuildLabels(db, r.id, '[backfill-special-promos]');
  const priced = await withRetry<Row>('price row', () => db.from('cards').select(REFRESH_CARD_SELECT).eq('id', r.id).single());
  const pInfo = parseCardInfo(priced);
  let price = 'no card info';
  if (pInfo) {
    const res = await refreshCardPrice(priced, pInfo, classifyCategory(String(priced.category)), Number(priced.conversational_decimal_grade) || 8);
    price = `${res.source} ${res.estimate ?? '-'}`;
  }
  return `rev ${saved.identityRevision ?? '-'}; ${pin}; link ${link.body?.special_promo ? 'none (special promo)' : link.body?.pokemon_api_id || 'cleared'}; price ${price}`;
}

async function main() {
  console.log(APPLY ? 'APPLY' : 'DRY RUN — nothing is written');
  console.log(`Entries: ${SPECIAL_PROMOS.map(p => p.id).join(', ')}`);
  const rows = await findRows();
  type Item = { r: Row; m: SpecialPromoMatch | null; note?: string };
  const items: Item[] = rows.map(r => ({ r, m: matchSpecialPromo(infoOf(r)) }));
  items.sort((a, b) => String(a.r.serial).localeCompare(String(b.r.serial)));

  const header = `${pad('serial', 7)} ${pad('card_name', 22)} ${pad('featured', 14)} ${pad('current set', 28)} ${pad('year', 10)} ${pad('no.', 5)} ${pad('lang', 4)} ${pad('price product (est)', 34)} ${pad('pin', 8)} → proposed`;
  const line = (it: Item) => {
    const r = it.r;
    const product = it.m ? specialPromoProduct(it.m, infoOf(r)) : null;
    const priceNow = r.dcm_price_product_name ? `${r.dcm_price_product_name} (${r.dcm_price_estimate ?? '-'})` : '-';
    const proposed = it.m
      ? `${it.m.promo.canonical.card_set} / ${it.m.promo.canonical.release_date} / no number; pin ${product ? `${product.productId} ${product.productName} [${it.m.language}]` : `none [${it.m.language}]`}`
      : 'not a special promo (left alone)';
    return `${pad(r.serial, 7)} ${pad(r.card_name, 22)} ${pad(r.featured || r.ci_player, 14)} ${pad(r.card_set || '(null)', 28)} ${pad(r.release_date ?? '(null)', 10)} ${pad(r.card_number ?? '-', 5)} ${pad(it.m?.language ?? '', 4)} ${pad(priceNow, 34)} ${pad(r.dcm_selected_product_id || '-', 8)} ${proposed}${it.note ? `  → ${it.note}` : ''}`;
  };

  const todo: Item[] = [], confirmed: Item[] = [], done: Item[] = [], other: Item[] = [];
  for (const it of items) {
    if (!it.m) { other.push(it); continue; }
    const product = specialPromoProduct(it.m, infoOf(it.r));
    const pinned = !product || it.r.dcm_selected_product_id === product.productId;
    if (isCanonicalSpecialPromo(it.r, it.m.promo) && pinned) { it.note = 'already canonical'; done.push(it); continue; }
    if (confirmedOf(it.r)) { confirmed.push(it); continue; }
    todo.push(it);
  }

  if (APPLY) {
    for (const it of todo) {
      try { it.note = await apply(it.r, it.m!); } catch (e: any) {
        it.note = `FAILED ${e?.message || e}`;
        if (/522|timeout/i.test(String(e?.message))) break;
      }
    }
  }

  console.log(`\n=== To ${APPLY ? 'write' : 'change'} (${todo.length}) ===`);
  console.log(header);
  todo.forEach(it => console.log(line(it)));
  console.log(`\n--- owner-confirmed, NOT written (${confirmed.length}) ---`);
  confirmed.forEach(it => console.log(line(it)));
  console.log(`\n--- already canonical (${done.length}) ---`);
  done.forEach(it => console.log(line(it)));
  console.log(`\n--- name hit but not a special promo (${other.length}) ---`);
  other.forEach(it => console.log(line(it)));

  const wrongPrice = todo.filter(it => {
    const p = specialPromoProduct(it.m!, infoOf(it.r));
    return p && it.r.dcm_price_product_id && it.r.dcm_price_product_id !== p.productId;
  });
  const byLang = todo.reduce<Record<string, number>>((a, it) => { a[it.m!.language] = (a[it.m!.language] || 0) + 1; return a; }, {});
  console.log(`\nScanned ${rows.length} rows; ${todo.length} to change (${Object.entries(byLang).map(([k, v]) => `${k} ${v}`).join(', ')}), `
    + `${wrongPrice.length} currently priced on another product, ${confirmed.length} owner-confirmed skipped, ${done.length} already canonical.`);
  if (!APPLY) console.log('Dry run only. APPLY=1 writes.');
}

main().catch(e => { console.error(e); process.exit(1); });
