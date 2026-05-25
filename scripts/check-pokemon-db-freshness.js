/**
 * Read-only inquiry: compare our internal Pokemon DB against the
 * pokemontcg.io API to see what's new, missing, or stale.
 *
 * Does NOT write anything. Use scripts/import-pokemon-database.js to
 * actually pull updates.
 *
 * Usage: node scripts/check-pokemon-db-freshness.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const POKEMON_API_BASE = 'https://api.pokemontcg.io/v2';
const POKEMON_API_KEY = process.env.POKEMON_TCG_API_KEY || '';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function fetchApi(endpoint) {
  const url = `${POKEMON_API_BASE}${endpoint}`;
  const headers = POKEMON_API_KEY ? { 'X-Api-Key': POKEMON_API_KEY } : {};
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`API ${res.status}: ${endpoint}`);
  return res.json();
}

async function main() {
  // --- 1. DB: counts of sets + cards ---
  const { count: dbSetCount } = await supabase
    .from('pokemon_sets')
    .select('id', { count: 'exact', head: true });
  const { count: dbCardCount } = await supabase
    .from('pokemon_cards')
    .select('id', { count: 'exact', head: true });

  // Pull all DB set ids + release dates for diff (sets table is small, OK to load).
  const { data: dbSets } = await supabase
    .from('pokemon_sets')
    .select('id, name, release_date, total, printed_total')
    .order('release_date', { ascending: false });

  // --- 2. API: counts of sets + cards ---
  const apiSetsRes = await fetchApi('/sets?orderBy=-releaseDate&pageSize=250');
  const apiSets = apiSetsRes.data || [];

  // For total card count, do a totalCount-only query (page size 1, just to
  // read the totalCount header from the JSON).
  const apiCardCountRes = await fetchApi('/cards?pageSize=1');
  const apiCardCount = apiCardCountRes.totalCount ?? 0;

  // --- 3. Diff sets ---
  const dbSetIds = new Set(dbSets.map(s => s.id));
  const apiSetIds = new Set(apiSets.map(s => s.id));

  const missingFromDb = apiSets.filter(s => !dbSetIds.has(s.id));
  const orphanedInDb = dbSets.filter(s => !apiSetIds.has(s.id));

  // --- 4. Print summary ---
  console.log('=================================================');
  console.log('  POKEMON DB vs POKEMONTCG.IO API');
  console.log('=================================================');
  console.log(`Sets:  DB has ${dbSetCount}  |  API has ${apiSets.length}  |  Diff ${apiSets.length - dbSetCount}`);
  console.log(`Cards: DB has ${dbCardCount}  |  API has ${apiCardCount}  |  Diff ${apiCardCount - dbCardCount}`);
  console.log('');

  // Latest DB release date for context
  const newestDbSet = dbSets[0];
  if (newestDbSet) {
    console.log(`Newest set in DB:  ${newestDbSet.name} (${newestDbSet.release_date}) — ${newestDbSet.total} cards`);
  }
  const newestApiSet = apiSets[0];
  if (newestApiSet) {
    console.log(`Newest set in API: ${newestApiSet.name} (${newestApiSet.releaseDate}) — ${newestApiSet.total} cards`);
  }
  console.log('');

  // --- 5. Sets present in API but not in our DB ---
  if (missingFromDb.length === 0) {
    console.log('Sets missing from DB: NONE — all API sets are present.');
  } else {
    console.log(`Sets in API but NOT in DB (${missingFromDb.length}):`);
    console.log('  (newer additions on top — these are what an --incremental run would pull)');
    missingFromDb
      .sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''))
      .forEach(s => {
        console.log(`  - ${s.releaseDate}  ${s.id.padEnd(14)} ${s.name.padEnd(40)} ${s.total} cards`);
      });
  }
  console.log('');

  // --- 6. Sets in DB but no longer in API (rare — would indicate retracted sets) ---
  if (orphanedInDb.length > 0) {
    console.log(`Sets in DB but not in API (${orphanedInDb.length}) — likely fine, but worth knowing:`);
    orphanedInDb.slice(0, 10).forEach(s => {
      console.log(`  - ${s.release_date}  ${s.id}  ${s.name}`);
    });
    if (orphanedInDb.length > 10) console.log(`  ... and ${orphanedInDb.length - 10} more`);
    console.log('');
  }

  // --- 7. Per-set card count diff for sets that exist in both ---
  console.log('Sets where DB card count differs from API total (top 10 by gap):');
  const setCardDiffs = [];
  for (const dbSet of dbSets) {
    const apiSet = apiSets.find(s => s.id === dbSet.id);
    if (!apiSet) continue;
    if (apiSet.total !== dbSet.total) {
      setCardDiffs.push({
        id: dbSet.id,
        name: dbSet.name,
        db_total: dbSet.total,
        api_total: apiSet.total,
        gap: apiSet.total - (dbSet.total || 0),
      });
    }
  }
  setCardDiffs.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
  if (setCardDiffs.length === 0) {
    console.log('  (none — all set totals match)');
  } else {
    setCardDiffs.slice(0, 10).forEach(d => {
      const sign = d.gap > 0 ? '+' : '';
      console.log(`  ${d.id.padEnd(14)} ${d.name.padEnd(40)} DB=${d.db_total} API=${d.api_total} (${sign}${d.gap})`);
    });
    if (setCardDiffs.length > 10) console.log(`  ... and ${setCardDiffs.length - 10} more`);
  }
  console.log('');

  // --- 8. Recommendation ---
  console.log('=================================================');
  if (missingFromDb.length === 0 && setCardDiffs.length === 0 && apiCardCount === dbCardCount) {
    console.log('  All in sync. Nothing to import.');
  } else {
    console.log('  Recommended actions:');
    if (missingFromDb.length > 0) {
      console.log(`    - ${missingFromDb.length} new sets to import. Run:`);
      console.log(`        node scripts/import-pokemon-database.js --incremental`);
    }
    if (setCardDiffs.length > 0) {
      console.log(`    - ${setCardDiffs.length} sets have card-count drift. A full import refreshes everything:`);
      console.log(`        node scripts/import-pokemon-database.js --full`);
    }
  }
  console.log('=================================================');
}

main().catch((e) => { console.error('Fatal:', e?.message || e); process.exit(1); });
