/**
 * Read-only freshness inquiry for MTG, Lorcana, One Piece, Yu-Gi-Oh,
 * Pokemon, and Star Wars.
 *
 * For each game: compares our internal sets table against the relevant
 * external API and reports total counts, the newest set on each side,
 * sets present in the API but missing from our DB, and orphaned sets
 * we have that the API has dropped or renamed.
 *
 * Does NOT write anything. Use scripts/import-{mtg,lorcana,onepiece,yugioh,pokemon,starwars}-database.js
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

// Scryfall (and good API etiquette generally) requires a descriptive
// User-Agent; Scryfall returns HTTP 400 "generic_user_agent" without one.
const FETCH_HEADERS = {
  'User-Agent': 'DCMGrading/1.0 (benjamin@maniczmedia.com)',
  'Accept': 'application/json',
};

async function fetchJson(url, extraHeaders = {}) {
  const res = await fetch(url, { headers: { ...FETCH_HEADERS, ...extraHeaders } });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return res.json();
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { ...FETCH_HEADERS, 'Accept': 'text/html' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return res.text();
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

// ---------- Yu-Gi-Oh! (YGOPRODeck) ----------
async function checkYugioh() {
  divider('Yu-Gi-Oh! vs YGOPRODeck API');

  const { count: dbSetCount } = await supabase
    .from('yugioh_sets').select('set_code', { count: 'exact', head: true });
  const { count: dbCardCount } = await supabase
    .from('yugioh_cards').select('id', { count: 'exact', head: true });
  const { count: dbPrintingCount } = await supabase
    .from('yugioh_card_printings').select('id', { count: 'exact', head: true });

  const { data: dbSets } = await supabase
    .from('yugioh_sets')
    .select('set_code, set_name, num_of_cards, tcg_date')
    .order('tcg_date', { ascending: false });

  // YGOPRODeck /cardsets.php returns a flat array of all sets.
  const apiSets = await fetchJson('https://db.ygoprodeck.com/api/v7/cardsets.php');

  console.log(`Sets:     DB ${dbSetCount}  |  API ${apiSets.length}`);
  console.log(`Cards:    DB ${dbCardCount}`);
  console.log(`Printings: DB ${dbPrintingCount}`);

  // Diff by set_code (case-insensitive — YGOPRODeck is inconsistent on casing)
  const dbCodes = new Set(dbSets.map(s => (s.set_code || '').toUpperCase()));
  const apiSetsNormalized = apiSets.map(s => ({
    ...s,
    set_code: (s.set_code || '').toUpperCase(),
  }));
  const apiCodes = new Set(apiSetsNormalized.map(s => s.set_code));
  const apiNotInDb = apiSetsNormalized.filter(s => !dbCodes.has(s.set_code));
  const dbNotInApi = dbSets.filter(s => !apiCodes.has((s.set_code || '').toUpperCase()));

  // 90-day cap for the "missing" list (Yu-Gi-Oh has ~1700 sets across 25
  // years, only recent ones are relevant).
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const recentMissing = apiNotInDb
    .filter(s => s.tcg_date && new Date(s.tcg_date) >= cutoff)
    .sort((a, b) => (b.tcg_date || '').localeCompare(a.tcg_date || ''));

  const newestDb = dbSets[0];
  const newestApi = [...apiSetsNormalized]
    .filter(s => s.tcg_date)
    .sort((a, b) => (b.tcg_date || '').localeCompare(a.tcg_date || ''))[0];
  console.log(`\nMost recent DB set:  ${(newestDb?.set_name || '?').padEnd(40)} ${newestDb?.tcg_date || '?'}`);
  console.log(`Most recent API set: ${(newestApi?.set_name || '?').padEnd(40)} ${newestApi?.tcg_date || '?'}`);

  console.log(`\nAPI sets missing from DB total: ${apiNotInDb.length}`);
  console.log(`  (within last 90 days: ${recentMissing.length})`);
  if (recentMissing.length > 0) {
    recentMissing.slice(0, 15).forEach(s => {
      console.log(`    ${s.tcg_date}  ${s.set_code.padEnd(10)} ${(s.set_name || '').padEnd(45)} ${s.num_of_cards || '?'} cards`);
    });
    if (recentMissing.length > 15) console.log(`    ... and ${recentMissing.length - 15} more`);
  }

  if (dbNotInApi.length > 0) {
    console.log(`\nSets in DB but not in API: ${dbNotInApi.length}`);
    dbNotInApi.slice(0, 5).forEach(s => {
      console.log(`    ${s.tcg_date || '?'}  ${(s.set_code || '').padEnd(10)} ${s.set_name}`);
    });
    if (dbNotInApi.length > 5) console.log(`    ... and ${dbNotInApi.length - 5} more`);
  }

  return { hasMissing: recentMissing.length > 0, count: recentMissing.length };
}

// ---------- Pokemon (pokemontcg.io) ----------
async function checkPokemon() {
  divider('Pokemon vs pokemontcg.io API');

  const { count: dbSetCount } = await supabase
    .from('pokemon_sets').select('id', { count: 'exact', head: true });
  const { count: dbCardCount } = await supabase
    .from('pokemon_cards').select('id', { count: 'exact', head: true });

  const { data: dbSets } = await supabase
    .from('pokemon_sets')
    .select('id, name, series, release_date, total, printed_total')
    .order('release_date', { ascending: false });

  // Same API + key as scripts/import-pokemon-database.js. The key is optional
  // but recommended (higher rate limits). pageSize=250 covers all ~170 sets.
  const apiKeyHeaders = process.env.POKEMON_TCG_API_KEY
    ? { 'X-Api-Key': process.env.POKEMON_TCG_API_KEY }
    : {};
  const api = await fetchJson(
    'https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate&pageSize=250',
    apiKeyHeaders,
  );
  const apiSets = api.data || [];

  // Global card count via totalCount on a 1-card page.
  let apiCardCount = '?';
  try {
    const cardRes = await fetchJson('https://api.pokemontcg.io/v2/cards?pageSize=1', apiKeyHeaders);
    apiCardCount = cardRes.totalCount ?? '?';
  } catch { /* non-fatal — counts line just shows '?' */ }

  console.log(`Sets:  DB ${dbSetCount}  |  API ${apiSets.length}  |  Diff ${apiSets.length - dbSetCount}`);
  console.log(`Cards: DB ${dbCardCount}  |  API ${apiCardCount}`);
  console.log('(English only — pokemon_sets_ja / TCGdex Japanese data is not checked here)');

  const dbIds = new Set(dbSets.map(s => s.id));
  const apiIds = new Set(apiSets.map(s => s.id));
  const apiNotInDb = apiSets.filter(s => !dbIds.has(s.id));
  const dbNotInApi = dbSets.filter(s => !apiIds.has(s.id));

  console.log(`\nMost recent DB set:  ${(dbSets[0]?.name || '?').padEnd(35)} ${dbSets[0]?.release_date || '?'}`);
  const newestApi = [...apiSets].sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''))[0];
  console.log(`Most recent API set: ${(newestApi?.name || '?').padEnd(35)} ${newestApi?.releaseDate || '?'}`);

  console.log(`\nAPI sets missing from DB: ${apiNotInDb.length}`);
  apiNotInDb
    .sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''))
    .forEach(s => {
      console.log(`    ${s.releaseDate || '?'}  ${(s.id || '').padEnd(14)} ${(s.name || '').padEnd(40)} ${s.total || '?'} cards`);
    });

  if (dbNotInApi.length > 0) {
    console.log(`\nSets in DB but not in API: ${dbNotInApi.length}`);
    dbNotInApi.slice(0, 5).forEach(s => {
      console.log(`    ${s.release_date || '?'}  ${(s.id || '').padEnd(14)} ${s.name}`);
    });
    if (dbNotInApi.length > 5) console.log(`    ... and ${dbNotInApi.length - 5} more`);
  }

  // Per-set card count drift on overlapping sets
  const drifts = [];
  for (const dbSet of dbSets) {
    const apiSet = apiSets.find(s => s.id === dbSet.id);
    if (!apiSet) continue;
    if ((dbSet.total || 0) !== (apiSet.total || 0)) {
      drifts.push({ id: dbSet.id, name: dbSet.name, db: dbSet.total || 0, api: apiSet.total || 0 });
    }
  }
  if (drifts.length > 0) {
    console.log(`\nSets with card-count drift (top 10 by gap):`);
    drifts.sort((a, b) => Math.abs(b.api - b.db) - Math.abs(a.api - a.db));
    drifts.slice(0, 10).forEach(d => {
      console.log(`    ${d.id.padEnd(14)} ${(d.name || '').padEnd(40)} DB=${d.db} API=${d.api}`);
    });
    if (drifts.length > 10) console.log(`    ... and ${drifts.length - 10} more`);
  }

  return { hasMissing: apiNotInDb.length > 0, count: apiNotInDb.length };
}

