/**
 * Pokemon TCG Database Import Script
 *
 * Fetches all Pokemon cards and sets from the Pokemon TCG API
 * and imports them into our local Supabase database.
 *
 * Usage:
 *   node scripts/import-pokemon-database.js [--full|--incremental]
 *
 * Options:
 *   --full        Full import of all cards (default)
 *   --incremental Only import cards from sets released in last 90 days
 *
 * Environment variables required:
 *   - POKEMON_TCG_API_KEY (optional but recommended for higher rate limits)
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration
const POKEMON_API_BASE = 'https://api.pokemontcg.io/v2';
const POKEMON_API_KEY = process.env.POKEMON_TCG_API_KEY || '';
const PAGE_SIZE = 250; // Max allowed by API
const REQUEST_DELAY_MS = 150; // Delay between requests to be nice to the API

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
 * Fetch data from Pokemon TCG API with error handling
 */
async function fetchFromApi(endpoint, retries = 3) {
  const url = `${POKEMON_API_BASE}${endpoint}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: POKEMON_API_KEY ? { 'X-Api-Key': POKEMON_API_KEY } : {}
      });

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
 * Import all Pokemon sets
 */
async function importSets() {
  console.log('\n=== Importing Pokemon Sets ===\n');

  const startTime = Date.now();
  const response = await fetchFromApi('/sets?orderBy=releaseDate');
  const sets = response.data;

  console.log(`Found ${sets.length} sets to import`);

  let imported = 0;
  let errors = 0;

  for (const set of sets) {
    try {
      const setData = {
        id: set.id,
        name: set.name,
        series: set.series,
        printed_total: set.printedTotal,
        total: set.total,
        release_date: set.releaseDate || null,
        symbol_url: set.images?.symbol || null,
        logo_url: set.images?.logo || null,
        ptcgo_code: set.ptcgoCode || null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('pokemon_sets')
        .upsert(setData, { onConflict: 'id' });

      if (error) {
        throw error;
      }

      imported++;

      // Progress indicator
      if (imported % 20 === 0) {
        console.log(`  Imported ${imported}/${sets.length} sets...`);
      }
    } catch (error) {
      console.error(`  Error importing set ${set.id}: ${error.message}`);
      errors++;
    }
  }

  console.log(`\nSets import complete: ${imported} imported, ${errors} errors (${getElapsedTime(startTime)})`);
  return { imported, errors };
}

/**
 * Import Pokemon cards (paginated)
 */
async function importCards(options = {}) {
  console.log('\n=== Importing Pokemon Cards ===\n');

  const startTime = Date.now();
  const { incrementalDays } = options;

  let page = 1;
  let totalImported = 0;
  let totalErrors = 0;
  let hasMore = true;

  // Build query for incremental imports
  let query = '';
  if (incrementalDays) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - incrementalDays);
    const dateStr = cutoffDate.toISOString().split('T')[0];
    query = `?q=set.releaseDate:[${dateStr} TO *]&orderBy=set.releaseDate`;
    console.log(`Incremental import: Cards from sets released after ${dateStr}`);
  } else {
    query = '?orderBy=set.releaseDate';
    console.log('Full import: All cards');
  }

  // First, get total count
  const countResponse = await fetchFromApi(`/cards${query}&page=1&pageSize=1`);
  const totalCards = countResponse.totalCount;
  const totalPages = Math.ceil(totalCards / PAGE_SIZE);

  console.log(`Total cards to import: ${totalCards} (${totalPages} pages)\n`);

  while (hasMore) {
    try {
      console.log(`Fetching page ${page}/${totalPages}...`);

      const response = await fetchFromApi(`/cards${query}&page=${page}&pageSize=${PAGE_SIZE}`);
      const cards = response.data;

      if (!cards || cards.length === 0) {
        hasMore = false;
        break;
      }

      // Process cards in batches for faster inserts
      const cardBatch = cards.map(card => ({
        id: card.id,
        name: card.name,
        number: card.number,
        set_id: card.set?.id || null,
        supertype: card.supertype || null,
        subtypes: card.subtypes || [],
        types: card.types || [],
        hp: card.hp || null,
        evolves_from: card.evolvesFrom || null,
        evolves_to: card.evolvesTo || [],
        rarity: card.rarity || null,
        artist: card.artist || null,
        flavor_text: card.flavorText || null,
        image_small: card.images?.small || null,
        image_large: card.images?.large || null,
        tcgplayer_url: card.tcgplayer?.url || null,
        cardmarket_url: card.cardmarket?.url || null,
        // Denormalized set data
        set_name: card.set?.name || null,
        set_series: card.set?.series || null,
        set_printed_total: card.set?.printedTotal || null,
        set_release_date: card.set?.releaseDate || null,
        updated_at: new Date().toISOString()
      }));

      // Batch upsert
      const { error } = await supabase
        .from('pokemon_cards')
        .upsert(cardBatch, { onConflict: 'id' });

      if (error) {
        console.error(`  Error inserting batch: ${error.message}`);
        totalErrors += cards.length;
      } else {
        totalImported += cards.length;
      }

      // Progress
      const progress = Math.round((page / totalPages) * 100);
      console.log(`  Page ${page} complete: ${totalImported} cards imported (${progress}% done)`);

      // Check if more pages
      hasMore = cards.length === PAGE_SIZE;
      page++;

      // Rate limiting
      await sleep(REQUEST_DELAY_MS);

    } catch (error) {
      console.error(`  Error on page ${page}: ${error.message}`);
      totalErrors++;

      // Continue to next page on error
      page++;
      await sleep(1000);
    }
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
      .from('pokemon_import_log')
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
    .from('pokemon_sets')
    .select('*', { count: 'exact', head: true });

  const { count: cardsCount } = await supabase
    .from('pokemon_cards')
    .select('*', { count: 'exact', head: true });

  console.log(`Database now contains:`);
  console.log(`  - ${setsCount} sets`);
  console.log(`  - ${cardsCount} cards`);

  // Test a sample lookup
  console.log('\nTesting sample lookup (Charizard, number 4)...');
  const { data: testResults } = await supabase
    .from('pokemon_cards')
    .select('id, name, number, set_name, rarity')
    .eq('name', 'Charizard')
    .eq('number', '4')
    .limit(5);

  if (testResults && testResults.length > 0) {
    console.log(`Found ${testResults.length} Charizard #4 cards:`);
    testResults.forEach(card => {
      console.log(`  - ${card.set_name}: ${card.name} #${card.number} (${card.rarity})`);
    });
  } else {
    console.log('  No results found (this might be an issue)');
  }

  return { setsCount, cardsCount };
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const isIncremental = args.includes('--incremental');
  const importType = isIncremental ? 'incremental' : 'full';

  console.log('================================================');
  console.log('   Pokemon TCG Database Import');
  console.log('================================================');
  console.log(`Started at: ${formatTime(new Date())}`);
  console.log(`Import type: ${importType}`);
  console.log(`API Key: ${POKEMON_API_KEY ? 'Configured' : 'Not configured (using free tier)'}`);
  console.log('================================================');

  const overallStart = Date.now();
  let setsResult = null;
  let cardsResult = null;

  try {
    // Import sets
    setsResult = await importSets();

    // Import cards
    const options = isIncremental ? { incrementalDays: 90 } : {};
    cardsResult = await importCards(options);

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
