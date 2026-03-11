/**
 * Pokemon TCG Database Import from TCGdex (English)
 *
 * Imports new Pokemon sets and cards from TCGdex API into our existing
 * pokemon_sets and pokemon_cards tables. Used as a supplement/fallback
 * when the primary Pokemon TCG API (pokemontcg.io) is unavailable.
 *
 * Maps TCGdex data format → our existing database schema.
 *
 * Usage:
 *   node scripts/import-pokemon-tcgdex-en.js [--all|--new-only]
 *
 * Options:
 *   --all       Import all sets from TCGdex (full sync)
 *   --new-only  Only import sets not already in our database (default)
 *   --set=ID    Import a single set by TCGdex ID (e.g., --set=sv08.5)
 *
 * Environment variables required:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Configuration
const TCGDEX_API_BASE = 'https://api.tcgdex.net/v2/en';
const REQUEST_DELAY_MS = 200;

// TCGdex set ID → Pokemon TCG API set ID mapping
// TCGdex uses different IDs than pokemontcg.io
const TCGDEX_TO_PTCG_SET_ID = {
  // Scarlet & Violet era
  'sv01': 'sv1',
  'sv02': 'sv2',
  'sv03': 'sv3',
  'sv03.5': 'sv3pt5',
  'sv04': 'sv4',
  'sv04.5': 'sv4pt5',
  'sv05': 'sv5',
  'sv06': 'sv6',
  'sv06.5': 'sv6pt5',
  'sv07': 'sv7',
  'sv08': 'sv8',
  'svp': 'svp',
  // New sets (post Surging Sparks)
  'sv08.5': 'sv8pt5',
  'sv09': 'sv9',
  'sv10': 'sv10',
  'sv10.5b': 'sv10pt5b',
  'sv10.5w': 'sv10pt5w',
  // Mega Evolution era (new generation starting Sep 2025)
  'me01': 'me1',
  'mep': 'mep',
  'me02': 'me2',
  'me02.5': 'me2pt5',
};

// Sets we want to import (ones missing from our DB)
const NEW_SET_IDS = [
  'sv08.5',    // Prismatic Evolutions (Jan 2025)
  'sv09',      // Journey Together (Mar 2025)
  'sv10',      // Destined Rivals (May 2025)
  'sv10.5b',   // Black Bolt (Jul 2025)
  'sv10.5w',   // White Flare (Jul 2025)
  'me01',      // Mega Evolution (Sep 2025)
  'mep',       // MEP Black Star Promos (Sep 2025)
  'me02',      // Phantasmal Flames (Nov 2025)
  'me02.5',    // Ascended Heroes (Jan 2026)
];

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing Supabase environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getElapsedTime(startTime) {
  const elapsed = Date.now() - startTime;
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
}

/**
 * Fetch from TCGdex API with retries
 */
async function fetchFromTcgdex(endpoint, retries = 3) {
  const url = `${TCGDEX_API_BASE}${endpoint}`;

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
        await sleep(1000 * attempt);
      } else {
        throw error;
      }
    }
  }
}

/**
 * Map a TCGdex set to our pokemon_sets schema
 */
