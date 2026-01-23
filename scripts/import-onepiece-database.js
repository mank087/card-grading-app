/**
 * One Piece TCG Database Import Script
 *
 * Fetches all One Piece cards and sets from the OPTCG API
 * and imports them into our local Supabase database.
 *
 * IMPORTANT: This script preserves ALL card variants (Parallel, Manga, Alternate Art, etc.)
 * Each variant gets a unique ID with a suffix (e.g., OP01-120_parallel, OP01-120_manga)
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

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

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
 * Variant type mappings - order matters for detection priority
 */
const VARIANT_PATTERNS = [
  { pattern: /\(Red Super Alternate Art\)/i, type: 'red_super_alt_art', suffix: '_red_super_alt' },
  { pattern: /\(Super Alternate Art\)/i, type: 'super_alt_art', suffix: '_super_alt' },
  { pattern: /\(Gold-Stamped Signature\)/i, type: 'gold_stamped', suffix: '_gold_stamped' },
  { pattern: /\(Wanted Poster\)/i, type: 'wanted_poster', suffix: '_wanted' },
  { pattern: /\(Box Topper\)/i, type: 'box_topper', suffix: '_box_topper' },
  { pattern: /\(Jolly Roger Foil\)/i, type: 'jolly_roger_foil', suffix: '_jolly_roger' },
  { pattern: /\(Textured Foil\)/i, type: 'textured_foil', suffix: '_textured' },
  { pattern: /\(Pirate Foil\)/i, type: 'pirate_foil', suffix: '_pirate_foil' },
  { pattern: /\(Alternate Art\)/i, type: 'alternate_art', suffix: '_alt_art' },
  { pattern: /\(Full Art\)/i, type: 'full_art', suffix: '_full_art' },
  { pattern: /\(Parallel\).*\(Manga\)/i, type: 'parallel_manga', suffix: '_parallel_manga' },
  { pattern: /\(Manga\)/i, type: 'manga', suffix: '_manga' },
  { pattern: /\(Parallel\)/i, type: 'parallel', suffix: '_parallel' },
  { pattern: /\(SP\)\s*\(Gold\)/i, type: 'sp_gold', suffix: '_sp_gold' },
  { pattern: /\(SP\)/i, type: 'sp', suffix: '_sp' },
  { pattern: /\(Reprint\)/i, type: 'reprint', suffix: '_reprint' },
  { pattern: /\(Dash Pack\)/i, type: 'dash_pack', suffix: '_dash' },
  { pattern: /\(Pre-Release\)/i, type: 'prerelease', suffix: '_prerelease' },
  { pattern: /\(Promo\)/i, type: 'promo', suffix: '_promo' },
];

/**
 * Extract variant type and clean card name from original name
 * Returns: { variantType, variantSuffix, cleanName, originalName }
 */
function extractVariantInfo(cardName) {
  if (!cardName) return { variantType: null, variantSuffix: '', cleanName: cardName, originalName: cardName };

  let cleanName = cardName;
  let variantType = null;
  let variantSuffix = '';

  // Check for variant patterns (first match wins for type, but we remove all patterns from name)
  for (const { pattern, type, suffix } of VARIANT_PATTERNS) {
    if (pattern.test(cardName)) {
      if (!variantType) {
        // First match determines the variant type
        variantType = type;
        variantSuffix = suffix;
      }
      // Remove all variant indicators from name
      cleanName = cleanName.replace(pattern, '').trim();
    }
  }

  // Also remove trailing card number in parentheses like "(003)" or "(061)"
  cleanName = cleanName.replace(/\s*\(\d+\)$/, '').trim();

  // Clean up any double spaces
  cleanName = cleanName.replace(/\s+/g, ' ').trim();

  return {
    variantType,
    variantSuffix,
    cleanName,
    originalName: cardName
  };
}

/**
 * Generate unique card ID with variant suffix
 */
