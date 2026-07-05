/**
 * Bulk re-price all sports cards through the local-DB-backed path (WS one-off).
 *
 * Existing sports cards carry dcm_price_estimate values cached from the OLD
 * live-SportsCardsPro-API matcher (before the local DB existed). Those may have
 * matching errors the new matcher fixes (subset/insert, exact card number,
 * serial disambiguation). Re-pricing routes through fetchAndCacheDcmPrice →
 * searchSportsCardPrices, which is now local-DB-first (fast, no API rate limit).
 *
 * Idempotent + resumable: processes oldest dcm_price_updated_at first; safe to
 * re-run. Read-then-write only on the cards it prices; never touches the
 * immutable dcm_price_at_grading baseline.
 *
 * Usage: node --import tsx scripts/bulk-reprice-sports.ts [--limit=N]
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { fetchAndCacheDcmPrice, isSportsCardCategory } from '../src/lib/pricing/dcmPriceTracker';

const LIMIT = parseInt((process.argv.find(a => a.startsWith('--limit=')) || '').split('=')[1] || '0', 10);
const CONCURRENCY = 4; // keep low — the matcher runs several queries per card

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const SPORTS = ['Sports', 'Basketball', 'Football', 'Baseball', 'Hockey', 'Soccer', 'Wrestling', 'Boxing', 'Golf', 'Racing', 'Tennis', 'UFC'];

async function main() {
  const cards: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('cards')
      .select('id, category, conversational_card_info, conversational_decimal_grade')
      .in('category', SPORTS)
      .not('conversational_card_info', 'is', null)
      .order('dcm_price_updated_at', { ascending: true, nullsFirst: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    cards.push(...(data || []));
    if (!data || data.length < 1000) break;
    if (LIMIT && cards.length >= LIMIT) break;
  }
  const target = LIMIT ? cards.slice(0, LIMIT) : cards;
  console.log(`Re-pricing ${target.length} sports cards through the local DB...`);

  let done = 0, priced = 0, noMatch = 0, failed = 0;
  for (let i = 0; i < target.length; i += CONCURRENCY) {
    const slice = target.slice(i, i + CONCURRENCY);
    await Promise.all(slice.map(async (card) => {
      try {
        if (!isSportsCardCategory(card.category)) { noMatch++; return; }
        const result = await fetchAndCacheDcmPrice(card as any, { isInitialGrading: false });
        if (result && result.estimate != null) priced++; else noMatch++;
      } catch (e: any) {
        failed++;
        if (failed <= 10) console.log(`  ⚠ ${card.id}: ${e.message}`);
      } finally {
        done++;
      }
    }));
    if (done % 200 === 0 || done === target.length) {
      console.log(`  ${done}/${target.length} — priced ${priced}, no-match ${noMatch}, failed ${failed}`);
    }
  }
  console.log(`\n✅ Done: ${priced} priced from DB, ${noMatch} no local match, ${failed} errors`);
}

main().catch(e => { console.error(e); process.exit(1); });