// ---------- Star Wars (PriceCharting category page) ----------
async function checkStarWars() {
  divider('Star Wars vs PriceCharting category page');

  const { count: dbSetCount } = await supabase
    .from('starwars_sets').select('id', { count: 'exact', head: true });
  const { count: dbCardCount } = await supabase
    .from('starwars_cards').select('id', { count: 'exact', head: true });

  const { data: dbSets } = await supabase
    .from('starwars_sets')
    .select('id, name, set_type, total_cards, release_date')
    .order('id');

  // The importer (scripts/import-starwars-database.js) discovers sets via
  // hardcoded DISCOVERY_QUERIES against the PriceCharting API — anything those
  // queries miss never gets imported. The public category page lists every
  // Star Wars console PriceCharting knows about, so scraping its /console/
  // slugs is exactly the safety net that catches discovery gaps.
  // starwars_sets.id is the set slug (lowercased console name, non-alphanumerics
  // collapsed to '-'), which matches PriceCharting's /console/<slug> URLs.
  const html = await fetchHtml('https://www.pricecharting.com/category/star-wars-cards');
  const slugSet = new Set();
  const slugRe = /\/console\/([^"'\s?#<>]+)/g;
  let m;
  while ((m = slugRe.exec(html)) !== null) {
    // PriceCharting URLs keep characters like & and ' percent-encoded
    // (e.g. ...black-%26-white). Decode, then normalize with the same
    // slug rule the importer uses (lowercase, non-alphanumerics -> '-')
    // so page slugs line up with starwars_sets.id.
    let raw = m[1].replace(/&amp;/g, '&');
    try { raw = decodeURIComponent(raw); } catch { /* keep as-is */ }
    const slug = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (slug) slugSet.add(slug);
  }

  const dbIds = new Set(dbSets.map(s => s.id));
  // The page can carry nav/footer links to consoles outside this category;
  // keep a slug if it looks like Star Wars or if we already track it. Also
  // drop the non-card consoles the importer excludes (Funko Pop, LEGO).
  const pageSlugs = [...slugSet].filter(slug =>
    (slug.includes('star-wars') || dbIds.has(slug)) &&
    !slug.includes('funko-pop') && !slug.includes('lego'));

  console.log(`Sets:  DB ${dbSetCount}  |  Category page ${pageSlugs.length}  |  Diff ${pageSlugs.length - dbSetCount}`);
  console.log(`Cards: DB ${dbCardCount}  |  (category page does not expose card counts)`);

  const pageSlugSet = new Set(pageSlugs);
  const pageNotInDb = pageSlugs.filter(slug => !dbIds.has(slug)).sort();
  const dbNotOnPage = dbSets.filter(s => !pageSlugSet.has(s.id));

  console.log(`\nCategory-page sets missing from DB: ${pageNotInDb.length}`);
  pageNotInDb.forEach(slug => {
    console.log(`    ${slug}`);
  });
  if (pageNotInDb.length > 0) {
    console.log(`  (these are likely sets the importer's DISCOVERY_QUERIES miss)`);
  }

  if (dbNotOnPage.length > 0) {
    console.log(`\nSets in DB but not on category page: ${dbNotOnPage.length}`);
    dbNotOnPage.slice(0, 10).forEach(s => {
      console.log(`    ${(s.id || '').padEnd(50)} ${s.name}`);
    });
    if (dbNotOnPage.length > 10) console.log(`    ... and ${dbNotOnPage.length - 10} more`);
  }

  return { hasMissing: pageNotInDb.length > 0, count: pageNotInDb.length };
}

async function main() {
  const results = {};
  try { results.mtg = await checkMtg(); }
  catch (e) { console.error('\nMTG check failed:', e.message); results.mtg = { error: e.message }; }
  try { results.lorcana = await checkLorcana(); }
  catch (e) { console.error('\nLorcana check failed:', e.message); results.lorcana = { error: e.message }; }
  try { results.onepiece = await checkOnePiece(); }
  catch (e) { console.error('\nOne Piece check failed:', e.message); results.onepiece = { error: e.message }; }
  try { results.yugioh = await checkYugioh(); }
  catch (e) { console.error('\nYu-Gi-Oh check failed:', e.message); results.yugioh = { error: e.message }; }
  try { results.pokemon = await checkPokemon(); }
  catch (e) { console.error('\nPokemon check failed:', e.message); results.pokemon = { error: e.message }; }
  try { results.starwars = await checkStarWars(); }
  catch (e) { console.error('\nStar Wars check failed:', e.message); results.starwars = { error: e.message }; }

  divider('Summary');
  const actions = [];
  if (results.mtg?.hasMissing) actions.push(`MTG: ${results.mtg.count} recent sets missing -> node scripts/import-mtg-database.js`);
  if (results.lorcana?.hasMissing) actions.push(`Lorcana: ${results.lorcana.count} sets missing -> node scripts/import-lorcana-database.js`);
  if (results.onepiece?.hasMissing) actions.push(`One Piece: ${results.onepiece.count} sets missing -> node scripts/import-onepiece-database.js`);
  if (results.yugioh?.hasMissing) actions.push(`Yu-Gi-Oh: ${results.yugioh.count} recent sets missing -> node scripts/import-yugioh-database.js`);
  if (results.pokemon?.hasMissing) actions.push(`Pokemon: ${results.pokemon.count} sets missing -> node scripts/import-pokemon-database.js --incremental`);
  if (results.starwars?.hasMissing) actions.push(`Star Wars: ${results.starwars.count} sets missing -> node scripts/import-starwars-database.js`);
  if (actions.length === 0) {
    console.log('  All TCG databases are in sync with their respective APIs.');
  } else {
    actions.forEach(a => console.log(`  ${a}`));
  }
}

main().catch(e => { console.error('Fatal:', e?.message || e); process.exit(1); });
