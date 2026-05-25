/**
 * Read-only freshness inquiry for MTG, Lorcana, and One Piece.
 *
 * For each game: compares our internal sets table against the relevant
 * external API and reports total counts, the newest set on each side,
 * sets present in the API but missing from our DB, and orphaned sets
 * we have that the API has dropped or renamed.
 *
 * Does NOT write anything. Use scripts/import-{mtg,lorcana,onepiece}-database.js
 * to actually pull updates.
 *
 * Usage: node scripts/check-tcg-db-freshness.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function divider(title) {
  console.log('\n' + '='.repeat(62));
  console.log(`  ${title}`);
  console.log('='.repeat(62));
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return res.json();
}

// ---------- MTG (Scryfall) ----------
async function checkMtg() {
  divider('MTG vs Scryfall API');

  const { count: dbSetCount } = await supabase
    .from('mtg_sets').select('id', { count: 'exact', head: true });
  const { count: dbCardCount } = await supabase
    .from('mtg_cards').select('id', { count: 'exact', head: true });

  // Pull DB sets for diff
  const { data: dbSets } = await supabase
    .from('mtg_sets')
    .select('id, code, name, released_at, card_count, digital, set_type')
    .order('released_at', { ascending: false });

  const api = await fetchJson('https://api.scryfall.com/sets');
  const apiSets = api.data || [];

  // We typically skip digital-only sets when importing, but our DB includes them
  // if they were ever picked up. Show both filtered and unfiltered counts.
  const apiPhysical = apiSets.filter(s => !s.digital);

  console.log(`Sets:  DB ${dbSetCount}  |  API total ${apiSets.length} (physical: ${apiPhysical.length})`);
  console.log(`Cards: DB ${dbCardCount}  |  API (Scryfall doesn't expose a global count, use per-set)`);

  // Diff by code (more stable than id across renamings)
  const dbCodes = new Set(dbSets.map(s => s.code));
  const apiCodes = new Set(apiSets.map(s => s.code));
  const apiNotInDb = apiSets.filter(s => !dbCodes.has(s.code));
  const dbNotInApi = dbSets.filter(s => !apiCodes.has(s.code));

  // Cap "missing" list to last 90 days so the output is digestible for MTG
  // (Scryfall lists ~750 historical sets — only the recent ones matter).
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const recentMissing = apiNotInDb
    .filter(s => s.released_at && new Date(s.released_at) >= cutoff)
    .sort((a, b) => (b.released_at || '').localeCompare(a.released_at || ''));
  // Physical-only count for the summary line — digital-only sets aren't
  // ones our importer pulls into mtg_cards, so flagging them as actionable
  // generates noise (we intentionally skip them).
  const recentMissingPhysical = recentMissing.filter(s => !s.digital);

  console.log(`\nMost recent DB set:  ${(dbSets[0]?.name || '?').padEnd(35)} ${dbSets[0]?.released_at || '?'}`);
  const newestApi = [...apiSets].sort((a, b) => (b.released_at || '').localeCompare(a.released_at || ''))[0];
  console.log(`Most recent API set: ${(newestApi?.name || '?').padEnd(35)} ${newestApi?.released_at || '?'}`);

  console.log(`\nAPI sets missing from DB total: ${apiNotInDb.length}`);
  console.log(`  (within last 90 days: ${recentMissing.length})`);
  if (recentMissing.length > 0) {
    recentMissing.slice(0, 15).forEach(s => {
      const flag = s.digital ? ' [DIGITAL]' : '';
      console.log(`    ${s.released_at}  ${s.code.padEnd(8)} ${(s.name || '').padEnd(40)} ${s.card_count || '?'} cards${flag}`);
    });
    if (recentMissing.length > 15) console.log(`    ... and ${recentMissing.length - 15} more recent sets`);
  }

  if (dbNotInApi.length > 0) {
    console.log(`\nSets in DB but not in API: ${dbNotInApi.length}`);
    dbNotInApi.slice(0, 5).forEach(s => {
      console.log(`    ${s.released_at || '?'}  ${(s.code || '').padEnd(8)} ${s.name}`);
    });
    if (dbNotInApi.length > 5) console.log(`    ... and ${dbNotInApi.length - 5} more`);
  }

  return { hasMissing: recentMissingPhysical.length > 0, count: recentMissingPhysical.length };
}

// ---------- Lorcana (Lorcast) ----------
async function checkLorcana() {
  divider('Lorcana vs Lorcast API');

  const { count: dbSetCount } = await supabase
    .from('lorcana_sets').select('id', { count: 'exact', head: true });
  const { count: dbCardCount } = await supabase
    .from('lorcana_cards').select('id', { count: 'exact', head: true });

  const { data: dbSets } = await supabase
    .from('lorcana_sets')
    .select('id, code, name, released_at, total_cards')
    .order('released_at', { ascending: false });

  const api = await fetchJson('https://api.lorcast.com/v0/sets');
  // Lorcast returns { results: [...] } in some versions or top-level array in others.
  const apiSets = api.results || api.data || api;
  const apiList = Array.isArray(apiSets) ? apiSets : [];

  console.log(`Sets:  DB ${dbSetCount}  |  API ${apiList.length}`);
  console.log(`Cards: DB ${dbCardCount}`);

  const dbCodes = new Set(dbSets.map(s => s.code));
  const apiNotInDb = apiList.filter(s => !dbCodes.has(s.code));
  const apiCodes = new Set(apiList.map(s => s.code));
  const dbNotInApi = dbSets.filter(s => !apiCodes.has(s.code));

  console.log(`\nMost recent DB set:  ${(dbSets[0]?.name || '?').padEnd(35)} ${dbSets[0]?.released_at || '?'}`);
  const newestApi = [...apiList].sort((a, b) => (b.released_at || '').localeCompare(a.released_at || ''))[0];
  console.log(`Most recent API set: ${(newestApi?.name || '?').padEnd(35)} ${newestApi?.released_at || '?'}`);

  console.log(`\nAPI sets missing from DB: ${apiNotInDb.length}`);
  apiNotInDb
    .sort((a, b) => (b.released_at || '').localeCompare(a.released_at || ''))
    .forEach(s => {
      console.log(`    ${s.released_at || '?'}  ${(s.code || '').padEnd(8)} ${s.name}`);
    });

  if (dbNotInApi.length > 0) {
    console.log(`\nSets in DB but not in API: ${dbNotInApi.length}`);
    dbNotInApi.forEach(s => {
      console.log(`    ${s.released_at || '?'}  ${(s.code || '').padEnd(8)} ${s.name}`);
    });
  }

  return { hasMissing: apiNotInDb.length > 0, count: apiNotInDb.length };
}

// ---------- One Piece (OPTCG API) ----------
async function checkOnePiece() {
  divider('One Piece vs OPTCG API');

  const { count: dbSetCount } = await supabase
    .from('onepiece_sets').select('id', { count: 'exact', head: true });
  const { count: dbCardCount } = await supabase
    .from('onepiece_cards').select('id', { count: 'exact', head: true });

  const { data: dbSets } = await supabase
    .from('onepiece_sets')
    .select('id, name, set_type, total_cards')
    .order('id');

  // OPTCG API doesn't have a /sets endpoint — we derive sets by aggregating
  // card data from TWO live endpoints (the previously-active /allPromoCards/
  // 404s now, retired some time after Jan 2026).
  //
  //   /allSetCards/  -> booster / expansion / premium booster sets
  //   /allSTCards/   -> starter deck sets (ST-01 .. ST-NN)
  //
  // Pulling only one would massively undercount and flag legitimate starter
  // decks as "missing from API" (which is what an earlier version did).
  const [boosterRes, starterRes] = await Promise.all([
    fetchJson('https://optcgapi.com/api/allSetCards/'),
    fetchJson('https://optcgapi.com/api/allSTCards/'),
  ]);
  const boosterCards = Array.isArray(boosterRes) ? boosterRes : (boosterRes.data || []);
  const starterCards = Array.isArray(starterRes) ? starterRes : (starterRes.data || []);
  const apiCardArray = [...boosterCards, ...starterCards];

  // Group by set
  const apiSetsMap = new Map();
  for (const c of apiCardArray) {
    const setId = c.set_id || c.setId || (c.card_set_id);
    if (!setId) continue;
    if (!apiSetsMap.has(setId)) {
      apiSetsMap.set(setId, { id: setId, name: c.set_name || setId, count: 0 });
    }
    apiSetsMap.get(setId).count++;
  }
  const apiSets = Array.from(apiSetsMap.values());

  console.log(`Sets:  DB ${dbSetCount}  |  API ${apiSets.length}  |  Diff ${apiSets.length - dbSetCount}`);
  console.log(`Cards: DB ${dbCardCount}  |  API total ${apiCardArray.length} (booster: ${boosterCards.length}, starter: ${starterCards.length})`);

  const dbIds = new Set(dbSets.map(s => s.id));
  const apiIds = new Set(apiSets.map(s => s.id));
  // OPTCG mixes IDs over time — recent hybrid IDs like "OP14-EB04" represent
  // sets we already store under split IDs (OP-14 and EB-04). Treat a name
  // match as equivalence so we don't keep flagging the same already-imported
  // sets as "missing".
  const dbNamesLc = new Set(dbSets.map(s => (s.name || '').toLowerCase().trim()).filter(Boolean));
  const apiNotInDb = apiSets.filter(s => !dbIds.has(s.id) && !dbNamesLc.has((s.name || '').toLowerCase().trim()));
  const dbNotInApi = dbSets.filter(s => !apiIds.has(s.id));

  // One Piece sets follow naming like OP01, OP10, ST01, etc. Sort by id desc
  // as a proxy for "newest" since there is no release_date column.
  console.log(`\nMost recent DB set (by id):  ${[...dbSets].sort((a, b) => b.id.localeCompare(a.id))[0]?.id || '?'}`);
  console.log(`Most recent API set (by id): ${[...apiSets].sort((a, b) => b.id.localeCompare(a.id))[0]?.id || '?'}`);

  console.log(`\nAPI sets missing from DB: ${apiNotInDb.length}`);
  apiNotInDb
    .sort((a, b) => b.id.localeCompare(a.id))
    .forEach(s => {
      console.log(`    ${s.id.padEnd(8)} ${s.name.padEnd(40)} ${s.count} cards`);
    });

  if (dbNotInApi.length > 0) {
    console.log(`\nSets in DB but not in API: ${dbNotInApi.length}`);
    dbNotInApi.forEach(s => {
      console.log(`    ${s.id.padEnd(8)} ${s.name}`);
    });
  }

  // Per-set card count drift on overlapping sets
  const drifts = [];
  for (const dbSet of dbSets) {
    const apiSet = apiSetsMap.get(dbSet.id);
    if (!apiSet) continue;
    if ((dbSet.total_cards || 0) !== apiSet.count) {
      drifts.push({ id: dbSet.id, name: dbSet.name, db: dbSet.total_cards || 0, api: apiSet.count });
    }
  }
  if (drifts.length > 0) {
    console.log(`\nSets with card-count drift (top 10 by gap):`);
    drifts.sort((a, b) => Math.abs(b.api - b.db) - Math.abs(a.api - a.db));
    drifts.slice(0, 10).forEach(d => {
      console.log(`    ${d.id.padEnd(8)} ${d.name.padEnd(35)} DB=${d.db} API=${d.api}`);
    });
  }

  return { hasMissing: apiNotInDb.length > 0, count: apiNotInDb.length };
}

async function main() {
  const results = {};
  try { results.mtg = await checkMtg(); }
  catch (e) { console.error('\nMTG check failed:', e.message); results.mtg = { error: e.message }; }
  try { results.lorcana = await checkLorcana(); }
  catch (e) { console.error('\nLorcana check failed:', e.message); results.lorcana = { error: e.message }; }
  try { results.onepiece = await checkOnePiece(); }
  catch (e) { console.error('\nOne Piece check failed:', e.message); results.onepiece = { error: e.message }; }

  divider('Summary');
  const actions = [];
  if (results.mtg?.hasMissing) actions.push(`MTG: ${results.mtg.count} recent sets missing -> node scripts/import-mtg-database.js`);
  if (results.lorcana?.hasMissing) actions.push(`Lorcana: ${results.lorcana.count} sets missing -> node scripts/import-lorcana-database.js`);
  if (results.onepiece?.hasMissing) actions.push(`One Piece: ${results.onepiece.count} sets missing -> node scripts/import-onepiece-database.js`);
  if (actions.length === 0) {
    console.log('  All TCG databases are in sync with their respective APIs.');
  } else {
    actions.forEach(a => console.log(`  ${a}`));
  }
}

main().catch(e => { console.error('Fatal:', e?.message || e); process.exit(1); });
