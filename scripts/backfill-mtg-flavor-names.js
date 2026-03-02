/**
 * Backfill flavor_name for MTG cards (Universes Beyond, Secret Lair crossovers)
 *
 * Uses Scryfall's search API to find all cards with flavor_name,
 * then updates just the flavor_name column in our database.
 *
 * Usage:
 *   node scripts/backfill-mtg-flavor-names.js
 *
 * This is much faster than a full re-import since it only touches
 * cards that have a flavor_name (crossover/alternate name).
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const SCRYFALL_API_BASE = 'https://api.scryfall.com';
const REQUEST_DELAY_MS = 100;

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

async function fetchFromApi(url, retries = 3) {
  const fullUrl = url.startsWith('http') ? url : `${SCRYFALL_API_BASE}${url}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(fullUrl);

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
        await sleep(1000 * attempt);
      } else {
        throw error;
      }
    }
  }
}

async function main() {
  console.log('=== Backfilling MTG flavor_name ===\n');
  console.log('Searching Scryfall for cards with flavor_name...\n');

  const startTime = Date.now();
  let allCards = [];
  let page = 1;

  // Scryfall search: "has:flavor_name" returns all cards with a crossover/alternate name
  let nextUrl = `/cards/search?q=has%3Aflavor_name&unique=prints&order=set`;

  while (nextUrl) {
    console.log(`  Fetching page ${page}...`);
    const data = await fetchFromApi(nextUrl);

    if (!data || !data.data) {
      console.error('  No data returned from Scryfall');
      break;
    }

    allCards = allCards.concat(data.data);
    console.log(`  Got ${data.data.length} cards (total: ${allCards.length}/${data.total_cards || '?'})`);

    if (data.has_more && data.next_page) {
      nextUrl = data.next_page;
      page++;
      await sleep(REQUEST_DELAY_MS);
    } else {
      nextUrl = null;
    }
  }

  console.log(`\nFound ${allCards.length} cards with flavor_name\n`);

  // Update in batches
  const BATCH_SIZE = 50;
  let updated = 0;
  let notFound = 0;
  let errors = 0;

  // Group by set for logging
  const setGroups = {};
  for (const card of allCards) {
    if (!setGroups[card.set_name]) {
      setGroups[card.set_name] = [];
    }
    setGroups[card.set_name].push(card);
  }

  console.log('Sets with flavor_name cards:');
  for (const [setName, cards] of Object.entries(setGroups)) {
    console.log(`  ${setName}: ${cards.length} cards`);
  }
  console.log('');

  for (let i = 0; i < allCards.length; i += BATCH_SIZE) {
    const batch = allCards.slice(i, i + BATCH_SIZE);

    for (const card of batch) {
      if (!card.flavor_name) continue;

      const { error } = await supabase
        .from('mtg_cards')
        .update({ flavor_name: card.flavor_name })
        .eq('id', card.id);

      if (error) {
        // Card might not exist in our DB yet
        if (error.code === 'PGRST116') {
          notFound++;
        } else {
          errors++;
          if (errors <= 5) {
            console.error(`  Error updating ${card.name} (${card.set}/${card.collector_number}): ${error.message}`);
          }
        }
      } else {
        updated++;
      }
    }

    if ((i + BATCH_SIZE) % 200 === 0 || i + BATCH_SIZE >= allCards.length) {
      console.log(`  Progress: ${Math.min(i + BATCH_SIZE, allCards.length)}/${allCards.length} processed (${updated} updated)`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== Backfill Complete ===`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Not in DB: ${notFound}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Time: ${elapsed}s`);

  // Show a few examples
  console.log('\nSample flavor_name entries in DB:');
  const { data: samples } = await supabase
    .from('mtg_cards')
    .select('name, flavor_name, set_name, collector_number')
    .not('flavor_name', 'is', null)
    .limit(10);

  if (samples && samples.length > 0) {
    for (const s of samples) {
      console.log(`  ${s.flavor_name} (${s.name}) — ${s.set_name} #${s.collector_number}`);
    }
  } else {
    console.log('  No flavor_name entries found — sets may not be imported yet.');
    console.log('  Run: node scripts/import-mtg-database.js --set <code> for crossover sets first.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
