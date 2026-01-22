/**
 * One Piece TCG Database Import Script
 *
 * Fetches all One Piece cards and sets from the OPTCG API
 * and imports them into our local Supabase database.
 *
 * Usage:
 *   node scripts/import-onepiece-database.js [--full|--sets-only|--promos-only]
 *
 * Options:
 *   --full        Full import of all cards (default)
 *   --sets-only   Only import booster set cards
 *   --promos-only Only import promo cards
 *
 * Environment variables required:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration
const OPTCG_API_BASE = 'https://optcgapi.com/api';
const REQUEST_DELAY_MS = 100; // Delay between requests (API asks for reasonable use)

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
 * Fetch data from OPTCG API with error handling
 */
async function fetchFromApi(endpoint, retries = 3) {
  const url = `${OPTCG_API_BASE}${endpoint}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);

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
 * Parse card number from card_set_id (e.g., "OP01-001" -> "001")
 */
function parseCardNumber(cardSetId) {
  const match = cardSetId.match(/-(\d+[A-Za-z]*)$/);
  return match ? match[1] : cardSetId;
}

/**
 * Parse set ID from card_set_id (e.g., "OP01-001" -> "OP-01")
 */
function parseSetId(cardSetId) {
  // Handle formats like "OP01-001", "ST01-001", "EB01-001", "PRB01-001"
  const match = cardSetId.match(/^([A-Z]+)(\d+)-/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}`;
  }
  return null;
}

/**
 * Determine set type from set ID
 */
function getSetType(setId) {
  if (!setId) return 'unknown';
  if (setId.startsWith('OP-')) return 'booster';
  if (setId.startsWith('ST-')) return 'starter';
  if (setId.startsWith('EB-')) return 'extra';
  if (setId.startsWith('PRB-')) return 'promo';
  if (setId.startsWith('P-')) return 'promo';
  return 'other';
}

/**
 * Parse card power to integer
 */
function parseCardPower(power) {
  if (!power) return null;
  const num = parseInt(power.replace(/[^0-9]/g, ''));
  return isNaN(num) ? null : num;
}

/**
 * Parse card cost to integer
 */
function parseCardCost(cost) {
  if (cost === null || cost === undefined) return null;
  const num = parseInt(cost);
  return isNaN(num) ? null : num;
}

/**
 * Import all One Piece sets from the cards
 */
async function importSets(cards) {
  console.log('\n=== Extracting and Importing One Piece Sets ===\n');

  const startTime = Date.now();

  // Extract unique sets from cards
  const setsMap = new Map();

  for (const card of cards) {
    const setId = parseSetId(card.card_set_id);
    if (setId && !setsMap.has(setId)) {
      setsMap.set(setId, {
        id: setId,
        name: card.set_name,
        set_type: getSetType(setId),
        total_cards: 0,
        updated_at: new Date().toISOString()
      });
    }
    // Count cards per set
    if (setId && setsMap.has(setId)) {
      const set = setsMap.get(setId);
      set.total_cards++;
    }
  }

  const sets = Array.from(setsMap.values());
  console.log(`Found ${sets.length} unique sets`);

  let imported = 0;
  let errors = 0;

  for (const set of sets) {
    try {
      const { error } = await supabase
        .from('onepiece_sets')
        .upsert(set, { onConflict: 'id' });

      if (error) {
        throw error;
      }

      imported++;
    } catch (error) {
      console.error(`  Error importing set ${set.id}: ${error.message}`);
      errors++;
    }
  }

  console.log(`\nSets import complete: ${imported} imported, ${errors} errors (${getElapsedTime(startTime)})`);
  return { imported, errors };
}

/**
 * Import cards from OPTCG API
 */
async function importCards(cardData, source) {
  console.log(`\n=== Importing ${source} Cards ===\n`);

  const startTime = Date.now();
  let totalImported = 0;
  let totalErrors = 0;

  console.log(`Processing ${cardData.length} cards from ${source}...`);

  // Process cards in batches
  const BATCH_SIZE = 100;

  for (let i = 0; i < cardData.length; i += BATCH_SIZE) {
    const batch = cardData.slice(i, i + BATCH_SIZE);

    const cardBatch = batch.map(card => ({
      id: card.card_set_id,
      card_name: card.card_name?.replace(/\s*\(\d+\)$/, '') || 'Unknown', // Remove trailing number like "(001)"
      card_number: parseCardNumber(card.card_set_id),
      set_id: parseSetId(card.card_set_id),
      card_type: card.card_type || null,
      card_color: card.card_color || null,
      rarity: card.rarity || null,
      card_cost: parseCardCost(card.card_cost),
      card_power: parseCardPower(card.card_power),
      life: card.life ? parseInt(card.life) : null,
      counter_amount: card.counter_amount ? parseInt(card.counter_amount) : null,
      attribute: card.attribute || null,
      sub_types: card.sub_types || null,
      card_text: card.card_text || null,
      card_image: card.card_image || null,
      card_image_id: card.card_image_id || null,
      market_price: card.market_price || null,
      inventory_price: card.inventory_price || null,
      date_scraped: card.date_scraped || null,
      set_name: card.set_name || null,
      updated_at: new Date().toISOString()
    }));

    try {
      const { error } = await supabase
        .from('onepiece_cards')
        .upsert(cardBatch, { onConflict: 'id' });

      if (error) {
        console.error(`  Error inserting batch: ${error.message}`);
        totalErrors += batch.length;
      } else {
        totalImported += batch.length;
      }

      // Progress
      const progress = Math.round(((i + batch.length) / cardData.length) * 100);
      if (progress % 10 === 0 || i + batch.length >= cardData.length) {
        console.log(`  Progress: ${totalImported} cards imported (${progress}%)`);
      }

    } catch (error) {
      console.error(`  Error on batch starting at ${i}: ${error.message}`);
      totalErrors += batch.length;
    }

    // Rate limiting
    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`\n${source} cards import complete: ${totalImported} imported, ${totalErrors} errors (${getElapsedTime(startTime)})`);
  return { imported: totalImported, errors: totalErrors };
}

