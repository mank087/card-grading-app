/**
 * One-off correction for customer drwhitaker63's two Mana Vaults (Sept 28).
 * DRY RUN BY DEFAULT. Nothing is written without --apply. Run AFTER the fixed
 * estimator (src/lib/pricing/gradedValueEstimate.ts) is deployed.
 *
 *   npx tsx scripts/_tmp-fix-whitaker-mana-vault.ts                                   # dry run
 *   npx tsx scripts/_tmp-fix-whitaker-mana-vault.ts --apply --actor=<admin user uuid> # write
 *
 * Card A 74aaf4da (serial 903818, grade 10): stored as Ultimate Masters #229
 * non-foil, priced off PSA comps that sit BELOW raw ($93.97 for a 10). The card is
 * the Ultimate Box Topper U29 foil (the same printing as card B). Identity goes
 * through saveCardIdentity (clears the stale price columns, bumps
 * identity_revision, writes history). The identity_catalog_invalidation trigger
 * then clears the catalog link, so the MTG link columns are written right after,
 * guarded on the new revision. Then the owner-style product pick 2201998.
 *
 * Card B b00f3ad5 (serial 311587, grade 8): identity already right; priced at
 * raw × 3 = $821.67 (above its own PSA 10). Repriced only.
 *
 * Both: repriced from PriceCharting product 2201998 with estimateMTGDcmValue,
 * revision-guarded like the batch refresh, then label_data regenerated.
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { buildIdentityPatch, saveCardIdentity } from '../src/lib/identity/saveCardIdentity';
import { getMTGPricesForProductId, estimateMTGDcmValue } from '../src/lib/mtgPricing';
import { guardedPriceUpdate, readPriceRevisions } from '../src/lib/pricing/guardedPriceWrite';
import { generateLabelData, type CardForLabel } from '../src/lib/labelDataGenerator';

const APPLY = process.argv.includes('--apply');
const ACTOR = process.argv.find(a => a.startsWith('--actor='))?.split('=')[1] ?? null;

const OWNER_ID = 'a1d32d29-93e5-42e4-8141-da25c768b356';
const CARD_A = '74aaf4da-80dd-44bc-b8f0-75e5403d76fb'; // serial 903818, grade 10
const CARD_B = 'b00f3ad5-637d-4fda-947d-d9035d53a11f'; // serial 311587, grade 8
const MTG_CARD_ID = '16951cdd-7367-46c7-b915-93d4ed656918'; // Scryfall: Mana Vault, puma U29
const PRODUCT_ID = '2201998';
const PRODUCT_NAME = 'Mana Vault (Ultimate Box Topper)';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function parseInfo(raw: unknown): Record<string, any> {
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {}; } }
  return raw && typeof raw === 'object' ? { ...(raw as Record<string, any>) } : {};
}

/** Identity edit for card A, in the owner editor's field names. */
const IDENTITY_BODY = {
  card_set: 'Ultimate Box Topper',
  card_number: 'U29',
  is_foil: true,
  rarity_description: 'mythic',
  mtg_set_code: 'puma',
};

async function loadCard(id: string) {
  // One row by exact id. select('*') because generateLabelData needs the grade,
  // autograph and card-info columns (same as the admin review route).
  const { data, error } = await db.from('cards').select('*').eq('id', id).single();
  if (error || !data) throw error ?? Error(`card ${id} not found`);
  const row = data as Record<string, any>;
  if (row.user_id !== OWNER_ID) throw Error(`card ${id}: owner mismatch; stop`);
  if (row.deleted_at) throw Error(`card ${id}: deleted; stop`);
  if (row.ownership_status === 'sold') throw Error(`card ${id}: sold (record locked); stop`);
  if (row.category !== 'MTG') throw Error(`card ${id}: category ${row.category}; stop`);
  return row;
}

