/**
 * Backfill card_price_history with current pricing data
 * Creates an initial snapshot for all graded cards that have pricing but no history entry.
 * This gives every card a "starting point" so the next weekly cron creates a 2nd entry
 * and the movers feature starts working.
 *
 * Usage: npx tsx scripts/backfill-price-history.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function getCardType(category: string): 'sports' | 'pokemon' | 'mtg' | 'lorcana' | 'other' {
  const sportsCategories = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports'];
  const pokemonCategories = ['Pokemon', 'Pokémon'];
  const mtgCategories = ['MTG', 'Magic: The Gathering', 'Magic the Gathering'];
  const lorcanaCategories = ['Lorcana', 'Disney Lorcana'];

  if (sportsCategories.includes(category)) return 'sports';
  if (pokemonCategories.includes(category)) return 'pokemon';
  if (mtgCategories.includes(category)) return 'mtg';
  if (lorcanaCategories.includes(category)) return 'lorcana';
  return 'other';
}

async function main() {
  console.log('=== Backfill Price History ===\n');

  // 1. Get all graded cards with pricing data
  let allCards: Array<{
    id: string;
    category: string;
    dcm_price_estimate: number | null;
    ebay_price_median: number | null;
    ebay_price_lowest: number | null;
    ebay_price_highest: number | null;
    ebay_price_average: number | null;
    ebay_price_listing_count: number | null;
    ebay_price_updated_at: string | null;
  }> = [];

  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data: batch, error } = await supabase
      .from('cards')
      .select('id, category, dcm_price_estimate, ebay_price_median, ebay_price_lowest, ebay_price_highest, ebay_price_average, ebay_price_listing_count, ebay_price_updated_at')
      .not('conversational_card_info', 'is', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) { console.error('Error fetching cards:', error); process.exit(1); }
    if (!batch || batch.length === 0) break;
    allCards.push(...batch);
    if (batch.length < pageSize) break;
    page++;
  }

  // Filter to cards that have some pricing
  const cardsWithPricing = allCards.filter(c => c.dcm_price_estimate || c.ebay_price_median);
  console.log(`Graded cards: ${allCards.length}`);
  console.log(`Cards with pricing: ${cardsWithPricing.length}`);

  // 2. Get cards that already have history entries
  const existingCardIds = new Set<string>();
  for (let i = 0; i < cardsWithPricing.length; i += 50) {
    const chunk = cardsWithPricing.slice(i, i + 50).map(c => c.id);
    const { data } = await supabase
      .from('card_price_history')
      .select('card_id')
      .in('card_id', chunk);
    data?.forEach(r => existingCardIds.add(r.card_id));
  }

  const cardsNeedingBackfill = cardsWithPricing.filter(c => !existingCardIds.has(c.id));
  console.log(`Cards already in history: ${existingCardIds.size}`);
  console.log(`Cards needing backfill: ${cardsNeedingBackfill.length}\n`);

  if (cardsNeedingBackfill.length === 0) {
    console.log('Nothing to backfill!');
    return;
  }

  // 3. Insert snapshots in batches
  let succeeded = 0;
  let failed = 0;
  const batchSize = 50;

  for (let i = 0; i < cardsNeedingBackfill.length; i += batchSize) {
    const batch = cardsNeedingBackfill.slice(i, i + batchSize);

    const rows = batch.map(card => ({
      card_id: card.id,
      card_type: getCardType(card.category),
      lowest_price: card.ebay_price_lowest,
      median_price: card.ebay_price_median,
      highest_price: card.ebay_price_highest,
      average_price: card.ebay_price_average,
      listing_count: card.ebay_price_listing_count || 0,
      dcm_price_estimate: card.dcm_price_estimate,
      query_used: 'backfill',
      query_strategy: 'custom',
      recorded_at: card.ebay_price_updated_at || new Date().toISOString(),
    }));

    const { error } = await supabase.from('card_price_history').insert(rows);

    if (error) {
      console.error(`Batch ${Math.floor(i / batchSize) + 1} failed:`, error.message);
      failed += batch.length;
    } else {
      succeeded += batch.length;
      process.stdout.write(`\rInserted: ${succeeded}/${cardsNeedingBackfill.length}`);
    }
  }

  console.log(`\n\nDone! Inserted ${succeeded} snapshots, ${failed} failed.`);
  console.log('Next Sunday\'s cron will create 2nd entries, enabling movers.');
}

main().catch(console.error);
