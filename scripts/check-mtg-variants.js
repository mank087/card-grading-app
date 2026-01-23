/**
 * Check Magic: The Gathering card variants in the database
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
    .from('mtg_cards')
    .select('*', { count: 'exact', head: true });

  console.log('Total MTG cards in database:', totalCount);

  // Check total sets
  const { count: setCount } = await supabase
    .from('mtg_sets')
    .select('*', { count: 'exact', head: true });

  console.log('Total MTG sets in database:', setCount);

  // Check for cards with same set_code + collector_number (should be 0 due to UNIQUE constraint)
  const { data: sampleCards } = await supabase
    .from('mtg_cards')
    .select('id, name, set_code, collector_number, rarity, variation, promo, frame_effects')
    .order('set_code, collector_number')
    .limit(1000);

  // Group by set_code + collector_number
  const grouped = {};
  sampleCards?.forEach(c => {
    const key = `${c.set_code}-${c.collector_number}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(c);
  });

  // Find duplicates (same set + collector number)
  const duplicates = Object.entries(grouped).filter(([key, cards]) => cards.length > 1);

  console.log(`\nCards with same set+collector_number (duplicates): ${duplicates.length}`);
  if (duplicates.length > 0) {
    duplicates.slice(0, 5).forEach(([key, cards]) => {
      console.log(`\n  ${key}:`);
      cards.forEach(c => {
        console.log(`    - ${c.id}: ${c.name} [${c.rarity}] variation=${c.variation} promo=${c.promo}`);
      });
    });
  }

  // Check how variants are represented - look at a popular card with many printings
  console.log('\n=== Checking Lightning Bolt (multiple printings) ===');
  const { data: lightningBolts } = await supabase
    .from('mtg_cards')
    .select('id, name, set_code, set_name, collector_number, rarity, variation, promo, frame_effects, released_at')
    .ilike('name', 'Lightning Bolt')
    .order('released_at', { ascending: false })
    .limit(15);

  console.log(`Found ${lightningBolts?.length || 0} Lightning Bolt printings:`);
  lightningBolts?.forEach(c => {
    const flags = [];
    if (c.variation) flags.push('variation');
    if (c.promo) flags.push('promo');
    if (c.frame_effects?.length) flags.push(`frame:${c.frame_effects.join(',')}`);
    console.log(`  ${c.set_code}#${c.collector_number}: ${c.name} (${c.set_name}) [${c.rarity}] ${flags.length ? `[${flags.join(', ')}]` : ''}`);
  });

  // Check cards with variation=true
  console.log('\n=== Cards marked as "variation" (alternate art) ===');
  const { data: variationCards, count: variationCount } = await supabase
    .from('mtg_cards')
    .select('id, name, set_code, set_name, collector_number, rarity, frame_effects', { count: 'exact' })
    .eq('variation', true)
    .limit(10);

  console.log(`Total cards with variation=true: ${variationCount}`);
  variationCards?.forEach(c => {
    console.log(`  ${c.set_code}#${c.collector_number}: ${c.name} (${c.set_name}) [${c.rarity}] ${c.frame_effects ? `frame:${c.frame_effects.join(',')}` : ''}`);
  });

  // Check cards with special frame effects
  console.log('\n=== Cards with special frame effects ===');
  const { data: frameCards } = await supabase
    .from('mtg_cards')
    .select('id, name, set_code, set_name, collector_number, rarity, frame_effects')
    .not('frame_effects', 'is', null)
    .limit(15);

  console.log(`Sample cards with frame effects:`);
  frameCards?.forEach(c => {
    console.log(`  ${c.set_code}#${c.collector_number}: ${c.name} (${c.set_name}) [${c.rarity}] frame:${c.frame_effects?.join(',')}`);
  });

  // Check promo cards
  console.log('\n=== Promo cards ===');
  const { count: promoCount } = await supabase
    .from('mtg_cards')
    .select('*', { count: 'exact', head: true })
    .eq('promo', true);

  console.log(`Total promo cards: ${promoCount}`);

  // Check oracle_id usage - how many unique cards vs total printings
  const { data: oracleStats } = await supabase
    .from('mtg_cards')
    .select('oracle_id')
    .not('oracle_id', 'is', null);

  const uniqueOracleIds = new Set(oracleStats?.map(c => c.oracle_id));
  console.log(`\n=== Oracle ID stats ===`);
  console.log(`Total cards (printings): ${oracleStats?.length || 0}`);
  console.log(`Unique oracle_ids (unique cards): ${uniqueOracleIds.size}`);
  console.log(`Average printings per unique card: ${((oracleStats?.length || 0) / uniqueOracleIds.size).toFixed(2)}`);

  // Check a card with many variants in the same set (showcase, extended art, etc.)
  console.log('\n=== Checking a recent set for variant handling ===');
  const { data: recentSetCards } = await supabase
    .from('mtg_cards')
    .select('id, name, collector_number, rarity, variation, promo, frame_effects, full_art')
    .eq('set_code', 'mkm')
    .order('collector_number')
    .limit(30);

  if (recentSetCards?.length) {
    console.log(`MKM (Murders at Karlov Manor) sample cards:`);
    recentSetCards?.forEach(c => {
      const flags = [];
      if (c.variation) flags.push('variation');
      if (c.promo) flags.push('promo');
      if (c.full_art) flags.push('full_art');
      if (c.frame_effects?.length) flags.push(`frame:${c.frame_effects.join(',')}`);
      console.log(`  #${c.collector_number.padStart(3)}: ${c.name.substring(0, 30).padEnd(30)} [${c.rarity?.padEnd(8) || 'n/a     '}] ${flags.join(', ')}`);
    });
  }
}

checkVariants().catch(console.error);
