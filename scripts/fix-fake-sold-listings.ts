/**
 * One-off repair: eBay listing rows marked 'sold' that were never sold, and the
 * cards they dragged into users' Sold categories.
 *
 * Fingerprint (all four — any one alone is too loose):
 *   status = 'sold'  AND  sold_at IS NULL  AND  quantity_sold = 0
 *   AND last_synced_at IS NULL
 *
 * Every code path that legitimately marks a listing sold writes sold_at and a
 * non-zero quantity, and stamps last_synced_at. A row claiming a sale with no
 * date, no quantity and no sync has never been confirmed by eBay at all.
 *
 * Rows are moved to 'ended' — not deleted — because "this listing finished
 * without selling" is the honest state and keeps the history.
 *
 * A card is only reverted to 'owned' when it has NO other genuinely-sold
 * listing; a card that also sold for real stays sold.
 *
 * Deliberately does NOT set ownership_overridden_at: that marks a USER decision
 * and would stop a future genuine sale from auto-marking.
 *
 *   npx tsx scripts/fix-fake-sold-listings.ts          # dry run
 *   npx tsx scripts/fix-fake-sold-listings.ts --apply  # write
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const APPLY = process.argv.includes('--apply');

(async () => {
  const { data: bogus } = await s.from('ebay_listings')
    .select('id, user_id, card_id, listing_id')
    .eq('status', 'sold').is('sold_at', null).eq('quantity_sold', 0).is('last_synced_at', null);

  if (!bogus?.length) { console.log('nothing matches the fingerprint'); return; }
  console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} — ${bogus.length} bogus sold listings\n`);

  const cardIds = bogus.map(r => r.card_id).filter(Boolean);

  // Cards that ALSO have a genuine sale keep their sold status.
  const { data: genuine } = await s.from('ebay_listings')
    .select('card_id').eq('status', 'sold').not('sold_at', 'is', null).in('card_id', cardIds);
  const hasReal = new Set((genuine ?? []).map(g => g.card_id));

  const { data: cards } = await s.from('cards')
    .select('id, serial, card_name, user_id, ownership_status').in('id', cardIds);
  const byId = new Map((cards ?? []).map(c => [c.id, c]));

  const toRevert = (cards ?? []).filter(c => c.ownership_status === 'sold' && !hasReal.has(c.id));

  console.log('listings → ended:');
  for (const r of bogus) {
    const c = byId.get(r.card_id);
    console.log(`  ${String(c?.serial ?? '??').padEnd(8)} ${String(c?.card_name ?? '?').slice(0,26).padEnd(26)} ${r.listing_id}`);
  }
  console.log(`\ncards → owned (${toRevert.length}):`);
  toRevert.forEach(c => console.log(`  ${c.serial} ${c.card_name}  (user ${String(c.user_id).slice(0,8)})`));

  const keepSold = (cards ?? []).filter(c => hasReal.has(c.id));
  if (keepSold.length) {
    console.log(`\nleft SOLD — they also have a real sale (${keepSold.length}):`);
    keepSold.forEach(c => console.log(`  ${c.serial} ${c.card_name}`));
  }

  if (!APPLY) { console.log('\nre-run with --apply to write'); return; }

  let rowsFixed = 0, cardsFixed = 0;
  for (const r of bogus) {
    const { error } = await s.from('ebay_listings')
      .update({ status: 'ended', ended_at: null, last_synced_at: new Date().toISOString() })
      .eq('id', r.id);
    if (error) console.error(`  listing ${r.listing_id}: ${error.message}`); else rowsFixed++;
  }
  for (const c of toRevert) {
    const { error } = await s.from('cards')
      .update({
        ownership_status: 'owned',
        sold_at: null, sold_price: null, sold_channel: null, sold_note: null,
      })
      .eq('id', c.id).eq('ownership_status', 'sold');
    if (error) console.error(`  card ${c.serial}: ${error.message}`); else cardsFixed++;
  }
  console.log(`\nlistings corrected: ${rowsFixed}/${bogus.length}`);
  console.log(`cards returned to collections: ${cardsFixed}/${toRevert.length}`);
  console.log('\nNOTE: visibility was forced public when these were marked sold and is left');
  console.log('as-is — the prior value was not recorded, and flipping cards private could');
  console.log('hide ones the owner expects to be shared.');
})();