function mapSetData(tcgdexSet, tcgdexId) {
  const ptcgId = TCGDEX_TO_PTCG_SET_ID[tcgdexId] || tcgdexId;

  return {
    id: ptcgId,
    name: tcgdexSet.name,
    series: tcgdexSet.serie?.name || null,
    printed_total: tcgdexSet.cardCount?.official || tcgdexSet.cardCount?.total || 0,
    total: tcgdexSet.cardCount?.total || 0,
    release_date: tcgdexSet.releaseDate || null,
    symbol_url: tcgdexSet.symbol || null,
    logo_url: tcgdexSet.logo || null,
    ptcgo_code: tcgdexSet.tcgOnline || null,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Map a TCGdex card to our pokemon_cards schema
 */
function mapCardData(tcgdexCard, setData, ptcgSetId) {
  const cardId = `${ptcgSetId}-${tcgdexCard.localId}`;

  return {
    id: cardId,
    name: tcgdexCard.name || 'Unknown',
    number: tcgdexCard.localId || '',
    set_id: ptcgSetId,
    supertype: tcgdexCard.category || null,
    subtypes: tcgdexCard.stage ? [tcgdexCard.stage] : [],
    types: tcgdexCard.types || [],
    hp: tcgdexCard.hp ? String(tcgdexCard.hp) : null,
    evolves_from: tcgdexCard.evolveFrom || null,
    evolves_to: [],
    rarity: tcgdexCard.rarity || null,
    artist: tcgdexCard.illustrator || null,
    flavor_text: tcgdexCard.description || null,
    image_small: tcgdexCard.image ? `${tcgdexCard.image}/low.webp` : null,
    image_large: tcgdexCard.image ? `${tcgdexCard.image}/high.webp` : null,
    tcgplayer_url: null,
    cardmarket_url: null,
    // Denormalized set data
    set_name: setData.name || null,
    set_series: setData.series || null,
    set_printed_total: setData.printed_total || null,
    set_release_date: setData.release_date || null,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Import a single set and all its cards
 */
async function importSet(tcgdexSetId) {
  const ptcgSetId = TCGDEX_TO_PTCG_SET_ID[tcgdexSetId] || tcgdexSetId;
  console.log(`\n--- Importing set: ${tcgdexSetId} (mapped to ${ptcgSetId}) ---`);

  // Fetch set details
  const setDetail = await fetchFromTcgdex(`/sets/${tcgdexSetId}`);
  const setData = mapSetData(setDetail, tcgdexSetId);

  console.log(`  Set: ${setData.name} | Release: ${setData.release_date} | Cards: ${setDetail.cardCount?.total || 0}`);

  // Upsert set
  const { error: setError } = await supabase
    .from('pokemon_sets')
    .upsert(setData, { onConflict: 'id' });

  if (setError) {
    console.error(`  Error upserting set: ${setError.message}`);
    return { setImported: false, cardsImported: 0, errors: 1 };
  }
  console.log(`  Set upserted successfully`);

  // Now fetch each card's details
  const cards = setDetail.cards || [];
  console.log(`  Fetching ${cards.length} card details...`);

  let imported = 0;
  let errors = 0;
  const cardBatch = [];

  for (let i = 0; i < cards.length; i++) {
    const cardSummary = cards[i];

    try {
      // Fetch full card details
      const cardDetail = await fetchFromTcgdex(`/cards/${tcgdexSetId}-${cardSummary.localId}`);
      const cardData = mapCardData(cardDetail, setData, ptcgSetId);
      cardBatch.push(cardData);

      // Batch upsert every 50 cards
      if (cardBatch.length >= 50 || i === cards.length - 1) {
        const { error: cardError } = await supabase
          .from('pokemon_cards')
          .upsert(cardBatch, { onConflict: 'id' });

        if (cardError) {
          console.error(`  Error upserting card batch: ${cardError.message}`);
          errors += cardBatch.length;
        } else {
          imported += cardBatch.length;
        }
        cardBatch.length = 0; // Clear batch

        // Progress
        const progress = Math.round(((i + 1) / cards.length) * 100);
        console.log(`  Progress: ${i + 1}/${cards.length} cards (${progress}%) - ${imported} imported, ${errors} errors`);
      }

      // Rate limiting
      await sleep(REQUEST_DELAY_MS);

    } catch (error) {
      console.error(`  Error fetching card ${cardSummary.localId}: ${error.message}`);
      errors++;
    }
  }

  console.log(`  Set complete: ${imported} cards imported, ${errors} errors`);
  return { setImported: true, cardsImported: imported, errors };
}

/**
 * Get existing set IDs from our database
 */
async function getExistingSetIds() {
  const { data, error } = await supabase
    .from('pokemon_sets')
    .select('id');

  if (error) {
    console.error('Error fetching existing sets:', error.message);
    return new Set();
  }

  return new Set(data.map(s => s.id));
}

/**
 * Verify import results
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

  // Test a lookup from a new set
  console.log('\nTesting lookup from Prismatic Evolutions...');
  const { data: testResults } = await supabase
    .from('pokemon_cards')
    .select('id, name, number, set_name, rarity')
    .eq('set_id', 'sv8pt5')
    .limit(5);

  if (testResults && testResults.length > 0) {
    console.log(`Found ${testResults.length} cards from Prismatic Evolutions:`);
    testResults.forEach(card => {
      console.log(`  - ${card.name} #${card.number} (${card.rarity})`);
    });
  } else {
    console.log('  No Prismatic Evolutions cards found');
  }

  // Test Ascended Heroes
  console.log('\nTesting lookup from Ascended Heroes...');
  const { data: testResults2 } = await supabase
    .from('pokemon_cards')
    .select('id, name, number, set_name, rarity')
    .eq('set_id', 'me2pt5')
    .limit(5);

  if (testResults2 && testResults2.length > 0) {
    console.log(`Found ${testResults2.length} cards from Ascended Heroes:`);
    testResults2.forEach(card => {
      console.log(`  - ${card.name} #${card.number} (${card.rarity})`);
    });
  } else {
    console.log('  No Ascended Heroes cards found');
  }

  return { setsCount, cardsCount };
}

/**
 * Log import to database
 */
async function logImport(type, totalSets, totalCards, status, errorMessage = null) {
  try {
    await supabase
      .from('pokemon_import_log')
      .insert({
        import_type: type,
        sets_imported: totalSets,
        cards_imported: totalCards,
        status,
        error_message: errorMessage,
        completed_at: status === 'completed' ? new Date().toISOString() : null,
      });
  } catch (error) {
    console.error('Failed to log import:', error.message);
  }
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const importAll = args.includes('--all');
  const singleSet = args.find(a => a.startsWith('--set='))?.split('=')[1];

  console.log('================================================');
  console.log('   Pokemon TCG Import from TCGdex (English)');
  console.log('================================================');
  console.log(`Started at: ${new Date().toLocaleTimeString()}`);
  console.log(`Source: TCGdex API (${TCGDEX_API_BASE})`);
  console.log('================================================');

  const overallStart = Date.now();
  let totalSetsImported = 0;
  let totalCardsImported = 0;
  let totalErrors = 0;

  try {
    let setsToImport = [];

    if (singleSet) {
      // Import a single set
      console.log(`\nImporting single set: ${singleSet}`);
      setsToImport = [singleSet];
    } else if (importAll) {
      // Import all sets available in TCGdex
      console.log('\nFetching all TCGdex sets...');
      const allSets = await fetchFromTcgdex('/sets');
      setsToImport = allSets.map(s => s.id);
      console.log(`Found ${setsToImport.length} total sets`);
    } else {
      // Default: only import new sets not in our database
      console.log('\nChecking for new sets not in our database...');
      const existingIds = await getExistingSetIds();
      console.log(`Existing sets in database: ${existingIds.size}`);

      // Check which of our target new sets are missing
      for (const tcgdexId of NEW_SET_IDS) {
        const ptcgId = TCGDEX_TO_PTCG_SET_ID[tcgdexId] || tcgdexId;
        if (!existingIds.has(ptcgId)) {
          setsToImport.push(tcgdexId);
          console.log(`  NEW: ${tcgdexId} → ${ptcgId}`);
        } else {
          console.log(`  EXISTS: ${tcgdexId} → ${ptcgId} (skipping)`);
        }
      }
    }

    if (setsToImport.length === 0) {
      console.log('\nNo new sets to import. Database is up to date!');
    } else {
      console.log(`\nImporting ${setsToImport.length} sets...\n`);

      for (const setId of setsToImport) {
        try {
          const result = await importSet(setId);
          if (result.setImported) totalSetsImported++;
          totalCardsImported += result.cardsImported;
          totalErrors += result.errors;
        } catch (error) {
          console.error(`Failed to import set ${setId}: ${error.message}`);
          totalErrors++;
        }
      }
    }

    // Verify
    await verifyImport();

    // Log success
    await logImport('tcgdex_en', totalSetsImported, totalCardsImported, 'completed');

    console.log('\n================================================');
    console.log('   Import Complete!');
    console.log('================================================');
    console.log(`Total time: ${getElapsedTime(overallStart)}`);
    console.log(`Sets: ${totalSetsImported} imported`);
    console.log(`Cards: ${totalCardsImported} imported`);
    console.log(`Errors: ${totalErrors}`);
    console.log('================================================\n');

  } catch (error) {
    console.error('\n================================================');
    console.error('   Import Failed!');
    console.error('================================================');
    console.error(`Error: ${error.message}`);
    console.error('================================================\n');

    await logImport('tcgdex_en', totalSetsImported, totalCardsImported, 'failed', error.message);
    process.exit(1);
  }
}

main();
