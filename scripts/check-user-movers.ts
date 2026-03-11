/**
 * Check price history for a specific user's cards
 * Usage: npx tsx scripts/check-user-movers.ts <user_email>
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

async function main() {
  const email = process.argv[2];

  // Find user
  let userId: string;
  if (email) {
    const { data: user } = await supabase.auth.admin.listUsers();
    const match = user?.users?.find(u => u.email === email);
    if (!match) { console.error(`User ${email} not found`); process.exit(1); }
    userId = match.id;
    console.log(`User: ${email} (${userId})\n`);
  } else {
    // Use the user with the most cards
    let allCards: Array<{ user_id: string }> = [];
    let page = 0;
    while (true) {
      const { data: batch } = await supabase.from('cards').select('user_id').range(page * 1000, (page + 1) * 1000 - 1);
      if (!batch || batch.length === 0) break;
      allCards.push(...batch);
      if (batch.length < 1000) break;
      page++;
    }
    const counts: Record<string, number> = {};
    allCards.forEach(c => { counts[c.user_id] = (counts[c.user_id] || 0) + 1; });
    userId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    console.log(`Using top user: ${userId} (${counts[userId]} cards)\n`);
  }

  // Get user's card IDs
  const { data: userCards } = await supabase
    .from('cards')
    .select('id, dcm_price_updated_at, ebay_price_median, dcm_price_estimate')
    .eq('user_id', userId);

  console.log(`Total cards: ${userCards?.length ?? 0}`);

  const cardIdsWithPricing = userCards
    ?.filter(c => c.dcm_price_updated_at || c.ebay_price_median)
    .map(c => c.id) || [];

  console.log(`Cards with pricing data: ${cardIdsWithPricing.length}`);

  if (cardIdsWithPricing.length === 0) {
    console.log('No cards with pricing — movers will be empty');
    return;
  }

  // Check how many have history entries
  // Query in chunks to avoid URL length limits
  const chunkSize = 50;
  let allHistory: Array<{ card_id: string; median_price: number | null; dcm_price_estimate: number | null; recorded_at: string }> = [];

  for (let i = 0; i < cardIdsWithPricing.length; i += chunkSize) {
    const chunk = cardIdsWithPricing.slice(i, i + chunkSize);
    const { data } = await supabase
      .from('card_price_history')
      .select('card_id, median_price, dcm_price_estimate, recorded_at')
      .in('card_id', chunk)
      .order('recorded_at', { ascending: false });

    if (data) allHistory.push(...data);
  }

  console.log(`Price history rows for this user's cards: ${allHistory.length}`);

  // Group by card
  const byCard = new Map<string, Array<{ median: number | null; dcm: number | null }>>();
  for (const entry of allHistory) {
    const arr = byCard.get(entry.card_id) || [];
    arr.push({ median: entry.median_price, dcm: entry.dcm_price_estimate });
    byCard.set(entry.card_id, arr);
  }

  const with1 = [...byCard.values()].filter(v => v.length === 1).length;
  const with2plus = [...byCard.values()].filter(v => v.length >= 2).length;

  console.log(`\nCards with history: ${byCard.size}`);
  console.log(`  1 snapshot:   ${with1}`);
  console.log(`  2+ snapshots: ${with2plus}`);

  // Calculate movers
  let moversFound = 0;
  const sampleMovers: Array<{ id: string; pct: number }> = [];

  byCard.forEach((entries, cardId) => {
    if (entries.length < 2) return;
    const p1 = entries[0].dcm ?? entries[0].median;
    const p2 = entries[1].dcm ?? entries[1].median;
    if (p1 === null || p2 === null || p2 === 0) return;
    const pct = ((p1 - p2) / p2) * 100;
    if (Math.abs(pct) >= 0.1) {
      moversFound++;
      if (sampleMovers.length < 10) {
        sampleMovers.push({ id: cardId.slice(0, 8), pct: Math.round(pct * 10) / 10 });
      }
    }
  });

  console.log(`\nMovers with >= 0.1% change: ${moversFound}`);
  if (sampleMovers.length > 0) {
    console.log('\nSample:');
    sampleMovers.forEach(m => console.log(`  ${m.id}... ${m.pct > 0 ? '+' : ''}${m.pct}%`));
  }
}

main().catch(console.error);
