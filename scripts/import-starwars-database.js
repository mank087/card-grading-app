/**
 * Star Wars Cards Database Import Script (v2)
 *
 * Fetches all Star Wars trading cards from PriceCharting API
 * and imports them into our local Supabase database.
 *
 * Strategy: Search by exact console-name (set name) for each known Star Wars set,
 * paginating through ALL results. This gives complete coverage including every
 * parallel/variant, unlike character-name searches which miss most cards.
 *
 * Phase 1: Discovery — broad searches to find all unique console-names
 * Phase 2: Import — paginate through every card in each discovered set
 *
 * Usage:
 *   node scripts/import-starwars-database.js [--full|--test|--discover-only]
 *
 * Options:
 *   --full           Full import of all sets (default)
 *   --test           Test mode: import only first 3 sets
 *   --discover-only  Only run discovery phase (list all sets, don't import)
 *
 * Environment variables required:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - PRICECHARTING_API_KEY
 */

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

// Configuration
const API_BASE_URL = 'https://www.pricecharting.com/api';
const REQUEST_DELAY_MS = 500; // Delay between API page fetches
const SET_DELAY_MS = 1000;    // Delay between sets
const PRODUCTS_PER_PAGE = 100;
const MAX_PAGES_PER_SET = 50; // Safety limit (5000 cards per set max)
const BATCH_SIZE = 100;       // Supabase upsert batch size

