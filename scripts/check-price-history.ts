/**
 * Check if the card_price_history table has any data
 *
 * Usage: npx tsx scripts/check-price-history.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('=== Card Price History Check ===\n');

  // 1. Total row count
  const { count: totalRows, error: countError } = await supabase
    .from('card_price_history')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('Error querying card_price_history:', countError.message);
    if (countError.message.includes('does not exist')) {
      console.error('\nThe card_price_history table does not exist! The migration may not have been applied.');
    }
    process.exit(1);
  }

  console.log(`Total rows in card_price_history: ${totalRows ?? 0}`);

  if (!totalRows || totalRows === 0) {
    console.log('\nNo historical price data exists. The cron job has likely never run successfully.');

    // Check how many cards have eBay cache prices (from on-demand fetches)
    const { count: cardsWithEbayPrice } = await supabase
      .from('cards')
      .select('*', { count: 'exact', head: true })
      .not('ebay_price_median', 'is', null);

    const { count: cardsWithDcmPrice } = await supabase
      .from('cards')
      .select('*', { count: 'exact', head: true })
      .not('dcm_price_estimate', 'is', null);

    const { count: totalCards } = await supabase
      .from('cards')
      .select('*', { count: 'exact', head: true });

    const { count: gradedCards } = await supabase
      .from('cards')
      .select('*', { count: 'exact', head: true })
      .not('conversational_card_info', 'is', null);

    console.log(`\n--- Current card pricing status ---`);
    console.log(`Total cards:              ${totalCards ?? 0}`);
    console.log(`Graded cards:             ${gradedCards ?? 0}`);
    console.log(`Cards with eBay prices:   ${cardsWithEbayPrice ?? 0}`);
    console.log(`Cards with DCM estimates: ${cardsWithDcmPrice ?? 0}`);
    return;
  }

  // 2. Date range
  const { data: oldest } = await supabase
    .from('card_price_history')
    .select('recorded_at')
    .order('recorded_at', { ascending: true })
    .limit(1)
    .single();

  const { data: newest } = await supabase
    .from('card_price_history')
    .select('recorded_at')
    .order('recorded_at', { ascending: false })
    .limit(1)
    .single();

  console.log(`Oldest snapshot: ${oldest?.recorded_at}`);
  console.log(`Newest snapshot: ${newest?.recorded_at}`);

  // 3. Breakdown by card_type
  const { data: byType } = await supabase
    .from('card_price_history')
    .select('card_type')
    .then(({ data }) => {
      const counts: Record<string, number> = {};
      data?.forEach(row => {
        counts[row.card_type] = (counts[row.card_type] || 0) + 1;
      });
      return { data: counts };
    });

  console.log(`\n--- Breakdown by card type ---`);
  if (byType) {
    Object.entries(byType).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
  }

  // 4. Unique cards with history
  const { data: uniqueCards } = await supabase
    .from('card_price_history')
    .select('card_id');

  const uniqueCardIds = new Set(uniqueCards?.map(r => r.card_id));
  console.log(`\nUnique cards with history: ${uniqueCardIds.size}`);

  // 5. DCM price coverage
  const { count: rowsWithDcm } = await supabase
    .from('card_price_history')
    .select('*', { count: 'exact', head: true })
    .not('dcm_price_estimate', 'is', null);

  const { count: rowsWithEbay } = await supabase
    .from('card_price_history')
    .select('*', { count: 'exact', head: true })
    .not('median_price', 'is', null);

  console.log(`\n--- Price source coverage ---`);
  console.log(`  Rows with DCM estimate:  ${rowsWithDcm ?? 0} / ${totalRows}`);
  console.log(`  Rows with eBay median:   ${rowsWithEbay ?? 0} / ${totalRows}`);

  // 6. Sample recent entries
  const { data: recentEntries } = await supabase
    .from('card_price_history')
    .select('card_id, card_type, median_price, dcm_price_estimate, listing_count, recorded_at, query_strategy')
    .order('recorded_at', { ascending: false })
    .limit(5);

  console.log(`\n--- 5 most recent snapshots ---`);
  recentEntries?.forEach(entry => {
    const dcm = entry.dcm_price_estimate != null ? `$${entry.dcm_price_estimate} DCM` : 'no DCM';
    const ebay = entry.median_price != null ? `$${entry.median_price} eBay` : 'no eBay';
    console.log(`  ${entry.recorded_at} | ${entry.card_type} | ${dcm} | ${ebay} | ${entry.listing_count} listings | ${entry.query_strategy}`);
  });

  // 7. Cards with 2+ snapshots (needed for movers)
  const cardSnapshotCounts: Record<string, number> = {};
  uniqueCards?.forEach(r => {
    cardSnapshotCounts[r.card_id] = (cardSnapshotCounts[r.card_id] || 0) + 1;
  });
  const cardsWithMultiple = Object.values(cardSnapshotCounts).filter(c => c >= 2).length;
  console.log(`\n--- Mover eligibility ---`);
  console.log(`  Cards with 1 snapshot:   ${Object.values(cardSnapshotCounts).filter(c => c === 1).length}`);
  console.log(`  Cards with 2+ snapshots: ${cardsWithMultiple}`);

  // 8. Check actual price changes for cards with 2+ entries
  if (cardsWithMultiple > 0) {
    const multiCardIds = Object.entries(cardSnapshotCounts)
      .filter(([, count]) => count >= 2)
      .map(([id]) => id)
      .slice(0, 50);

    const { data: multiHistory } = await supabase
      .from('card_price_history')
      .select('card_id, median_price, dcm_price_estimate, recorded_at')
      .in('card_id', multiCardIds)
      .order('recorded_at', { ascending: false });

    const byCard = new Map<string, Array<{ median: number | null; dcm: number | null; date: string }>>();
    multiHistory?.forEach(row => {
      const arr = byCard.get(row.card_id) || [];
      arr.push({ median: row.median_price, dcm: row.dcm_price_estimate, date: row.recorded_at });
      byCard.set(row.card_id, arr);
    });

    let changesOver1 = 0;
    let changesUnder1 = 0;
    let noChange = 0;
    const sampleChanges: Array<{ id: string; pct: number; p1: number; p2: number }> = [];

    byCard.forEach((entries, cardId) => {
      if (entries.length < 2) return;
      const p1 = entries[0].dcm ?? entries[0].median;
      const p2 = entries[1].dcm ?? entries[1].median;
      if (p1 === null || p2 === null || p2 === 0) return;
      const pct = ((p1 - p2) / p2) * 100;
      if (Math.abs(pct) >= 1) {
        changesOver1++;
        if (sampleChanges.length < 10) sampleChanges.push({ id: cardId, pct: Math.round(pct * 10) / 10, p1, p2 });
      } else if (pct === 0) {
        noChange++;
      } else {
        changesUnder1++;
      }
    });

    console.log(`\n--- Price change analysis (sample of ${byCard.size} cards) ---`);
    console.log(`  No change (0%):        ${noChange}`);
    console.log(`  Changed < 1%:          ${changesUnder1}`);
    console.log(`  Changed >= 1% (shown): ${changesOver1}`);

    if (sampleChanges.length > 0) {
      console.log(`\n--- Sample movers ---`);
      sampleChanges.forEach(s => {
        console.log(`  ${s.id.slice(0, 8)}... | ${s.pct > 0 ? '+' : ''}${s.pct}% | $${s.p2} -> $${s.p1}`);
      });
    }
  }

  // 9. Cards table pricing status
  const { count: cardsWithDcmPrice } = await supabase
    .from('cards')
    .select('*', { count: 'exact', head: true })
    .not('dcm_price_estimate', 'is', null);

  const { count: cardsWithEbayPrice } = await supabase
    .from('cards')
    .select('*', { count: 'exact', head: true })
    .not('ebay_price_median', 'is', null);

  const { count: gradedCards } = await supabase
    .from('cards')
    .select('*', { count: 'exact', head: true })
    .not('conversational_card_info', 'is', null);

  console.log(`\n--- Cards table pricing status ---`);
  console.log(`  Graded cards:             ${gradedCards ?? 0}`);
  console.log(`  Cards with DCM estimates: ${cardsWithDcmPrice ?? 0}`);
  console.log(`  Cards with eBay prices:   ${cardsWithEbayPrice ?? 0}`);
}

main().catch(console.error);