function generateUniqueCardId(baseCardSetId, variantSuffix, seenIds) {
  let uniqueId = baseCardSetId + variantSuffix;

  // Handle edge case where same variant appears multiple times (shouldn't happen but be safe)
  let counter = 1;
  while (seenIds.has(uniqueId)) {
    uniqueId = `${baseCardSetId}${variantSuffix}_${counter}`;
    counter++;
  }

  seenIds.add(uniqueId);
  return uniqueId;
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
 * Import cards from OPTCG API (preserves ALL variants)
 */
async function importCards(cardData, source) {
  console.log(`\n=== Importing ${source} Cards (with variants) ===\n`);

  const startTime = Date.now();
  let totalImported = 0;
  let totalErrors = 0;
  let totalVariants = 0;

  console.log(`Processing ${cardData.length} cards from ${source}...`);

  // Track seen IDs to ensure uniqueness
  const seenIds = new Set();

  // Process cards in batches
  const BATCH_SIZE = 100;

  for (let i = 0; i < cardData.length; i += BATCH_SIZE) {
    const batch = cardData.slice(i, i + BATCH_SIZE);

    const cardBatch = batch.map(card => {
      const baseCardSetId = card.card_set_id;
      const { variantType, variantSuffix, cleanName, originalName } = extractVariantInfo(card.card_name);

      // Generate unique ID with variant suffix
      const uniqueId = generateUniqueCardId(baseCardSetId, variantSuffix, seenIds);

      if (variantType) {
        totalVariants++;
      }

      return {
        id: uniqueId,
        card_name: cleanName || 'Unknown',
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
        // New variant columns
        variant_type: variantType,
        base_card_id: baseCardSetId,
        original_name: originalName,
        updated_at: new Date().toISOString()
      };
    });

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
        console.log(`  Progress: ${totalImported} cards imported, ${totalVariants} variants (${progress}%)`);
      }

    } catch (error) {
      console.error(`  Error on batch starting at ${i}: ${error.message}`);
      totalErrors += batch.length;
    }

    // Rate limiting
    await sleep(REQUEST_DELAY_MS);
  }

  console.log(`\n${source} cards import complete: ${totalImported} imported (${totalVariants} variants), ${totalErrors} errors (${getElapsedTime(startTime)})`);
  return { imported: totalImported, errors: totalErrors, variants: totalVariants };
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

  // Count variants
  const { count: variantCount } = await supabase
    .from('onepiece_cards')
    .select('*', { count: 'exact', head: true })
    .not('variant_type', 'is', null);

  const baseCount = cardsCount - variantCount;

  console.log(`Database now contains:`);
  console.log(`  - ${setsCount} sets`);
  console.log(`  - ${cardsCount} total cards`);
  console.log(`    - ${baseCount} base cards`);
  console.log(`    - ${variantCount} variants`);

  // Test a sample lookup
  console.log('\nTesting sample lookup (Roronoa Zoro)...');
  const { data: testResults } = await supabase
    .from('onepiece_cards')
    .select('id, card_name, set_name, rarity, variant_type, market_price')
    .ilike('card_name', '%Roronoa Zoro%')
    .order('base_card_id')
    .order('variant_type', { nullsFirst: true })
    .limit(10);

  if (testResults && testResults.length > 0) {
    console.log(`Found ${testResults.length} Roronoa Zoro cards:`);
    testResults.forEach(card => {
      const variantLabel = card.variant_type ? ` [${card.variant_type}]` : '';
      console.log(`  - ${card.id}: ${card.card_name}${variantLabel} (${card.set_name}) [${card.rarity}] $${card.market_price || 'N/A'}`);
    });
  } else {
    console.log('  No results found (this might be an issue)');
  }

  // Test card with variants (Shanks OP01-120)
  console.log('\nTesting card with variants (Shanks OP01-120)...');
  const { data: shanksResults } = await supabase
    .from('onepiece_cards')
    .select('id, card_name, variant_type, rarity, market_price')
    .eq('base_card_id', 'OP01-120')
    .order('variant_type', { nullsFirst: true });

  if (shanksResults && shanksResults.length > 0) {
    console.log(`Found ${shanksResults.length} Shanks OP01-120 variants:`);
    shanksResults.forEach(card => {
      const variantLabel = card.variant_type || 'base';
      console.log(`  - ${card.id}: ${card.card_name} [${variantLabel}] $${card.market_price || 'N/A'}`);
    });
  } else {
    console.log('  No Shanks variants found');
  }

  // Show variant type distribution
  console.log('\nVariant type distribution:');
  const { data: variantTypes } = await supabase
    .from('onepiece_cards')
    .select('variant_type')
    .not('variant_type', 'is', null);

  if (variantTypes) {
    const typeCounts = {};
    variantTypes.forEach(v => {
      typeCounts[v.variant_type] = (typeCounts[v.variant_type] || 0) + 1;
    });
    Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`  - ${type}: ${count}`);
      });
  }

  return { setsCount, cardsCount, variantCount };
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

    // Count unique base card IDs vs total (for logging)
    const uniqueBaseIds = new Set(allCards.map(c => c.card_set_id));
    console.log(`Base cards: ${uniqueBaseIds.size}, Total with variants: ${allCards.length}`);
    console.log(`Variants to import: ${allCards.length - uniqueBaseIds.size}`);

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