// Initialize Supabase client with service role key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiKey = process.env.PRICECHARTING_API_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing Supabase environment variables');
  process.exit(1);
}
if (!apiKey) {
  console.error('Error: Missing PRICECHARTING_API_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================================================
// Discovery queries — broad searches to find all unique Star Wars set names
// ============================================================================
const DISCOVERY_QUERIES = [
  'Star Wars 1977', 'Star Wars 1980', 'Star Wars 1983', 'Star Wars 1993',
  'Star Wars 1996', 'Star Wars 2004', 'Star Wars 2008', 'Star Wars 2016',
  'Star Wars 2017', 'Star Wars 2018', 'Star Wars 2019', 'Star Wars 2020',
  'Star Wars 2021', 'Star Wars 2022', 'Star Wars 2023', 'Star Wars 2024',
  'Star Wars 2025',
  'Star Wars Empire', 'Star Wars Return Jedi', 'Star Wars Galaxy',
  'Star Wars Chrome', 'Star Wars Masterwork', 'Star Wars Heritage',
  'Star Wars Widevision', 'Star Wars Force Awakens', 'Star Wars Last Jedi',
  'Star Wars Rise Skywalker', 'Star Wars Rogue One', 'Star Wars Mandalorian',
  'Star Wars Clone Wars', 'Star Wars High Tek', 'Star Wars Finest',
  'Star Wars Holocron', 'Star Wars Sapphire', 'Star Wars Hyperspace',
  'Star Wars Galactic', 'Star Wars Unlimited', 'Star Wars CCG',
  'Star Wars Young Jedi', 'Star Wars Stellar', 'Star Wars Ahsoka',
  'Star Wars Obi-Wan', 'Star Wars Andor', 'Star Wars Solo',
  'Star Wars Rebels', 'Star Wars Kakawow', 'Star Wars Illustrated',
  'Star Wars Evolution', 'Star Wars Bounty', 'Star Wars Living Set',
  'Star Wars Archives', 'Star Wars Sketch', 'Star Wars Topps Now',
  'Star Wars Signature', 'Star Wars Authentics', 'Star Wars Journey',
  'Star Wars Card Trader', 'Star Wars Vehicles', 'Star Wars Battle Plans',
  'Star Wars Jedi Legacy', 'Star Wars 30th Anniversary',
  'Star Wars Luke Skywalker', 'Star Wars Darth Vader', 'Star Wars Boba Fett',
  'Star Wars Grogu', 'Star Wars Rey', 'Star Wars Kylo Ren',
  'Star Wars Sticker', 'Star Wars Autograph', 'Star Wars Book Boba',
];

// Exclusion patterns for non-card products
const EXCLUDED_CONSOLE_PATTERNS = [
  'funko pop', 'lego', 'comic book', 'action figure', 'toy',
  'board game', 'video game', 'blu-ray', 'dvd', 'book',
  'poster', 'magazine', 'novel', 'soundtrack', 'vinyl',
];

// ============================================================================
// Utility functions
// ============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatTime(date) {
  return date.toLocaleTimeString();
}

function getElapsedTime(startTime) {
  var elapsed = Date.now() - startTime;
  var seconds = Math.floor(elapsed / 1000);
  var minutes = Math.floor(seconds / 60);
  var hours = Math.floor(minutes / 60);
  if (hours > 0) return hours + 'h ' + (minutes % 60) + 'm ' + (seconds % 60) + 's';
  if (minutes > 0) return minutes + 'm ' + (seconds % 60) + 's';
  return seconds + 's';
}

function penniesToDollars(pennies) {
  if (pennies === undefined || pennies === null || pennies === 0) return null;
  return pennies / 100;
}

function extractCardNumber(productName) {
  if (!productName) return null;
  var hashMatch = productName.match(/#([A-Za-z0-9-]+)/);
  if (hashMatch) return hashMatch[1];
  var noMatch = productName.match(/\bNo\.?\s*(\d+)\b/i);
  if (noMatch) return noMatch[1];
  return null;
}

function generateSetSlug(consoleName) {
  if (!consoleName) return 'unknown';
  return consoleName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function getSetType(setName) {
  if (!setName) return 'base';
  var lower = setName.toLowerCase();
  if (lower.includes('chrome')) return 'chrome';
  if (lower.includes('insert')) return 'insert';
  if (lower.includes('promo')) return 'promo';
  if (lower.includes('sketch')) return 'sketch';
  if (lower.includes('autograph') || lower.includes('signature')) return 'autograph';
  if (lower.includes('parallel') || lower.includes('refractor')) return 'parallel';
  if (lower.includes('masterwork') || lower.includes('stellar') || lower.includes('high tek') || lower.includes('finest')) return 'premium';
  if (lower.includes('sticker')) return 'sticker';
  if (lower.includes('unlimited') || lower.includes('ccg') || lower.includes('young jedi')) return 'ccg';
  return 'base';
}

function isExcludedProduct(consoleName) {
  var lower = (consoleName || '').toLowerCase();
  for (var i = 0; i < EXCLUDED_CONSOLE_PATTERNS.length; i++) {
    if (lower.includes(EXCLUDED_CONSOLE_PATTERNS[i])) return true;
  }
  return false;
}

/**
 * Fetch products from PriceCharting API with retry
 */
async function fetchProducts(query, page, retries) {
  if (page === undefined) page = 1;
  if (retries === undefined) retries = 3;
  var url = API_BASE_URL + '/products?t=' + apiKey + '&q=' + encodeURIComponent(query) + '&limit=' + PRODUCTS_PER_PAGE + '&page=' + page;

  for (var attempt = 1; attempt <= retries; attempt++) {
    try {
      var response = await fetch(url);
      if (response.status === 429) {
        var backoff = 10000 * attempt;
        console.log('    Rate limited, waiting ' + (backoff / 1000) + 's...');
        await sleep(backoff);
        continue;
      }
      if (!response.ok) throw new Error('API error: ' + response.status);
      var data = await response.json();
      if (data.status !== 'success' || !data.products) return [];
      return data.products;
    } catch (error) {
      if (attempt < retries) {
        var wait = 5000 * attempt;
        console.log('    Attempt ' + attempt + ' failed: ' + error.message + ', retrying in ' + (wait / 1000) + 's...');
        await sleep(wait);
      } else {
        throw error;
      }
    }
  }
  return [];
}

// ============================================================================
// Phase 1: Discovery — find all unique Star Wars console-names
// ============================================================================

async function discoverSets() {
  console.log('\n=== Phase 1: Discovering Star Wars Sets ===\n');
  var startTime = Date.now();
  var allConsoleNames = new Set();

  for (var i = 0; i < DISCOVERY_QUERIES.length; i++) {
    var query = DISCOVERY_QUERIES[i];
    process.stdout.write('[' + (i + 1) + '/' + DISCOVERY_QUERIES.length + '] "' + query + '"...');

    try {
      var products = await fetchProducts(query, 1);
      var swProducts = products.filter(function(p) {
        var genre = (p.genre || '').toLowerCase();
        var cn = (p['console-name'] || '').toLowerCase();
        return (genre.includes('star wars') || cn.includes('star wars')) && !isExcludedProduct(p['console-name']);
      });

      var newSets = 0;
      swProducts.forEach(function(p) {
        var cn = p['console-name'];
        if (cn && !allConsoleNames.has(cn)) {
          allConsoleNames.add(cn);
          newSets++;
        }
      });

      console.log(' ' + swProducts.length + ' cards, ' + newSets + ' new sets (total: ' + allConsoleNames.size + ')');
    } catch (error) {
      console.log(' ERROR: ' + error.message);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  var setNames = Array.from(allConsoleNames).sort();
  console.log('\nDiscovery complete: ' + setNames.length + ' unique sets found (' + getElapsedTime(startTime) + ')');
  return setNames;
}

// ============================================================================
// Phase 2: Import — paginate through every card in each set
// ============================================================================

async function fetchAllCardsForSet(setName) {
  var allProducts = [];
  var page = 1;

  while (page <= MAX_PAGES_PER_SET) {
    var products = await fetchProducts(setName, page);
    if (products.length === 0) break;

    // Filter to exact console-name match
    var matched = products.filter(function(p) {
      return p['console-name'] === setName;
    });
    allProducts = allProducts.concat(matched);

    // If we got fewer than the limit, no more pages
    if (products.length < PRODUCTS_PER_PAGE) break;

    page++;
    await sleep(REQUEST_DELAY_MS);
  }

  return allProducts;
}

async function importSets(cardsMap) {
  console.log('\n=== Importing Star Wars Sets ===\n');
  var startTime = Date.now();
  var setsMap = new Map();

  cardsMap.forEach(function(card) {
    var consoleName = card['console-name'] || '';
    var setSlug = generateSetSlug(consoleName);
    if (setSlug && !setsMap.has(setSlug)) {
      setsMap.set(setSlug, {
        id: setSlug,
        name: consoleName,
        set_type: getSetType(consoleName),
        total_cards: 0,
        release_date: card['release-date'] || null,
        genre: card.genre || 'Star Wars Card',
        updated_at: new Date().toISOString(),
      });
    }
    if (setSlug && setsMap.has(setSlug)) {
      setsMap.get(setSlug).total_cards++;
    }
  });

  var sets = Array.from(setsMap.values());
  console.log('Found ' + sets.length + ' unique sets');

  var imported = 0, errors = 0;
  for (var i = 0; i < sets.length; i += BATCH_SIZE) {
    var batch = sets.slice(i, i + BATCH_SIZE);
    try {
      var result = await supabase.from('starwars_sets').upsert(batch, { onConflict: 'id' });
      if (result.error) { errors += batch.length; console.error('  Set batch error:', result.error.message); }
      else imported += batch.length;
    } catch (e) { errors += batch.length; }
  }

  console.log('Sets import: ' + imported + ' imported, ' + errors + ' errors (' + getElapsedTime(startTime) + ')');
  return { imported: imported, errors: errors };
}

async function importCards(cardsMap) {
  console.log('\n=== Importing Star Wars Cards ===\n');
  var startTime = Date.now();
  var totalImported = 0, totalErrors = 0;
  var cards = Array.from(cardsMap.values());
  console.log('Processing ' + cards.length + ' unique cards...');

  for (var i = 0; i < cards.length; i += BATCH_SIZE) {
    var batch = cards.slice(i, i + BATCH_SIZE);
    var cardBatch = batch.map(function(product) {
      var consoleName = product['console-name'] || '';
      return {
        id: String(product.id),
        card_name: product['product-name'] || 'Unknown',
        card_number: extractCardNumber(product['product-name']),
        set_id: generateSetSlug(consoleName) || null,
        console_name: consoleName || null,
        genre: product.genre || null,
        release_date: product['release-date'] || null,
        loose_price: penniesToDollars(product['loose-price']),
        cib_price: penniesToDollars(product['cib-price']),
        new_price: penniesToDollars(product['new-price']),
        graded_price: penniesToDollars(product['graded-price']),
        box_only_price: penniesToDollars(product['box-only-price']),
        manual_only_price: penniesToDollars(product['manual-only-price']),
        bgs_10_price: penniesToDollars(product['bgs-10-price']),
        psa_1_price: penniesToDollars(product['psa-1-price']),
        psa_2_price: penniesToDollars(product['psa-2-price']),
        psa_3_price: penniesToDollars(product['psa-3-price']),
        psa_4_price: penniesToDollars(product['psa-4-price']),
        psa_5_price: penniesToDollars(product['psa-5-price']),
        psa_6_price: penniesToDollars(product['psa-6-price']),
        psa_7_price: penniesToDollars(product['psa-7-price']),
        psa_8_price: penniesToDollars(product['psa-8-price']),
        psa_9_price: penniesToDollars(product['psa-9-price']),
        psa_10_price: penniesToDollars(product['psa-10-price']),
        sales_volume: product['sales-volume'] || null,
        set_name: consoleName || null,
        pricecharting_id: String(product.id),
        updated_at: new Date().toISOString(),
      };
    });

    try {
      var result = await supabase.from('starwars_cards').upsert(cardBatch, { onConflict: 'id' });
      if (result.error) { totalErrors += batch.length; console.error('  Card batch error:', result.error.message); }
      else totalImported += batch.length;

      var progress = Math.round(((i + batch.length) / cards.length) * 100);
      if (progress % 5 === 0 || i + batch.length >= cards.length) {
        console.log('  Progress: ' + totalImported.toLocaleString() + ' cards (' + progress + '%)');
      }
    } catch (e) {
      totalErrors += batch.length;
      console.error('  Error:', e.message);
    }
    await sleep(50);
  }

  console.log('\nCards import: ' + totalImported.toLocaleString() + ' imported, ' + totalErrors + ' errors (' + getElapsedTime(startTime) + ')');
  return { imported: totalImported, errors: totalErrors };
}

async function verifyImport() {
  console.log('\n=== Verifying Import ===\n');

  var { count: setsCount } = await supabase.from('starwars_sets').select('*', { count: 'exact', head: true });
  var { count: cardsCount } = await supabase.from('starwars_cards').select('*', { count: 'exact', head: true });

  console.log('Database totals:');
  console.log('  Sets: ' + setsCount);
  console.log('  Cards: ' + (cardsCount || 0).toLocaleString());

  // Test lookups
  var { data: luke } = await supabase.from('starwars_cards').select('card_name, set_name, loose_price').ilike('card_name', '%Luke Skywalker%').limit(5);
  console.log('\nSample: Luke Skywalker (' + (luke ? luke.length : 0) + ' results)');
  if (luke) luke.forEach(function(c) { console.log('  ' + c.card_name + ' | ' + c.set_name + ' | $' + (c.loose_price || 'N/A')); });

  // Top sets
  var { data: topSets } = await supabase.from('starwars_sets').select('name, total_cards').order('total_cards', { ascending: false }).limit(15);
  console.log('\nTop 15 sets:');
  if (topSets) topSets.forEach(function(s) { console.log('  ' + s.name + ': ' + s.total_cards.toLocaleString() + ' cards'); });

  return { setsCount: setsCount, cardsCount: cardsCount };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  var args = process.argv.slice(2);
  var testMode = args.includes('--test');
  var discoverOnly = args.includes('--discover-only');

  console.log('================================================');
  console.log('   Star Wars Cards Database Import v2');
  console.log('================================================');
  console.log('Started at: ' + formatTime(new Date()));
  console.log('Mode: ' + (discoverOnly ? 'discover-only' : testMode ? 'test' : 'full'));
  console.log('API: PriceCharting (pricecharting.com)');
  console.log('================================================');

  var overallStart = Date.now();

  try {
    // Phase 1: Discover all set names
    var setNames = await discoverSets();

    if (discoverOnly) {
      console.log('\n=== All Discovered Sets ===');
      setNames.forEach(function(name, i) { console.log((i + 1) + '. ' + name); });
      console.log('\nTotal: ' + setNames.length + ' sets');
      return;
    }

    var setsToImport = testMode ? setNames.slice(0, 3) : setNames;
    console.log('\n=== Phase 2: Importing ' + setsToImport.length + ' Sets ===\n');

    // Phase 2: Import all cards from each set
    var allCardsMap = new Map();
    var setsProcessed = 0;
    var setsWithCards = 0;

    for (var i = 0; i < setsToImport.length; i++) {
      var setName = setsToImport[i];
      setsProcessed++;
      process.stdout.write('[' + setsProcessed + '/' + setsToImport.length + '] ' + setName + '...');

      try {
        var products = await fetchAllCardsForSet(setName);

        if (products.length > 0) {
          setsWithCards++;
          var newCards = 0;
          products.forEach(function(p) {
            var pid = String(p.id);
            if (!allCardsMap.has(pid)) {
              allCardsMap.set(pid, p);
              newCards++;
            }
          });
          console.log(' ' + products.length.toLocaleString() + ' cards (' + newCards.toLocaleString() + ' new) — total: ' + allCardsMap.size.toLocaleString());
        } else {
          console.log(' 0 cards');
        }
      } catch (error) {
        console.log(' ERROR: ' + error.message);
      }

      await sleep(SET_DELAY_MS);
    }

    console.log('\n================================================');
    console.log('Fetching complete!');
    console.log('  Sets processed: ' + setsProcessed);
    console.log('  Sets with cards: ' + setsWithCards);
    console.log('  Total unique cards: ' + allCardsMap.size.toLocaleString());
    console.log('================================================');

    // Import to database
    var setsResult = await importSets(allCardsMap);
    var cardsResult = await importCards(allCardsMap);
    await verifyImport();

    // Log
    try {
      await supabase.from('starwars_import_log').insert({
        import_type: testMode ? 'test' : 'full',
        sets_imported: setsResult.imported,
        cards_imported: cardsResult.imported,
        status: 'completed',
        completed_at: new Date().toISOString(),
      });
    } catch (e) {}

    console.log('\n================================================');
    console.log('   Import Complete!');
    console.log('================================================');
    console.log('Total time: ' + getElapsedTime(overallStart));
    console.log('Sets: ' + setsResult.imported + ' imported');
    console.log('Cards: ' + cardsResult.imported.toLocaleString() + ' imported');
    console.log('================================================\n');

  } catch (error) {
    console.error('\nIMPORT FAILED: ' + error.message);
    try {
      await supabase.from('starwars_import_log').insert({
        import_type: testMode ? 'test' : 'full',
        status: 'failed',
        error_message: error.message,
      });
    } catch (e) {}
    process.exit(1);
  }
}

main();