/**
 * Fetch and import all booster set cards
 */
async function importBoosterSets() {
  console.log('\n=== Fetching Booster Set Cards ===\n');

  const cards = await fetchFromApi('/allSetCards/');
  console.log(`Fetched ${cards.length} booster set cards`);

  return cards;
}

/**
 * Fetch and import all starter deck cards
 */
async function importStarterDecks() {
  console.log('\n=== Fetching Starter Deck Cards ===\n');

  const cards = await fetchFromApi('/allSTCards/');
  console.log(`Fetched ${cards.length} starter deck cards`);

  return cards;
}

/**
 * Fetch and import all promo cards
 */
async function importPromoCards() {
  console.log('\n=== Fetching Promo Cards ===\n');

  try {
    const cards = await fetchFromApi('/allPromoCards/');
    console.log(`Fetched ${cards.length} promo cards`);
    return cards;
  } catch (error) {
    console.log(`  Warning: Could not fetch promo cards (${error.message})`);
    console.log('  Continuing without promo cards...');
    return [];
  }
}

/**
 * Log import to database
 */
async function logImport(type, setsResult, cardsResult, status, errorMessage = null) {
  try {
    await supabase
      .from('onepiece_import_log')
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
    .from('onepiece_sets')
    .select('*', { count: 'exact', head: true });

  const { count: cardsCount } = await supabase
    .from('onepiece_cards')
    .select('*', { count: 'exact', head: true });

  console.log(`Database now contains:`);
  console.log(`  - ${setsCount} sets`);
  console.log(`  - ${cardsCount} cards`);

  // Test a sample lookup
  console.log('\nTesting sample lookup (Roronoa Zoro)...');
  const { data: testResults } = await supabase
    .from('onepiece_cards')
    .select('id, card_name, set_name, rarity, card_type')
    .ilike('card_name', '%Roronoa Zoro%')
    .limit(5);

  if (testResults && testResults.length > 0) {
    console.log(`Found ${testResults.length} Roronoa Zoro cards:`);
    testResults.forEach(card => {
      console.log(`  - ${card.id}: ${card.card_name} (${card.set_name}) [${card.rarity}] ${card.card_type}`);
    });
  } else {
    console.log('  No results found (this might be an issue)');
  }

  // Test card ID lookup
  console.log('\nTesting card ID lookup (OP01-001)...');
  const { data: idResult } = await supabase
    .from('onepiece_cards')
    .select('id, card_name, set_name, card_type, card_power')
    .eq('id', 'OP01-001')
    .single();

  if (idResult) {
    console.log(`  Found: ${idResult.card_name} - ${idResult.card_type} (Power: ${idResult.card_power})`);
  } else {
    console.log('  No result found for OP01-001');
  }

  return { setsCount, cardsCount };
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const setsOnly = args.includes('--sets-only');
  const promosOnly = args.includes('--promos-only');
  const importType = setsOnly ? 'sets-only' : promosOnly ? 'promos-only' : 'full';

  console.log('================================================');
  console.log('   One Piece TCG Database Import');
  console.log('================================================');
  console.log(`Started at: ${formatTime(new Date())}`);
  console.log(`Import type: ${importType}`);
  console.log(`API: OPTCG API (https://optcgapi.com/)`);
  console.log('================================================');

  const overallStart = Date.now();
  let setsResult = null;
  let cardsResult = { imported: 0, errors: 0 };
  let allCards = [];

  try {
    // Fetch cards based on import type
    if (!promosOnly) {
      const boosterCards = await importBoosterSets();
      allCards = allCards.concat(boosterCards);
      await sleep(REQUEST_DELAY_MS);

      const starterCards = await importStarterDecks();
      allCards = allCards.concat(starterCards);
      await sleep(REQUEST_DELAY_MS);
    }

    if (!setsOnly) {
      const promoCards = await importPromoCards();
      allCards = allCards.concat(promoCards);
    }

    console.log(`\nTotal cards fetched: ${allCards.length}`);

    // Deduplicate cards by card_set_id (API returns variants like regular + parallel)
    // Keep the first occurrence (usually the standard version with lower price)
    const uniqueCards = [];
    const seenIds = new Set();
    for (const card of allCards) {
      if (!seenIds.has(card.card_set_id)) {
        seenIds.add(card.card_set_id);
        uniqueCards.push(card);
      }
    }
    console.log(`Deduplicated to ${uniqueCards.length} unique cards`);
    allCards = uniqueCards;

    // Import sets first (extracted from cards)
    setsResult = await importSets(allCards);

    // Import all cards
    const result = await importCards(allCards, 'All');
    cardsResult.imported += result.imported;
    cardsResult.errors += result.errors;

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
