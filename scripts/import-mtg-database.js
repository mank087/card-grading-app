/**
 * Magic: The Gathering Database Import Script
 *
 * Fetches all MTG cards and sets from the Scryfall API
 * and imports them into our local Supabase database.
 *
 * Usage:
 *   node scripts/import-mtg-database.js [--full|--sets-only|--set CODE]
 *
 * Options:
 *   --full        Full import of all cards (default)
 *   --sets-only   Only import sets (no cards)
 *   --set CODE    Import specific set by code (e.g., --set mkm)
 *
 * Environment variables required:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

// Configuration
const SCRYFALL_API_BASE = 'https://api.scryfall.com';
const REQUEST_DELAY_MS = 100; // Scryfall asks for 50-100ms between requests

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
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Fetch data from Scryfall API with error handling and pagination support
 */
async function fetchFromApi(endpoint, retries = 3) {
  const url = endpoint.startsWith('http') ? endpoint : `${SCRYFALL_API_BASE}${endpoint}`;

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
 * Get image URIs from card data, handling double-faced cards
 */
function getImageUris(card) {
  // For single-faced cards, use image_uris directly
  if (card.image_uris) {
    return {
      image_small: card.image_uris.small || null,
      image_normal: card.image_uris.normal || null,
      image_large: card.image_uris.large || null,
      image_png: card.image_uris.png || null,
      image_art_crop: card.image_uris.art_crop || null,
      image_border_crop: card.image_uris.border_crop || null,
    };
  }

  // For double-faced cards, use the first face's images
  if (card.card_faces && card.card_faces.length > 0 && card.card_faces[0].image_uris) {
    const face = card.card_faces[0].image_uris;
    return {
      image_small: face.small || null,
      image_normal: face.normal || null,
      image_large: face.large || null,
      image_png: face.png || null,
      image_art_crop: face.art_crop || null,
      image_border_crop: face.border_crop || null,
    };
  }

  return {
    image_small: null,
    image_normal: null,
    image_large: null,
    image_png: null,
    image_art_crop: null,
    image_border_crop: null,
  };
}

/**
 * Get mana cost and oracle text, handling double-faced cards
 */
function getCardContent(card) {
  // For single-faced cards
  if (card.mana_cost !== undefined) {
    return {
      mana_cost: card.mana_cost || null,
      oracle_text: card.oracle_text || null,
      type_line: card.type_line || null,
      flavor_text: card.flavor_text || null,
      power: card.power || null,
      toughness: card.toughness || null,
      loyalty: card.loyalty || null,
    };
  }

  // For double-faced cards, combine or use first face
  if (card.card_faces && card.card_faces.length > 0) {
    const face = card.card_faces[0];
    return {
      mana_cost: face.mana_cost || null,
      oracle_text: card.card_faces.map(f => f.oracle_text).filter(Boolean).join('\n---\n') || null,
      type_line: card.type_line || face.type_line || null,
      flavor_text: face.flavor_text || null,
      power: face.power || null,
      toughness: face.toughness || null,
      loyalty: face.loyalty || null,
    };
  }

  return {
    mana_cost: null,
    oracle_text: null,
    type_line: null,
    flavor_text: null,
    power: null,
    toughness: null,
    loyalty: null,
  };
}

/**
 * Parse price string to decimal
 */
function parsePrice(priceStr) {
  if (!priceStr) return null;
  const price = parseFloat(priceStr);
  return isNaN(price) ? null : price;
}

/**
 * Import all MTG sets
 */
async function importSets() {
  console.log('\n=== Importing MTG Sets ===\n');

  const startTime = Date.now();
  const data = await fetchFromApi('/sets');
  const sets = data.data || [];

  console.log(`Fetched ${sets.length} sets from Scryfall API`);

  let imported = 0;
  let errors = 0;

  // Process in batches
  const BATCH_SIZE = 50;

  for (let i = 0; i < sets.length; i += BATCH_SIZE) {
    const batch = sets.slice(i, i + BATCH_SIZE);

    const setBatch = batch.map(set => ({
      id: set.id,
      code: set.code,
      name: set.name,
      set_type: set.set_type || null,
      released_at: set.released_at || null,
      card_count: set.card_count || null,
      digital: set.digital || false,
      scryfall_uri: set.scryfall_uri || null,
      icon_svg_uri: set.icon_svg_uri || null,
      search_uri: set.search_uri || null,
      parent_set_code: set.parent_set_code || null,
      block_code: set.block_code || null,
      block: set.block || null,
      updated_at: new Date().toISOString()
    }));

    try {
      const { error } = await supabase
        .from('mtg_sets')
        .upsert(setBatch, { onConflict: 'id' });

      if (error) {
        console.error(`  Error inserting batch: ${error.message}`);
        errors += batch.length;
      } else {
        imported += batch.length;
        console.log(`  Imported batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} sets`);
      }
    } catch (error) {
      console.error(`  Error on batch starting at ${i}: ${error.message}`);
      errors += batch.length;
    }

    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`\nSets import complete: ${imported} imported, ${errors} errors (${getElapsedTime(startTime)})`);
  return { imported, errors, sets };
}

/**
 * Import all cards for a specific set with pagination
 */
async function importCardsForSet(set) {
  console.log(`\n  Importing cards for ${set.code.toUpperCase()} - ${set.name}...`);

  let allCards = [];
  let pageUrl = `${SCRYFALL_API_BASE}/cards/search?q=set%3A${set.code}&unique=prints&order=set`;
  let pageNum = 1;

  // Fetch all pages
  while (pageUrl) {
    try {
      await sleep(REQUEST_DELAY_MS);
      const data = await fetchFromApi(pageUrl);

      if (data.data && data.data.length > 0) {
        allCards = allCards.concat(data.data);
        console.log(`    Page ${pageNum}: ${data.data.length} cards (total: ${allCards.length})`);
      }

      pageUrl = data.has_more ? data.next_page : null;
      pageNum++;
    } catch (error) {
      // Set might have no cards or API error
      if (error.message.includes('404')) {
        console.log(`    No cards found for set ${set.code}`);
        return { imported: 0, errors: 0, total: 0 };
      }
      throw error;
    }
  }

  console.log(`    Total cards fetched: ${allCards.length}`);

  let imported = 0;
  let errors = 0;

  // Process in batches
  const BATCH_SIZE = 50;

  for (let i = 0; i < allCards.length; i += BATCH_SIZE) {
    const batch = allCards.slice(i, i + BATCH_SIZE);

    const cardBatch = batch.map(card => {
      const images = getImageUris(card);
      const content = getCardContent(card);

      return {
        id: card.id,
        oracle_id: card.oracle_id || null,
        name: card.name,
        mana_cost: content.mana_cost,
        cmc: card.cmc || null,
        type_line: content.type_line,
        oracle_text: content.oracle_text,
        flavor_text: content.flavor_text,
        colors: card.colors || null,
        color_identity: card.color_identity || null,
        color_indicator: card.color_indicator || null,
        power: content.power,
        toughness: content.toughness,
        loyalty: content.loyalty,
        defense: card.defense || null,
        keywords: card.keywords || null,
        produced_mana: card.produced_mana || null,
        set_id: set.id,
        set_code: card.set,
        set_name: card.set_name || set.name,
        collector_number: card.collector_number,
        rarity: card.rarity || null,
        artist: card.artist || null,
        artist_ids: card.artist_ids || null,
        illustration_id: card.illustration_id || null,
        released_at: card.released_at || set.released_at || null,
        layout: card.layout || null,
        frame: card.frame || null,
        frame_effects: card.frame_effects || null,
        border_color: card.border_color || null,
        full_art: card.full_art || false,
        textless: card.textless || false,
        promo: card.promo || false,
        promo_types: card.promo_types || null,
        reprint: card.reprint || false,
        variation: card.variation || false,
        oversized: card.oversized || false,
        reserved: card.reserved || false,
        foil: card.foil || false,
        nonfoil: card.nonfoil !== false,
        card_faces: card.card_faces ? JSON.stringify(card.card_faces) : null,
        ...images,
        price_usd: parsePrice(card.prices?.usd),
        price_usd_foil: parsePrice(card.prices?.usd_foil),
        price_usd_etched: parsePrice(card.prices?.usd_etched),
        price_eur: parsePrice(card.prices?.eur),
        price_tix: parsePrice(card.prices?.tix),
        legalities: card.legalities || null,
        tcgplayer_id: card.tcgplayer_id || null,
        tcgplayer_etched_id: card.tcgplayer_etched_id || null,
        cardmarket_id: card.cardmarket_id || null,
        mtgo_id: card.mtgo_id || null,
        mtgo_foil_id: card.mtgo_foil_id || null,
        arena_id: card.arena_id || null,
        multiverse_ids: card.multiverse_ids || null,
        purchase_uris: card.purchase_uris || null,
        related_uris: card.related_uris || null,
        games: card.games || null,
        updated_at: new Date().toISOString()
      };
    });

    try {
      const { error } = await supabase
        .from('mtg_cards')
        .upsert(cardBatch, { onConflict: 'id' });

      if (error) {
        console.error(`    Error inserting batch at ${i}: ${error.message}`);
        errors += batch.length;
      } else {
        imported += batch.length;
      }
    } catch (error) {
      console.error(`    Error on batch starting at ${i}: ${error.message}`);
      errors += batch.length;
    }

    // Progress update every 200 cards
    if ((i + BATCH_SIZE) % 200 === 0 || i + BATCH_SIZE >= allCards.length) {
      console.log(`    Progress: ${Math.min(i + BATCH_SIZE, allCards.length)}/${allCards.length} cards`);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  return { imported, errors, total: allCards.length };
}

/**
 * Import all cards from all sets
 */
async function importAllCards(sets) {
  console.log('\n=== Importing MTG Cards ===\n');
  console.log(`Processing ${sets.length} sets...`);

  const startTime = Date.now();
  let totalImported = 0;
  let totalErrors = 0;
  let setsProcessed = 0;

  // Sort sets by release date (newest first) for better UX during long imports
  const sortedSets = [...sets].sort((a, b) => {
    if (!a.released_at) return 1;
    if (!b.released_at) return -1;
    return new Date(b.released_at) - new Date(a.released_at);
  });

  for (const set of sortedSets) {
    try {
      const result = await importCardsForSet(set);
      totalImported += result.imported;
      totalErrors += result.errors;
      setsProcessed++;

      console.log(`    Result: ${result.imported}/${result.total} imported (${setsProcessed}/${sets.length} sets)`);
      await sleep(REQUEST_DELAY_MS * 2); // Extra delay between sets
    } catch (error) {
      console.error(`  Error processing set ${set.code}: ${error.message}`);
      totalErrors++;
      setsProcessed++;
    }

    // Progress update every 50 sets
    if (setsProcessed % 50 === 0) {
      console.log(`\n  === Progress: ${setsProcessed}/${sets.length} sets, ${totalImported} cards imported (${getElapsedTime(startTime)}) ===\n`);
    }
  }

  console.log(`\nCards import complete: ${totalImported} imported, ${totalErrors} errors (${getElapsedTime(startTime)})`);
  return { imported: totalImported, errors: totalErrors };
}

/**
 * Import a single set by code
 */
async function importSingleSet(setCode) {
  console.log(`\n=== Importing Single Set: ${setCode.toUpperCase()} ===\n`);

  const startTime = Date.now();

  // Fetch set info
  const setData = await fetchFromApi(`/sets/${setCode}`);

  if (!setData || setData.object === 'error') {
    throw new Error(`Set not found: ${setCode}`);
  }

  console.log(`Found set: ${setData.name} (${setData.card_count} cards)`);

  // Upsert set
  const { error: setError } = await supabase
    .from('mtg_sets')
    .upsert({
      id: setData.id,
      code: setData.code,
      name: setData.name,
      set_type: setData.set_type || null,
      released_at: setData.released_at || null,
      card_count: setData.card_count || null,
      digital: setData.digital || false,
      scryfall_uri: setData.scryfall_uri || null,
      icon_svg_uri: setData.icon_svg_uri || null,
      search_uri: setData.search_uri || null,
      parent_set_code: setData.parent_set_code || null,
      block_code: setData.block_code || null,
      block: setData.block || null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

  if (setError) {
    console.error(`Error upserting set: ${setError.message}`);
  }

  // Import cards
  const result = await importCardsForSet(setData);

  console.log(`\nSingle set import complete: ${result.imported}/${result.total} cards (${getElapsedTime(startTime)})`);
  return result;
}

/**
 * Log import to database
 */
async function logImport(type, setCode, setsResult, cardsResult, status, errorMessage = null) {
  try {
    await supabase
      .from('mtg_import_log')
      .insert({
        import_type: type,
        set_code: setCode || null,
        sets_imported: setsResult?.imported || 0,
        cards_imported: cardsResult?.imported || 0,
        errors: (setsResult?.errors || 0) + (cardsResult?.errors || 0),
        error_details: errorMessage ? { message: errorMessage } : null,
        status: status,
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
    .from('mtg_sets')
    .select('*', { count: 'exact', head: true });

  const { count: cardsCount } = await supabase
    .from('mtg_cards')
    .select('*', { count: 'exact', head: true });

  console.log(`Database now contains:`);
  console.log(`  - ${setsCount} sets`);
  console.log(`  - ${cardsCount} cards`);

  // Test a sample lookup
  console.log('\nTesting sample lookup (Lightning Bolt)...');
  const { data: testResults } = await supabase
    .from('mtg_cards')
    .select('id, name, set_name, set_code, collector_number, rarity, mana_cost')
    .ilike('name', 'Lightning Bolt')
    .order('released_at', { ascending: false })
    .limit(5);

  if (testResults && testResults.length > 0) {
    console.log(`Found ${testResults.length} Lightning Bolt printings:`);
    testResults.forEach(card => {
      console.log(`  - ${card.name} (${card.set_name}) #${card.collector_number} [${card.rarity}] ${card.mana_cost}`);
    });
  } else {
    console.log('  No results found (this might be an issue)');
  }

  // Test set code + number lookup
  console.log('\nTesting set/number lookup (Set mkm, Card 1)...');
  const { data: idResult } = await supabase
    .from('mtg_cards')
    .select('id, name, set_name, mana_cost, type_line, rarity')
    .eq('set_code', 'mkm')
    .eq('collector_number', '1')
    .single();

  if (idResult) {
    console.log(`  Found: ${idResult.name} - ${idResult.mana_cost} (${idResult.type_line}) [${idResult.rarity}]`);
  } else {
    console.log('  No result found for MKM Card 1 (set may not be imported yet)');
  }

  return { setsCount, cardsCount };
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const setsOnly = args.includes('--sets-only');
  const setIndex = args.indexOf('--set');
  const singleSetCode = setIndex !== -1 ? args[setIndex + 1] : null;

  let importType = 'full';
  if (setsOnly) importType = 'sets-only';
  if (singleSetCode) importType = 'set';

  console.log('================================================');
  console.log('   Magic: The Gathering Database Import');
  console.log('================================================');
  console.log(`Started at: ${formatTime(new Date())}`);
  console.log(`Import type: ${importType}${singleSetCode ? ` (${singleSetCode})` : ''}`);
  console.log(`API: Scryfall API (https://api.scryfall.com/)`);
  console.log('================================================');

  const overallStart = Date.now();
  let setsResult = null;
  let cardsResult = { imported: 0, errors: 0 };

  try {
    if (singleSetCode) {
      // Single set import
      cardsResult = await importSingleSet(singleSetCode);
    } else {
      // Import sets
      setsResult = await importSets();
      const sets = setsResult.sets;

      // Import cards (unless sets-only)
      if (!setsOnly && sets.length > 0) {
        cardsResult = await importAllCards(sets);
      }
    }

    // Verify
    await verifyImport();

    // Log success
    await logImport(importType, singleSetCode, setsResult, cardsResult, 'completed');

    console.log('\n================================================');
    console.log('   Import Complete!');
    console.log('================================================');
    console.log(`Total time: ${getElapsedTime(overallStart)}`);
    if (setsResult) {
      console.log(`Sets: ${setsResult.imported} imported, ${setsResult.errors} errors`);
    }
    console.log(`Cards: ${cardsResult.imported} imported, ${cardsResult.errors} errors`);
    console.log('================================================\n');

  } catch (error) {
    console.error('\n================================================');
    console.error('   Import Failed!');
    console.error('================================================');
    console.error(`Error: ${error.message}`);
    console.error('================================================\n');

    // Log failure
    await logImport(importType, singleSetCode, setsResult, cardsResult, 'failed', error.message);

    process.exit(1);
  }
}

// Run the import
main();
