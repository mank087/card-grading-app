/**
 * Check Pokemon card variants in the database
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkVariants() {
  // Check total cards
  const { count: totalCount } = await supabase
    .from('pokemon_cards')
    .select('*', { count: 'exact', head: true });

  console.log('Total Pokemon cards in database:', totalCount);

  // Check for cards with same name + number in same set (potential variants)
  const { data: allCards } = await supabase
    .from('pokemon_cards')
    .select('id, name, number, set_id, set_name, rarity')
    .order('set_id, number');

  // Group by set_id + number
  const grouped = {};
  allCards?.forEach(c => {
    const key = `${c.set_id}-${c.number}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(c);
  });

  // Find duplicates (same set + number)
  const duplicates = Object.entries(grouped).filter(([key, cards]) => cards.length > 1);

  console.log(`\nCards with same set+number (duplicates): ${duplicates.length}`);
  duplicates.slice(0, 5).forEach(([key, cards]) => {
    console.log(`\n  ${key}:`);
    cards.forEach(c => {
      console.log(`    - ${c.id}: ${c.name} [${c.rarity}]`);
    });
  });

  // Check rarity distribution
  const rarities = {};
  allCards?.forEach(c => {
    rarities[c.rarity || 'null'] = (rarities[c.rarity || 'null'] || 0) + 1;
  });
  console.log('\nRarity distribution (top 20):');
  Object.entries(rarities)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([k, v]) => {
      console.log(`  ${k}: ${v}`);
    });

  // Check specific cards known to have variants (Charizard)
  const { data: charizardCards } = await supabase
    .from('pokemon_cards')
    .select('id, name, number, set_name, rarity')
    .ilike('name', '%Charizard%')
    .order('set_name, number')
    .limit(30);

  console.log('\nCharizard cards (checking for variants):');
  charizardCards?.forEach(c => {
    console.log(`  ${c.id}: ${c.name} #${c.number} (${c.set_name}) [${c.rarity}]`);
  });

  // Check cards in Base Set to see if 1st Edition/Unlimited are separate
  const { data: baseSetCards } = await supabase
    .from('pokemon_cards')
    .select('id, name, number, rarity')
    .eq('set_id', 'base1')
    .order('number')
    .limit(20);

  console.log('\nBase Set cards (checking structure):');
  baseSetCards?.forEach(c => {
    console.log(`  ${c.id}: ${c.name} #${c.number} [${c.rarity}]`);
  });

  // Check unique card IDs vs total to see if there's deduplication
  const uniqueIds = new Set(allCards?.map(c => c.id));
  console.log(`\nUnique IDs: ${uniqueIds.size} of ${allCards?.length} total`);

  // Check for reverse holo indicators
  const { data: holoCards } = await supabase
    .from('pokemon_cards')
    .select('id, name, number, set_name, rarity')
    .or('rarity.ilike.%reverse%,rarity.ilike.%holo%,id.ilike.%_a%,id.ilike.%_b%')
    .limit(20);

  console.log('\nCards with holo/reverse indicators:');
  holoCards?.forEach(c => {
    console.log(`  ${c.id}: ${c.name} #${c.number} [${c.rarity}]`);
  });
}

checkVariants().catch(console.error);