/** Catalog link + MTG detail columns/JSON the identity service does not own. */
function catalogPatch(ref: Record<string, any>, card: Record<string, any>, info: Record<string, any>) {
  const reference = ref.image_normal || ref.image_large || null;
  const columns: Record<string, any> = {
    mtg_card_id: ref.id,
    mtg_reference_image: reference,
    mtg_database_match_confidence: 'high',
    validated_source: 'mtg_cards',
    validation_tier: 'exact',
    validation_confidence: 'high',
    expansion_code: ref.set_code,
    collector_number: ref.collector_number,
    is_promo: !!ref.promo,
  };
  // Only write columns this table actually has.
  for (const k of Object.keys(columns)) if (!(k in card)) delete columns[k];
  const newInfo = {
    ...info,
    set_name: ref.set_name,
    set_code: String(ref.set_code).toUpperCase(),
    expansion_code: ref.set_code,
    card_number: ref.collector_number,
    card_number_raw: ref.collector_number,
    collector_number: ref.collector_number,
    is_foil: true,
    rarity_or_variant: ref.rarity,
    rarity_description: ref.rarity,
    mtg_database_id: ref.id,
    mtg_database_oracle_id: ref.oracle_id ?? null,
    mtg_database_match_confidence: 'high',
    mtg_reference_image: reference,
    manual_details_correction: { ref: 'owner-fix-2026-09-28-whitaker-mana-vault', note: 'Was Ultimate Masters #229 non-foil; the card is the Ultimate Box Topper U29 foil.' },
  };
  return { columns, info: newInfo };
}

