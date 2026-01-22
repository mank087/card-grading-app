/**
 * Lorcana TCG Database Import Script
 *
 * Fetches all Lorcana cards and sets from the Lorcast API
 * and imports them into our local Supabase database.
 *
 * Usage:
 *   node scripts/import-lorcana-database.js [--full|--sets-only]
 *
 * Options:
 *   --full        Full import of all cards (default)
 *   --sets-only   Only import sets (no cards)
 *
 * Environment variables required:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration
const LORCAST_API_BASE = 'https://api.lorcast.com/v0';
const REQUEST_DELAY_MS = 75; // Lorcast recommends 50-100ms between requests

// Initialize Supabase client with service role key for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing Supabase environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Utility: Sleep for a given number of milliseconds
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Utility: Format date for display
function formatTime(date) {
  return date.toLocaleTimeString();
}

// Utility: Calculate elapsed time
function getElapsedTime(startTime) {
  const elapsed = Date.now() - startTime;
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Fetch data from Lorcast API with error handling
 */
async function fetchFromApi(endpoint, retries = 3) {
  const url = `${LORCAST_API_BASE}${endpoint}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);

      if (response.status === 429) {
        console.log('  Rate limited, waiting 5 seconds...');
        await sleep(5000);
        continue;
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`  Attempt ${attempt}/${retries} failed: ${error.message}`);
      if (attempt < retries) {
        await sleep(1000 * attempt); // Exponential backoff
      } else {
        throw error;
      }
    }
  }
}

/**
 * Format rarity to consistent format
 */
function formatRarity(rarity) {
  if (!rarity) return null;
  // Convert "Super_rare" to "Super Rare", etc.
  return rarity.replace(/_/g, ' ');
}

/**
 * Build full name from name and version
 */
function buildFullName(name, version) {
  if (!version) return name;
  return `${name} - ${version}`;
}

/**
 * Import all Lorcana sets
 */
async function importSets() {
  console.log('\n=== Importing Lorcana Sets ===\n');

  const startTime = Date.now();
  const data = await fetchFromApi('/sets');
  const sets = data.results || [];

  console.log(`Fetched ${sets.length} sets from Lorcast API`);

  let imported = 0;
  let errors = 0;

  for (const set of sets) {
    try {
      const setData = {
        id: set.id,
        code: set.code,
        name: set.name,
        released_at: set.released_at || null,
        prereleased_at: set.prereleased_at || null,
        total_cards: null, // Will be updated after card import
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('lorcana_sets')
        .upsert(setData, { onConflict: 'id' });

      if (error) {
        throw error;
      }

      imported++;
      console.log(`  Imported: ${set.code} - ${set.name}`);
    } catch (error) {
      console.error(`  Error importing set ${set.code}: ${error.message}`);
      errors++;
    }

    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`\nSets import complete: ${imported} imported, ${errors} errors (${getElapsedTime(startTime)})`);
  return { imported, errors, sets };
}

/**
 * Import all cards for a specific set
 */
async function importCardsForSet(set) {
  console.log(`\n  Fetching cards for ${set.code} - ${set.name}...`);

  // Search for all cards in this set (unique=prints gets ALL variations including Enchanted)
  const data = await fetchFromApi(`/cards/search?q=set:${set.code}&unique=prints`);
  const cards = data.results || [];

  console.log(`    Found ${cards.length} cards`);

  let imported = 0;
  let errors = 0;

  // Process in batches
  const BATCH_SIZE = 50;

  for (let i = 0; i < cards.length; i += BATCH_SIZE) {
    const batch = cards.slice(i, i + BATCH_SIZE);

    const cardBatch = batch.map(card => ({
      id: card.id,
      name: card.name,
      version: card.version || null,
      full_name: buildFullName(card.name, card.version),
      collector_number: card.collector_number,
      set_id: card.set?.id || set.id,
      set_code: card.set?.code || set.code,
      set_name: card.set?.name || set.name,
      ink: card.ink || null,
      inkwell: card.inkwell || false,
      card_type: card.type || null,
      classifications: card.classifications || null,
      cost: card.cost || null,
      strength: card.strength || null,
      willpower: card.willpower || null,
      lore: card.lore || null,
      move_cost: card.move_cost || null,
      card_text: card.text || null,
      flavor_text: card.flavor_text || null,
      keywords: card.keywords || null,
      rarity: formatRarity(card.rarity),
      image_small: card.image_uris?.digital?.small || null,
      image_normal: card.image_uris?.digital?.normal || null,
      image_large: card.image_uris?.digital?.large || null,
      illustrators: card.illustrators || null,
      tcgplayer_id: card.tcgplayer_id || null,
      price_usd: card.prices?.usd || null,
      price_usd_foil: card.prices?.usd_foil || null,
      legalities: card.legalities || null,
      released_at: card.released_at || null,
      lang: card.lang || 'en',
      updated_at: new Date().toISOString()
    }));

    try {
      const { error } = await supabase
        .from('lorcana_cards')
        .upsert(cardBatch, { onConflict: 'id' });

      if (error) {
        console.error(`    Error inserting batch: ${error.message}`);
        errors += batch.length;
      } else {
        imported += batch.length;
      }
    } catch (error) {
      console.error(`    Error on batch starting at ${i}: ${error.message}`);
      errors += batch.length;
    }

    await sleep(REQUEST_DELAY_MS);
  }

  // Update set total_cards count
  await supabase
    .from('lorcana_sets')
    .update({ total_cards: cards.length })
    .eq('id', set.id);

  return { imported, errors, total: cards.length };
}

/**
 * Import all cards from all sets
 */
async function importAllCards(sets) {
  console.log('\n=== Importing Lorcana Cards ===\n');

  const startTime = Date.now();
  let totalImported = 0;
  let totalErrors = 0;

  for (const set of sets) {
    const result = await importCardsForSet(set);
    totalImported += result.imported;
    totalErrors += result.errors;
    console.log(`    Result: ${result.imported}/${result.total} imported`);
    await sleep(REQUEST_DELAY_MS * 2); // Extra delay between sets
  }

  console.log(`\nCards import complete: ${totalImported} imported, ${totalErrors} errors (${getElapsedTime(startTime)})`);
  return { imported: totalImported, errors: totalErrors };
}

/**
 * Log import to database
 */
async function logImport(type, setsResult, cardsResult, status, errorMessage = null) {
  try {
    await supabase
      .from('lorcana_import_log')
      .insert({
        import_type: type,
        sets_imported: setsResult?.imported || 0,
        cards_imported: cardsResult?.imported || 0,
        status: status,
        error_message: errorMessage,
        completed_at: status === 'completed' ? new Date().toISOString() : null
      });
  } catch (error) {
    console.error('Failed to log import:', error.message);
  }
}

/**
 * Verify import by checking counts
 */
async function verifyImport() {
  console.log('\n=== Verifying Import ===\n');

  const { count: setsCount } = await supabase
    .from('lorcana_sets')
    .select('*', { count: 'exact', head: true });

  const { count: cardsCount } = await supabase
    .from('lorcana_cards')
    .select('*', { count: 'exact', head: true });

  console.log(`Database now contains:`);
  console.log(`  - ${setsCount} sets`);
  console.log(`  - ${cardsCount} cards`);

  // Test a sample lookup
  console.log('\nTesting sample lookup (Elsa)...');
  const { data: testResults } = await supabase
    .from('lorcana_cards')
    .select('id, name, version, set_name, rarity, ink')
    .ilike('name', '%Elsa%')
    .limit(5);

  if (testResults && testResults.length > 0) {
    console.log(`Found ${testResults.length} Elsa cards:`);
    testResults.forEach(card => {
      const fullName = card.version ? `${card.name} - ${card.version}` : card.name;
      console.log(`  - ${fullName} (${card.set_name}) [${card.rarity}] ${card.ink}`);
    });
  } else {
    console.log('  No results found (this might be an issue)');
  }

  // Test set code + number lookup
  console.log('\nTesting set/number lookup (Set 1, Card 1)...');
  const { data: idResult } = await supabase
    .from('lorcana_cards')
    .select('id, name, version, set_name, ink, cost')
    .eq('set_code', '1')
    .eq('collector_number', '1')
    .single();

  if (idResult) {
    const fullName = idResult.version ? `${idResult.name} - ${idResult.version}` : idResult.name;
    console.log(`  Found: ${fullName} - ${idResult.ink} (Cost: ${idResult.cost})`);
  } else {
    console.log('  No result found for Set 1 Card 1');
  }

  return { setsCount, cardsCount };
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const setsOnly = args.includes('--sets-only');
  const importType = setsOnly ? 'sets-only' : 'full';

  console.log('================================================');
  console.log('   Lorcana TCG Database Import');
  console.log('================================================');
  console.log(`Started at: ${formatTime(new Date())}`);
  console.log(`Import type: ${importType}`);
  console.log(`API: Lorcast API (https://api.lorcast.com/)`);
  console.log('================================================');

  const overallStart = Date.now();
  let setsResult = null;
  let cardsResult = { imported: 0, errors: 0 };

  try {
    // Import sets
    setsResult = await importSets();
    const sets = setsResult.sets;

    // Import cards (unless sets-only)
    if (!setsOnly && sets.length > 0) {
      cardsResult = await importAllCards(sets);
    }

    // Verify
    await verifyImport();

    // Log success
    await logImport(importType, setsResult, cardsResult, 'completed');

    console.log('\n================================================');
    console.log('   Import Complete!');
    console.log('================================================');
    console.log(`Total time: ${getElapsedTime(overallStart)}`);
    console.log(`Sets: ${setsResult.imported} imported, ${setsResult.errors} errors`);
    console.log(`Cards: ${cardsResult.imported} imported, ${cardsResult.errors} errors`);
    console.log('================================================\n');

  } catch (error) {
    console.error('\n================================================');
    console.error('   Import Failed!');
    console.error('================================================');
    console.error(`Error: ${error.message}`);
    console.error('================================================\n');

    // Log failure
    await logImport(importType, setsResult, cardsResult, 'failed', error.message);

    process.exit(1);
  }
}

// Run the import
main();
