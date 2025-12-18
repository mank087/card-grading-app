/**
 * Japanese Pokemon Cards Import Script
 *
 * Fetches Japanese Pokemon TCG cards from TCGdex API and imports into Supabase.
 *
 * Usage:
 *   node scripts/import-japanese-pokemon.js [--sets-only] [--limit=N] [--set=SET_ID]
 *
 * Options:
 *   --sets-only   Only import sets, skip cards
 *   --limit=N     Limit to N sets (for testing)
 *   --set=ID      Import only a specific set
 *   --dry-run     Don't write to database, just log what would be imported
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// TCGdex API base URL
const TCGDEX_BASE = 'https://api.tcgdex.net/v2/ja';

// Parse command line arguments
const args = process.argv.slice(2);
const setsOnly = args.includes('--sets-only');
const dryRun = args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit='));
const setArg = args.find(a => a.startsWith('--set='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;
const specificSet = setArg ? setArg.split('=')[1] : null;

// Rate limiting helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch with retry
async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.warn(`   ⚠️ Fetch failed (attempt ${i + 1}/${retries}): ${error.message}`);
      if (i < retries - 1) {
        await sleep(1000 * (i + 1)); // Exponential backoff
      } else {
        throw error;
      }
    }
  }
}

// Fetch all Japanese sets
async function fetchSets() {
  console.log('📦 Fetching Japanese sets from TCGdex...');
  const sets = await fetchWithRetry(`${TCGDEX_BASE}/sets`);
  console.log(`   Found ${sets.length} sets`);
  return sets;
}

// Fetch detailed set info
async function fetchSetDetails(setId) {
  return await fetchWithRetry(`${TCGDEX_BASE}/sets/${setId}`);
}

// Fetch all cards for a set
async function fetchCardsForSet(setId) {
  const cards = await fetchWithRetry(`${TCGDEX_BASE}/sets/${setId}`);
  return cards.cards || [];
}

// Fetch detailed card info
async function fetchCardDetails(cardId) {
  return await fetchWithRetry(`${TCGDEX_BASE}/cards/${cardId}`);
}

// Import sets into Supabase
async function importSets(sets) {
  console.log('\n📥 Importing sets into Supabase...');

  let imported = 0;
  let errors = 0;

  for (const set of sets) {
    try {
      // Fetch detailed set info
      const details = await fetchSetDetails(set.id);

      const setData = {
        id: set.id,
        name: set.name || details.name,
        name_english: null, // TCGdex doesn't always have English names
        series: details.serie?.name || null,
        printed_total: details.cardCount?.official || details.cardCount?.total || null,
        release_date: details.releaseDate || null,
        symbol_url: details.symbol || null,
        logo_url: details.logo || null,
        tcgdex_updated_at: new Date().toISOString(),
      };

      if (dryRun) {
        console.log(`   [DRY RUN] Would import set: ${set.id} - ${set.name}`);
      } else {
        const { error } = await supabase
          .from('pokemon_sets_ja')
          .upsert(setData, { onConflict: 'id' });

        if (error) {
          console.error(`   ❌ Error importing set ${set.id}: ${error.message}`);
          errors++;
        } else {
          console.log(`   ✅ Imported: ${set.id} - ${set.name}`);
          imported++;
        }
      }

      // Rate limiting
      await sleep(100);
    } catch (error) {
      console.error(`   ❌ Failed to process set ${set.id}: ${error.message}`);
      errors++;
    }
  }

  console.log(`\n📊 Sets import complete: ${imported} imported, ${errors} errors`);
  return { imported, errors };
}

// Import cards for a set
async function importCardsForSet(setId, setDetails) {
  const cards = setDetails.cards || [];
  console.log(`   📇 Processing ${cards.length} cards...`);

  let imported = 0;
  let errors = 0;

  for (const card of cards) {
    try {
      // Fetch detailed card info
      const details = await fetchCardDetails(card.id);

      const cardData = {
        id: card.id,
        name: details.name || card.name,
        name_english: null, // Will be populated by correlation later
        name_romanized: null,
        local_id: details.localId || card.localId,
        set_id: setId,
        dex_id: details.dexId ? [details.dexId] : null,
        supertype: details.category || null,
        subtypes: null,
        types: details.types || null,
        hp: details.hp || null,
        stage: details.stage || null,
        evolves_from: details.evolveFrom || null,
        rarity: details.rarity || null,
        illustrator: details.illustrator || null,
        description: details.description || null,
        regulation_mark: details.regulationMark || null,
        is_holo: details.variants?.holo || false,
        is_reverse: details.variants?.reverse || false,
        is_promo: details.variants?.promo || false,
        is_first_edition: details.variants?.firstEdition || false,
        image_url: details.image ? `${details.image}/high.webp` : (card.image ? `${card.image}/high.webp` : null),
        tcgplayer_url: details.pricing?.tcgplayer?.url || null,
        cardmarket_url: details.pricing?.cardmarket?.url || null,
        set_name: setDetails.name,
        set_name_english: null,
        set_series: setDetails.serie?.name || null,
        set_printed_total: setDetails.cardCount?.official || setDetails.cardCount?.total || null,
        set_release_date: setDetails.releaseDate || null,
        legal_standard: details.legal?.standard || false,
        legal_expanded: details.legal?.expanded || false,
        tcgdex_updated_at: new Date().toISOString(),
      };

      if (dryRun) {
        // Just count, don't log every card in dry run
        imported++;
      } else {
        const { error } = await supabase
          .from('pokemon_cards_ja')
          .upsert(cardData, { onConflict: 'id' });

        if (error) {
          console.error(`      ❌ Card ${card.id}: ${error.message}`);
          errors++;
        } else {
          imported++;
        }
      }

      // Rate limiting - be gentle with the API
      await sleep(50);
    } catch (error) {
      console.error(`      ❌ Failed to process card ${card.id}: ${error.message}`);
      errors++;
    }
  }

  return { imported, errors };
}

// Create import log entry
async function createImportLog(type) {
  if (dryRun) return { id: 'dry-run' };

  const { data, error } = await supabase
    .from('pokemon_import_log_ja')
    .insert({
      import_type: type,
      source: 'tcgdex',
      status: 'running'
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create import log:', error.message);
    return null;
  }
  return data;
}

// Update import log
async function updateImportLog(logId, updates) {
  if (dryRun || !logId || logId === 'dry-run') return;

  await supabase
    .from('pokemon_import_log_ja')
    .update({
      ...updates,
      completed_at: new Date().toISOString()
    })
    .eq('id', logId);
}

// Main import function
async function main() {
  console.log('🎴 Japanese Pokemon Cards Import');
  console.log('================================');
  console.log(`Source: TCGdex API (${TCGDEX_BASE})`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no database writes)' : 'LIVE'}`);
  if (limit) console.log(`Limit: ${limit} sets`);
  if (specificSet) console.log(`Specific set: ${specificSet}`);
  if (setsOnly) console.log(`Sets only: true`);
  console.log('');

  const startTime = Date.now();
  const log = await createImportLog(specificSet ? 'set_update' : 'full');

  try {
    // Fetch all sets
    let sets = await fetchSets();

    // Apply filters
    if (specificSet) {
      sets = sets.filter(s => s.id === specificSet);
      if (sets.length === 0) {
        console.error(`❌ Set not found: ${specificSet}`);
        process.exit(1);
      }
    }

    if (limit) {
      sets = sets.slice(0, limit);
      console.log(`   Limited to ${sets.length} sets`);
    }

    // Import sets
    const setResults = await importSets(sets);

    let totalCards = 0;
    let cardErrors = 0;

    // Import cards (unless sets-only mode)
    if (!setsOnly) {
      console.log('\n📥 Importing cards...');

      for (let i = 0; i < sets.length; i++) {
        const set = sets[i];
        console.log(`\n[${i + 1}/${sets.length}] Set: ${set.id} - ${set.name}`);

        try {
          const setDetails = await fetchSetDetails(set.id);
          const cardResults = await importCardsForSet(set.id, setDetails);
          totalCards += cardResults.imported;
          cardErrors += cardResults.errors;
          console.log(`   ✅ ${cardResults.imported} cards imported, ${cardResults.errors} errors`);
        } catch (error) {
          console.error(`   ❌ Failed to import cards for ${set.id}: ${error.message}`);
          cardErrors++;
        }

        // Rate limiting between sets
        await sleep(200);
      }
    }

    // Final summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n================================');
    console.log('📊 Import Complete!');
    console.log(`   Sets: ${setResults.imported} imported, ${setResults.errors} errors`);
    if (!setsOnly) {
      console.log(`   Cards: ${totalCards} imported, ${cardErrors} errors`);
    }
    console.log(`   Duration: ${duration}s`);
    console.log('================================');

    // Update log
    await updateImportLog(log?.id, {
      sets_imported: setResults.imported,
      cards_imported: totalCards,
      status: cardErrors > 0 || setResults.errors > 0 ? 'completed_with_errors' : 'completed'
    });

  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    await updateImportLog(log?.id, {
      status: 'failed',
      error_message: error.message
    });
    process.exit(1);
  }
}

// Run the import
main().catch(console.error);