async function main() {
  console.log(APPLY ? '*** APPLY MODE ***' : '(dry run — pass --apply to write)');
  if (APPLY && ACTOR && !/^[0-9a-f-]{36}$/i.test(ACTOR)) throw Error('--actor must be a user uuid');

  const [a, b] = [await loadCard(CARD_A), await loadCard(CARD_B)];
  if (a.serial !== '903818' || b.serial !== '311587') throw Error('serial mismatch; stop');

  const { data: ref, error: refError } = await db.from('mtg_cards')
    .select('id, oracle_id, name, set_code, set_name, collector_number, rarity, promo, image_normal, image_large')
    .eq('id', MTG_CARD_ID).single();
  if (refError || !ref) throw refError ?? Error('mtg_cards row not found');
  console.log(`catalog: ${ref.name} | ${ref.set_name} (${ref.set_code}) #${ref.collector_number} | ${ref.rarity}`);

  // ---- prices (read-only call, same in dry run) --------------------------
  const prices = await getMTGPricesForProductId(PRODUCT_ID);
  if (!prices) throw Error(`no PriceCharting prices for product ${PRODUCT_ID}; stop`);
  console.log(`product ${PRODUCT_ID}: ${prices.productName} | ${prices.setName} | raw ${prices.raw} | psa ${JSON.stringify(prices.psa)}`);

  const gradeOf = (row: Record<string, any>) => Number(row.conversational_whole_grade ?? row.conversational_decimal_grade);
  const estA = estimateMTGDcmValue(prices, gradeOf(a));
  const estB = estimateMTGDcmValue(prices, gradeOf(b));

  // ---- card A identity -----------------------------------------------------
  const alreadyFixed = a.card_set === 'Ultimate Box Topper' && String(a.card_number) === 'U29' && a.is_foil === true;
  const patch = buildIdentityPatch(IDENTITY_BODY, a);
  const { columns: linkCols, info: linkInfo } = catalogPatch(ref, a, { ...parseInfo(a.conversational_card_info), ...(patch.cardInfo ?? {}) });
  const simulatedA = { ...a, ...patch.columnPatch, ...linkCols, conversational_card_info: linkInfo };

  console.log('\n[A] before:', { card_set: a.card_set, card_number: a.card_number, is_foil: a.is_foil, mtg_card_id: a.mtg_card_id, dcm_price_estimate: a.dcm_price_estimate, dcm_price_product_id: a.dcm_price_product_id, label: a.label_data?.contextLine });
  console.log('[A] identity changes:', alreadyFixed ? '(already fixed, skipped)' : patch.changedFields, '| material:', patch.material);
  console.log('[A] link columns:', linkCols);
  console.log('[A] after: grade', gradeOf(a), '→ estimate', estA, '| label:', generateLabelData(simulatedA as unknown as CardForLabel).contextLine);
  console.log('\n[B] before:', { dcm_price_estimate: b.dcm_price_estimate, dcm_price_product_id: b.dcm_price_product_id, label: b.label_data?.contextLine });
  console.log('[B] after: grade', gradeOf(b), '→ estimate', estB, '| label:', generateLabelData(b as unknown as CardForLabel).contextLine);
  if (String(b.label_data?.cardNumber ?? '').startsWith('129')) {
    console.log('[B] note: label shows the misread number', b.label_data?.cardNumber, '(card_number column is U29). Not changed here.');
  }

  if (!APPLY) { console.log('\nDry run complete. Nothing written.'); return; }

  // ---- apply: A identity ---------------------------------------------------
  if (!alreadyFixed) {
    const result = await saveCardIdentity(db, {
      cardId: CARD_A, card: a, body: IDENTITY_BODY,
      actorId: ACTOR ?? OWNER_ID, actorRole: ACTOR ? 'admin' : 'system',
      confirm: true, expectedRevision: a.identity_revision ?? null,
    });
    console.log('[A] saveCardIdentity:', result);
    if (result.status !== 'saved') throw Error('[A] identity save failed; stop');
  }

  // Re-read (narrow) and write the catalog link on the new revision.
  const { data: a2, error: a2Err } = await db.from('cards')
    .select('id, identity_revision, pricing_selection_revision, conversational_card_info')
    .eq('id', CARD_A).single();
  if (a2Err || !a2) throw a2Err ?? Error('[A] re-read failed');
  const { columns: cols2, info: info2 } = catalogPatch(ref, a, parseInfo(a2.conversational_card_info));
  const { data: linked, error: linkErr } = await db.from('cards')
    .update({ ...cols2, conversational_card_info: info2 })
    .eq('id', CARD_A).eq('identity_revision', a2.identity_revision).select('id');
  if (linkErr) throw linkErr;
  if (!linked?.length) throw Error('[A] identity moved during the fix; link not written; stop');
  console.log('[A] catalog link written.');

  // Product pick (mirrors /api/pricing/dcm-select: CAS on pricing_selection_revision).
  const expectedSel = a2.pricing_selection_revision ?? 0;
  const { data: picked, error: pickErr } = await db.from('cards').update({
    dcm_selected_product_id: PRODUCT_ID,
    dcm_selected_product_name: PRODUCT_NAME,
    dcm_selected_at: new Date().toISOString(),
    pricing_selection_revision: expectedSel + 1,
  }).eq('id', CARD_A).eq('pricing_selection_revision', expectedSel).select('id');
  if (pickErr) throw pickErr;
  if (!picked?.length) throw Error('[A] selection moved during the fix; stop');
  console.log('[A] product pick saved.');

  // ---- apply: prices + labels for both ------------------------------------
  for (const id of [CARD_A, CARD_B]) {
    const { data: rev, error: revErr } = await db.from('cards')
      .select('id, conversational_whole_grade, conversational_decimal_grade, identity_revision, pricing_selection_revision')
      .eq('id', id).single();
    if (revErr || !rev) throw revErr ?? Error(`re-read ${id} failed`);
    const estimate = estimateMTGDcmValue(prices, gradeOf(rev));
    const now = new Date().toISOString();
    const write = await guardedPriceUpdate(db, id, readPriceRevisions(rev), {
      dcm_cached_prices: { prices, estimatedValue: estimate, matchConfidence: 'high', queryUsed: `Product ID: ${PRODUCT_ID}` },
      dcm_prices_cached_at: now,
      dcm_price_estimate: estimate,
      dcm_price_raw: prices.raw ?? null,
      dcm_price_graded_high: prices.psa?.['10'] ?? null,
      dcm_price_updated_at: now,
      dcm_price_match_confidence: 'high',
      dcm_price_product_id: prices.productId || PRODUCT_ID,
      dcm_price_product_name: prices.productName || PRODUCT_NAME,
    }, 'WhitakerFix');
    console.log(`[${id.slice(0, 8)}] price write: ${write.status} → ${estimate}`);
    if (write.status === 'stale' || write.status === 'error') throw Error('price write failed; stop');

    const full = await loadCard(id);
    const label = generateLabelData(full as unknown as CardForLabel);
    const labelCols: Record<string, any> = { label_data: label };
    if (full.original_label_data != null) labelCols.original_label_data = label;
    const { error: labelErr } = await db.from('cards').update(labelCols).eq('id', id);
    if (labelErr) throw labelErr;
    console.log(`[${id.slice(0, 8)}] label_data: ${label.contextLine}`);
  }
  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
