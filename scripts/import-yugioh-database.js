/**
 * Yu-Gi-Oh! TCG Database Import Script
 *
 * Fetches all Yu-Gi-Oh! cards and sets from the YGOPRODeck API v7
 * and imports them into our local Supabase database.
 *
 * Usage:
 *   node scripts/import-yugioh-database.js [--full|--sets-only]
 *
 * Options:
 *   --full        Full import of all cards (default)
 *   --sets-only   Only import sets (no cards)
 *
 * Environment variables required:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Notes:
 *   - YGOPRODeck rate limit: 20 requests/second (1 hour ban if exceeded)
 *   - All card data should be cached locally per API terms of use
 *   - Card images should be downloaded separately (not hotlinked)
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Configuration
const YGOPRODECK_API_BASE = 'https://db.ygoprodeck.com/api/v7';
const REQUEST_DELAY_MS = 100; // Stay well under 20 req/sec limit
const BATCH_SIZE = 100; // Supabase upsert batch size

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing Supabase environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Utilities
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function formatTime(date) { return date.toLocaleTimeString(); }
function getElapsedTime(startTime) {
  const elapsed = Date.now() - startTime;
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
}

/**
 * Fetch from YGOPRODeck API with retry logic
 */
async function fetchFromApi(endpoint, retries = 3) {
  const url = `${YGOPRODECK_API_BASE}${endpoint}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);

      if (response.status === 429) {
        console.log('  Rate limited! Waiting 60 seconds...');
        await sleep(60000);
        continue;
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`  Attempt ${attempt}/${retries} failed: ${error.message}`);
      if (attempt < retries) {
        await sleep(2000 * attempt);
      } else {
        throw error;
      }
    }
  }
}

// ============================================================================
// SETS IMPORT
// ============================================================================

async function importSets() {
  console.log('\n=== Importing Yu-Gi-Oh! Sets ===\n');
  const startTime = Date.now();

  const rawSets = await fetchFromApi('/cardsets.php');
  console.log(`Fetched ${rawSets.length} raw set entries from YGOPRODeck API`);

  // Deduplicate by set_code (API can return multiple entries per code)
  const setMap = new Map();
  for (const set of rawSets) {
    if (!setMap.has(set.set_code)) {
      setMap.set(set.set_code, set);
    }
  }
  const sets = Array.from(setMap.values());
  console.log(`${sets.length} unique sets after deduplication`);

  let imported = 0;
  let errors = 0;

  // Process in batches
  for (let i = 0; i < sets.length; i += BATCH_SIZE) {
    const batch = sets.slice(i, i + BATCH_SIZE);

    const setBatch = batch.map(set => ({
      set_code: set.set_code,
      set_name: set.set_name,
      num_of_cards: set.num_of_cards || null,
      tcg_date: set.tcg_date || null,
      set_image: set.set_image || null,
      updated_at: new Date().toISOString()
    }));

    try {
      const { error } = await supabase
        .from('yugioh_sets')
        .upsert(setBatch, { onConflict: 'set_code' });

      if (error) {
        console.error(`  Error inserting set batch at ${i}: ${error.message}`);
        errors += batch.length;
      } else {
        imported += batch.length;
      }
    } catch (error) {
      console.error(`  Error on set batch at ${i}: ${error.message}`);
      errors += batch.length;
    }

    if (i % 500 === 0 && i > 0) {
      console.log(`  Progress: ${i}/${sets.length} sets processed...`);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`\nSets import complete: ${imported} imported, ${errors} errors (${getElapsedTime(startTime)})`);
  return { imported, errors, total: sets.length };
}

// ============================================================================
// CARDS IMPORT
// ============================================================================

async function importAllCards() {
  console.log('\n=== Importing Yu-Gi-Oh! Cards ===\n');
  const startTime = Date.now();

  // Fetch ALL cards in one request (YGOPRODeck returns all ~13k cards at once)
  console.log('Fetching all cards from YGOPRODeck API (this may take a moment)...');
  const data = await fetchFromApi('/cardinfo.php');
  const cards = data.data || [];

  console.log(`Fetched ${cards.length} unique cards`);

  let cardsImported = 0;
  let cardsErrors = 0;
  let printingsImported = 0;
  let printingsErrors = 0;

  // Process cards in batches
  for (let i = 0; i < cards.length; i += BATCH_SIZE) {
    const batch = cards.slice(i, i + BATCH_SIZE);

    // 1. Upsert cards
    const cardBatch = batch.map(card => {
      const prices = card.card_prices?.[0] || {};
      return {
        id: card.id,
        name: card.name,
        type: card.type || null,
        human_readable_card_type: card.humanReadableCardType || card.type || null,
        frame_type: card.frameType || null,
        card_desc: card.desc || null,
        race: card.race || null,
        attribute: card.attribute || null,
        archetype: card.archetype || null,
        atk: card.atk ?? null,
        def: card.def ?? null,
        level: card.level ?? null,
        scale: card.scale ?? null,
        linkval: card.linkval ?? null,
        linkmarkers: card.linkmarkers || null,
        typeline: card.typeline || null,
        image_url: card.card_images?.[0]?.image_url || null,
        image_url_small: card.card_images?.[0]?.image_url_small || null,
        image_url_cropped: card.card_images?.[0]?.image_url_cropped || null,
        tcgplayer_price: prices.tcgplayer_price ? parseFloat(prices.tcgplayer_price) : null,
        cardmarket_price: prices.cardmarket_price ? parseFloat(prices.cardmarket_price) : null,
        ebay_price: prices.ebay_price ? parseFloat(prices.ebay_price) : null,
        amazon_price: prices.amazon_price ? parseFloat(prices.amazon_price) : null,
        ygoprodeck_url: card.ygoprodeck_url || null,
        updated_at: new Date().toISOString()
      };
    });

    try {
      const { error } = await supabase
        .from('yugioh_cards')
        .upsert(cardBatch, { onConflict: 'id' });

      if (error) {
        console.error(`  Error inserting card batch at ${i}: ${error.message}`);
        cardsErrors += batch.length;
      } else {
        cardsImported += batch.length;
      }
    } catch (error) {
      console.error(`  Error on card batch at ${i}: ${error.message}`);
      cardsErrors += batch.length;
    }

    // 2. Upsert printings (card_sets array) — deduplicate by card_id+set_code
    const printingMap = new Map();
    for (const card of batch) {
      if (card.card_sets) {
        for (const printing of card.card_sets) {
          const key = `${card.id}_${printing.set_code}`;
          if (!printingMap.has(key)) {
            printingMap.set(key, {
              card_id: card.id,
              set_code: printing.set_code,
              set_name: printing.set_name,
              set_rarity: printing.set_rarity || null,
              set_rarity_code: printing.set_rarity_code || null,
              set_price: printing.set_price ? parseFloat(printing.set_price) : null,
              card_name: card.name,
              updated_at: new Date().toISOString()
            });
          }
        }
      }
    }
    const printingBatch = Array.from(printingMap.values());

    // Insert printings in sub-batches (can be large)
    for (let j = 0; j < printingBatch.length; j += BATCH_SIZE) {
      const subBatch = printingBatch.slice(j, j + BATCH_SIZE);
      try {
        const { error } = await supabase
          .from('yugioh_card_printings')
          .upsert(subBatch, { onConflict: 'card_id,set_code' });

        if (error) {
          console.error(`  Error inserting printing sub-batch: ${error.message}`);
          printingsErrors += subBatch.length;
        } else {
          printingsImported += subBatch.length;
        }
      } catch (error) {
        console.error(`  Error on printing sub-batch: ${error.message}`);
        printingsErrors += subBatch.length;
      }
    }

    if (i % 500 === 0) {
      console.log(`  Progress: ${i}/${cards.length} cards processed (${printingsImported} printings so far)...`);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`\nCards import complete: ${cardsImported} cards, ${printingsImported} printings (${getElapsedTime(startTime)})`);
  console.log(`  Card errors: ${cardsErrors}, Printing errors: ${printingsErrors}`);
  return { cardsImported, cardsErrors, printingsImported, printingsErrors };
}

// ============================================================================
// VERIFY
// ============================================================================

async function verifyImport() {
  console.log('\n=== Verifying Import ===\n');

  const { count: setsCount } = await supabase
    .from('yugioh_sets')
    .select('*', { count: 'exact', head: true });

  const { count: cardsCount } = await supabase
    .from('yugioh_cards')
    .select('*', { count: 'exact', head: true });

  const { count: printingsCount } = await supabase
    .from('yugioh_card_printings')
    .select('*', { count: 'exact', head: true });

  console.log(`Database now contains:`);
  console.log(`  - ${setsCount} sets`);
  console.log(`  - ${cardsCount} unique cards`);
  console.log(`  - ${printingsCount} card printings`);

  // Test: lookup Dark Magician
  console.log('\nTesting sample lookup (Dark Magician)...');
  const { data: testResults } = await supabase
    .from('yugioh_cards')
    .select('id, name, type, atk, def, level, attribute')
    .ilike('name', '%Dark Magician%')
    .limit(5);

  if (testResults && testResults.length > 0) {
    console.log(`Found ${testResults.length} "Dark Magician" cards:`);
    testResults.forEach(card => {
      console.log(`  - ${card.name} [${card.type}] ATK/${card.atk} DEF/${card.def} Level ${card.level} ${card.attribute}`);
    });
  } else {
    console.log('  No results found (this might be an issue)');
  }

  // Test: lookup by set code
  console.log('\nTesting set code lookup (LOB-005)...');
  const { data: printingResult } = await supabase
    .from('yugioh_card_printings')
    .select('card_name, set_code, set_name, set_rarity, set_price')
    .eq('set_code', 'LOB-005')
    .single();

  if (printingResult) {
    console.log(`  Found: ${printingResult.card_name} - ${printingResult.set_name} [${printingResult.set_rarity}] $${printingResult.set_price}`);
  } else {
    console.log('  No result found for LOB-005');
  }

  return { setsCount, cardsCount, printingsCount };
}

// ============================================================================
// LOG
// ============================================================================

async function logImport(type, setsResult, cardsResult, status, errorMessage = null) {
  try {
    await supabase
      .from('yugioh_import_log')
      .insert({
        import_type: type,
        sets_imported: setsResult?.imported || 0,
        cards_imported: cardsResult?.cardsImported || 0,
        printings_imported: cardsResult?.printingsImported || 0,
        status: status,
        error_message: errorMessage,
        completed_at: status === 'completed' ? new Date().toISOString() : null
      });
  } catch (error) {
    console.error('Failed to log import:', error.message);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const setsOnly = args.includes('--sets-only');
  const importType = setsOnly ? 'sets-only' : 'full';

  console.log('================================================');
  console.log('   Yu-Gi-Oh! TCG Database Import');
  console.log('================================================');
  console.log(`Started at: ${formatTime(new Date())}`);
  console.log(`Import type: ${importType}`);
  console.log(`API: YGOPRODeck v7 (https://ygoprodeck.com/)`);
  console.log('================================================');

  const overallStart = Date.now();
  let setsResult = null;
  let cardsResult = { cardsImported: 0, cardsErrors: 0, printingsImported: 0, printingsErrors: 0 };

  try {
    // Import sets
    setsResult = await importSets();

    // Import cards (unless sets-only)
    if (!setsOnly) {
      cardsResult = await importAllCards();
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
    console.log(`Cards: ${cardsResult.cardsImported} imported, ${cardsResult.cardsErrors} errors`);
    console.log(`Printings: ${cardsResult.printingsImported} imported, ${cardsResult.printingsErrors} errors`);
    console.log('================================================\n');

  } catch (error) {
    console.error('\n================================================');
    console.error('   Import Failed!');
    console.error('================================================');
    console.error(`Error: ${error.message}`);
    console.error('================================================\n');

    await logImport(importType, setsResult, cardsResult, 'failed', error.message);
    process.exit(1);
  }
}

main();
