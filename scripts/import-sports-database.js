/**
 * Sports Cards Database Import Script (SportsCardsPro)
 *
 * Builds the local sports card database from the SportsCardsPro price guide
 * (CSV download, included with the Legendary/API subscription).
 *
 * Pipeline:
 *   1. DISCOVER — fetch each sport's category page, collect set slugs;
 *      fetch each (new) set page to extract its console UID from the
 *      "Download Price List" link. Upserts sports_sets.
 *   2. DOWNLOAD — batch console UIDs into download-custom CSV requests
 *      (verified: ?console-uids=G155,G156 returns combined CSV).
 *   3. PARSE + UPSERT — parse product names into structured columns
 *      (player, card number, variant/parallel, serial denominator, rookie)
 *      and upsert into sports_card_products.
 *
 * Usage:
 *   node scripts/import-sports-database.js [--full|--sets-only]
 *                                          [--sport=basketball]
 *                                          [--limit-sets=N]
 *
 * Options:
 *   --full          Re-fetch every set page for UIDs (default: only sets
 *                   not already in sports_sets get a page fetch)
 *   --sets-only     Discover sets only, skip product download
 *   --sport=X       Limit to one sport (basketball, football, ...)
 *   --limit-sets=N  Import at most N sets (for testing)
 *
 * Environment variables required (.env.local):
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - PRICECHARTING_API_KEY   (SportsCardsPro token — same key the API uses)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const { createClient } = require('@supabase/supabase-js');

const BASE_URL = 'https://www.sportscardspro.com';
// SportsCardsPro/PriceCharting reject default HTTP-library User-Agents
// (same lesson as Scryfall) — always send an identifying UA.
const HEADERS = {
  'User-Agent': 'DCMGrading/1.0 (benjamin@maniczmedia.com)',
};

// Sport categories on sportscardspro.com (TCGs excluded — we have local DBs)
const SPORT_CATEGORIES = [
  'baseball-cards',
  'basketball-cards',
  'football-cards',
  'hockey-cards',
  'soccer-cards',
  'boxing-cards',
  'golf-cards',
  'racing-cards',
  'tennis-cards',
  'ufc-cards',
  'wrestling-cards',
];

// Multi-word first so "Upper Deck" wins over "Upper"
const KNOWN_MANUFACTURERS = [
  'Upper Deck', 'O-Pee-Chee', 'Press Pass', 'Pro Set', 'Sage Hit',
  'Panini', 'Topps', 'Bowman', 'Donruss', 'Fleer', 'Leaf', 'Score',
  'Skybox', 'Pinnacle', 'Playoff', 'Pacific', 'Hoops', 'Sage', 'Select',
  'Classic', 'Action Packed', 'Stadium Club', 'Parkhurst', 'Futera',
];

const REQUEST_DELAY_MS = 150;      // between set-page fetches (discovery)
// Modern sets are large (2023 Prizm basketball = ~19.6k product rows), so
// keep CSV batches small to bound download size and parse memory.
const CSV_BATCH_SIZE = 10;         // console UIDs per download-custom request
const CSV_BATCH_DELAY_MS = 1000;   // between CSV downloads
const UPSERT_BATCH_SIZE = 500;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiToken = process.env.PRICECHARTING_API_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing Supabase environment variables');
  process.exit(1);
}
if (!apiToken) {
  console.error('Error: Missing PRICECHARTING_API_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const args = process.argv.slice(2);
const FULL = args.includes('--full');
const SETS_ONLY = args.includes('--sets-only');
const SPORT_FILTER = (args.find(a => a.startsWith('--sport=')) || '').split('=')[1] || null;
const LIMIT_SETS = parseInt((args.find(a => a.startsWith('--limit-sets=')) || '').split('=')[1] || '0', 10);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchText(url, retries = 5) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, { headers: HEADERS });
      if (response.status === 429) {
        const backoff = 10000 * attempt;
        console.log(`  Rate limited, waiting ${backoff / 1000}s...`);
        await sleep(backoff);
        continue; // 429s consume an attempt via the loop increment
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(1500 * attempt);
    }
  }
  // Previously fell through here on persistent 429s and returned undefined,
  // crashing the CSV parser mid-import. Throw so batch-level catches skip it.
  throw new Error('rate limited after all retries');
}

// ============================================================================
// Parsing helpers
// ============================================================================

/**
 * Parse a console name like "Basketball Cards 1986 Fleer" or
 * "Football Cards 2023 Panini Prizm" into structured parts.
 */
function parseConsoleName(consoleName) {
  const result = { sport: null, year: null, manufacturer: null, setName: null };
  if (!consoleName) return result;

  let rest = consoleName.trim();

  // "<Sport> Cards <rest>"
  const sportMatch = rest.match(/^(.+?)\s+Cards\s+(.*)$/i);
  if (sportMatch) {
    result.sport = sportMatch[1].toLowerCase();
    rest = sportMatch[2];
  }

  // Year: first 4-digit run (handles "2024-25" -> 2024)
  const yearMatch = rest.match(/\b((?:19|20)\d{2})(?:-\d{2})?\b/);
  if (yearMatch) {
    result.year = parseInt(yearMatch[1], 10);
    rest = (rest.slice(0, yearMatch.index) + rest.slice(yearMatch.index + yearMatch[0].length)).trim();
  }

  // Manufacturer: longest known prefix
  for (const mfr of KNOWN_MANUFACTURERS) {
    if (rest.toLowerCase().startsWith(mfr.toLowerCase())) {
      result.manufacturer = mfr;
      rest = rest.slice(mfr.length).trim();
      break;
    }
  }

  result.setName = rest || null; // "" for plain sets like "1986 Fleer"
  return result;
}

/**
 * Parse a product name like:
 *   "Adrian Dantley #21"
 *   "LeBron James [Silver Prizm] #23"
 *   "Victor Wembanyama [Gold Vinyl /5] #136"
 * into { playerName, cardNumber, variantText, serialDenominator, isRookie }.
 */
function parseProductName(productName) {
  const result = {
    playerName: null,
    cardNumber: null,
    variantText: null,
    serialDenominator: null,
    isRookie: false,
  };
  if (!productName) return result;

  let working = productName.trim();

  // Bracket groups -> variant text (may be several: join with space)
  const brackets = [...working.matchAll(/\[([^\]]+)\]/g)].map(m => m[1].trim());
  if (brackets.length > 0) {
    working = working.replace(/\[[^\]]*\]/g, ' ');
  }

  // Serial denominator: "/75" inside brackets or bare in the name
  const serialSource = brackets.join(' ') + ' ' + working;
  const serialMatch = serialSource.match(/\/\s?(\d{1,5})\b/);
  if (serialMatch) {
    result.serialDenominator = parseInt(serialMatch[1], 10);
  }

  // Rookie marker: "RC" / "Rookie" in brackets or name
  if (/\b(RC|Rookie)\b/i.test(serialSource)) {
    result.isRookie = true;
  }

  // Variant = bracket text minus the serial fragment
  if (brackets.length > 0) {
    const variant = brackets
      .join(' ')
      .replace(/\/\s?\d{1,5}\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    result.variantText = variant || null;
  }

  // Card number: last "#XYZ" token
  const numMatches = [...working.matchAll(/#([A-Za-z0-9][A-Za-z0-9.-]*)/g)];
  if (numMatches.length > 0) {
    const rawNum = numMatches[numMatches.length - 1][1];
    result.cardNumber = normalizeCardNumber(rawNum);
    working = working.replace(/#[A-Za-z0-9][A-Za-z0-9.-]*/g, ' ');
  }

  // Remainder minus stray serials = player name
  const player = working.replace(/\/\s?\d{1,5}\b/g, ' ').replace(/\s+/g, ' ').trim();
  result.playerName = player || null;

  return result;
}

/**
 * Normalize a slug or console-name to alphanumerics only, for joining CSV
 * console-names ("Baseball Cards 2026 Bowman") to site slugs
 * ("baseball-cards-2026-bowman") regardless of punctuation/casing quirks.
 */
function normalizeForJoin(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Uppercase, strip leading zeros from numeric runs ("023" -> "23", "WC-011" -> "WC-11") */
function normalizeCardNumber(raw) {
  if (!raw) return null;
  return raw
    .toUpperCase()
    .replace(/\b0+(\d)/g, '$1')
    .trim();
}

/** "$1,014.00" / "$6.92" -> 1014.00 / 6.92 ; "" -> null */
function parsePrice(str) {
  if (!str) return null;
  const cleaned = String(str).replace(/[$,\s]/g, '');
  if (!cleaned) return null;
  const value = parseFloat(cleaned);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Minimal RFC-4180 CSV parser (streaming not needed: per-batch files are
 * a few MB). Handles quoted fields with embedded commas/quotes/newlines.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }
  return rows;
}

// ============================================================================
// Phase 1: Discover sets
// ============================================================================

// Collect ALL sports console slugs from the sitemap (complete enumeration —
// the category pages only expose ~300 "featured" sets per sport, missing
// ~94% of sets incl. modern parallels users actually own).
async function collectSlugsFromSitemap() {
  console.log('Fetching sitemap for complete set list...');
  const xml = await fetchText(`${BASE_URL}/sitemap.xml`);
  const sportsRe = /^(baseball|basketball|football|hockey|soccer|boxing|golf|racing|tennis|ufc|wrestling)-cards/i;
  const slugs = [...new Set(
    [...xml.matchAll(/\/console\/([a-z0-9%.'-]+)/gi)].map(m => {
      try { return decodeURIComponent(m[1]); } catch { return m[1]; }
    })
  )].filter(s => sportsRe.test(s));
  console.log(`  sitemap lists ${slugs.length} sports set slugs`);
  if (SPORT_FILTER) return slugs.filter(s => s.startsWith(SPORT_FILTER));
  return slugs;
}

async function discoverSets() {
  // Existing sets (skip page fetch unless --full)
  const { data: existing } = await supabase
    .from('sports_sets')
    .select('uid, slug');
  const knownSlugs = new Map((existing || []).map(s => [s.slug, s.uid]));

  const allSlugs = await collectSlugsFromSitemap();
  const todo = FULL ? allSlugs : allSlugs.filter(s => !knownSlugs.has(s));
  console.log(`${todo.length} sets to discover (${knownSlugs.size} already known)`);

  const discovered = []; // { slug, uid, consoleName }
  let pageFetches = 0;

  for (const slug of todo) {
    // Set page contains the download link with the console UID.
    // The ?t= token is REQUIRED: the "Download Price List" link only
    // renders for authenticated Legendary subscribers.
    let setHtml;
    try {
      setHtml = await fetchText(`${BASE_URL}/console/${encodeURIComponent(slug)}?t=${apiToken}`);
    } catch (err) {
      console.log(`  ⚠ Failed set page ${slug}: ${err.message}`);
      continue;
    }
    pageFetches++;
    const uidMatch = setHtml.match(/download-custom\?[^"]*console-uids=([A-Z0-9]+)/);
    if (!uidMatch) {
      if (pageFetches % 25 === 0) console.log(`  ...${pageFetches}/${todo.length} pages fetched`);
      await sleep(REQUEST_DELAY_MS);
      continue;
    }
    // Titles look like "2026 Bowman Card Prices | Baseball | PSA & ..." while
    // the CSV console-name is "Baseball Cards 2026 Bowman". Products link to
    // sets by console-name, so synthesize the CSV format from the title
    // (set name from before "Card Prices", sport from the middle segment).
    const titleMatch = setHtml.match(/<title>\s*(.*?)\s+Card Prices\s*\|\s*([^|<]+?)\s*[|<]/i);
    let consoleName;
    if (titleMatch) {
      consoleName = `${titleMatch[2].trim()} Cards ${titleMatch[1].trim()}`;
    } else {
      const nameMatch = setHtml.match(/<title>([^<|]+)/);
      consoleName = nameMatch ? nameMatch[1].replace(/\s*(Card Prices|Prices|Price Guide).*$/i, '').trim() : slug;
    }
    discovered.push({ slug, uid: uidMatch[1], consoleName });

    // Incremental upsert every 200 sets so a long run's progress survives a crash
    if (discovered.length >= 200) {
      await upsertSets(discovered.splice(0, discovered.length));
    }
    if (pageFetches % 25 === 0) console.log(`  ...${pageFetches}/${todo.length} pages fetched, ${discovered.length} pending`);
    await sleep(REQUEST_DELAY_MS);
  }

  // Final flush
  if (discovered.length > 0) await upsertSets(discovered);
  console.log(`\nDiscovery complete: ${pageFetches} set pages fetched`);
  return pageFetches;
}

async function upsertSets(discovered) {
  const rows = discovered.map(({ slug, uid, consoleName }) => {
    const parsed = parseConsoleName(consoleName);
    return {
      uid, slug, console_name: consoleName,
      sport: parsed.sport, year: parsed.year,
      manufacturer: parsed.manufacturer, set_name: parsed.setName,
      updated_at: new Date().toISOString(),
    };
  });
  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const { error } = await supabase
      .from('sports_sets')
      .upsert(rows.slice(i, i + UPSERT_BATCH_SIZE), { onConflict: 'uid' });
    if (error) throw new Error(`sports_sets upsert failed: ${error.message}`);
  }
}

// ============================================================================
// Phase 2: Download product CSVs and import
// ============================================================================

async function importProducts() {
  // Page through ALL sets — Supabase caps un-ranged selects at 1000 rows,
  // which silently truncated the first full import to 1000/2900 sets.
  const sets = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    let query = supabase
      .from('sports_sets')
      .select('uid, slug, console_name')
      // Never-imported sets first so interrupted runs resume where they left off
      .order('last_imported_at', { ascending: true, nullsFirst: true })
      .order('uid')
      .range(from, from + PAGE - 1);
    if (SPORT_FILTER) query = query.ilike('slug', `${SPORT_FILTER}%`);
    const { data, error } = await query;
    if (error) throw new Error(`Failed to load sports_sets: ${error.message}`);
    sets.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }

  let targetSets = sets;
  if (LIMIT_SETS > 0) targetSets = targetSets.slice(0, LIMIT_SETS);
  console.log(`\nImporting products for ${targetSets.length} sets...`);

  let totalProducts = 0;
  const setCounts = new Map();

  for (let i = 0; i < targetSets.length; i += CSV_BATCH_SIZE) {
    const batch = targetSets.slice(i, i + CSV_BATCH_SIZE);
    const uids = batch.map(s => s.uid).join(',');
    // Primary join: normalized slug ↔ normalized CSV console-name (robust to the
    // title-vs-CSV naming mismatch). Exact console_name match kept as fallback.
    const slugToSet = new Map(batch.map(s => [normalizeForJoin(s.slug), s]));
    const uidToSet = new Map(batch.map(s => [s.console_name, s]));

    let csvText;
    try {
      csvText = await fetchText(
        `${BASE_URL}/price-guide/download-custom?t=${apiToken}&console-uids=${uids}`
      );
    } catch (err) {
      console.log(`  ⚠ CSV batch failed (${batch[0].slug}...): ${err.message}`);
      continue;
    }

    const rows = parseCsv(csvText);
    if (rows.length < 2) {
      console.log(`  ⚠ Empty CSV for batch starting ${batch[0].slug}`);
      continue;
    }
    const header = rows[0];
    const col = Object.fromEntries(header.map((h, idx) => [h, idx]));
    const required = ['id', 'console-name', 'product-name'];
    for (const r of required) {
      if (!(r in col)) throw new Error(`CSV missing column "${r}"`);
    }

    const products = [];
    const trueNameBySetUid = new Map();
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const consoleName = row[col['console-name']];
      const set = slugToSet.get(normalizeForJoin(consoleName)) || uidToSet.get(consoleName);
      if (set && !trueNameBySetUid.has(set.uid)) trueNameBySetUid.set(set.uid, consoleName);
      const productName = row[col['product-name']];
      if (!productName) continue;
      const parsed = parseProductName(productName);
      products.push({
        id: row[col['id']],
        product_name: productName,
        console_name: consoleName,
        set_uid: set ? set.uid : null,
        player_name: parsed.playerName,
        card_number: parsed.cardNumber,
        variant_text: parsed.variantText,
        serial_denominator: parsed.serialDenominator,
        is_rookie: parsed.isRookie,
        loose_price: parsePrice(row[col['loose-price']]),
        cib_price: parsePrice(row[col['cib-price']]),
        new_price: parsePrice(row[col['new-price']]),
        graded_price: parsePrice(row[col['graded-price']]),
        box_only_price: parsePrice(row[col['box-only-price']]),
        manual_only_price: parsePrice(row[col['manual-only-price']]),
        bgs_10_price: parsePrice(row[col['bgs-10-price']]),
        condition_17_price: parsePrice(row[col['condition-17-price']]),
        condition_18_price: parsePrice(row[col['condition-18-price']]),
        sales_volume: parseInt(row[col['sales-volume']] || '', 10) || null,
        genre: row[col['genre']] || null,
        upc: row[col['upc']] || null,
        release_date: row[col['release-date']] || null,
        updated_at: new Date().toISOString(),
      });
      const key = set ? set.uid : consoleName;
      setCounts.set(key, (setCounts.get(key) || 0) + 1);
    }

    for (let p = 0; p < products.length; p += UPSERT_BATCH_SIZE) {
      // Retry transient network failures — a single "fetch failed" killed a
      // 6.1M-row run at batch 294/295.
      let lastError = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const { error: upsertError } = await supabase
            .from('sports_card_products')
            .upsert(products.slice(p, p + UPSERT_BATCH_SIZE), { onConflict: 'id' });
          lastError = upsertError;
          if (!upsertError) break;
        } catch (netErr) {
          lastError = netErr;
        }
        if (attempt < 3) await sleep(3000 * attempt);
      }
      if (lastError) {
        throw new Error(`sports_card_products upsert failed: ${lastError.message || lastError}`);
      }
    }

    // Self-heal set rows whose stored console_name doesn't match the CSV's
    // authoritative name (fixes title-derived names and re-parses sport/year/
    // manufacturer, which drive the /sports-database filters).
    for (const [uid, trueName] of trueNameBySetUid) {
      const set = batch.find(s => s.uid === uid);
      if (!set || set.console_name === trueName) continue;
      const parsed = parseConsoleName(trueName);
      await supabase
        .from('sports_sets')
        .update({
          console_name: trueName,
          sport: parsed.sport,
          year: parsed.year,
          manufacturer: parsed.manufacturer,
          set_name: parsed.setName,
          updated_at: new Date().toISOString(),
        })
        .eq('uid', uid);
    }

    totalProducts += products.length;
    console.log(`  Batch ${Math.floor(i / CSV_BATCH_SIZE) + 1}/${Math.ceil(targetSets.length / CSV_BATCH_SIZE)}: ${products.length} products (total ${totalProducts})`);
    await sleep(CSV_BATCH_DELAY_MS);
  }

  // Update per-set product counts + import timestamps
  const countRows = [...setCounts.entries()]
    .filter(([uid]) => targetSets.some(s => s.uid === uid))
    .map(([uid, count]) => ({
      uid,
      product_count: count,
      last_imported_at: new Date().toISOString(),
    }));
  for (let i = 0; i < countRows.length; i += UPSERT_BATCH_SIZE) {
    // Merge onto existing rows (uid PK) — slug/console_name already present
    for (const row of countRows.slice(i, i + UPSERT_BATCH_SIZE)) {
      await supabase
        .from('sports_sets')
        .update({ product_count: row.product_count, last_imported_at: row.last_imported_at })
        .eq('uid', row.uid);
    }
  }

  return totalProducts;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const startTime = Date.now();
  console.log('=== Sports Cards Database Import ===');
  console.log(`Mode: ${SETS_ONLY ? 'sets-only' : 'full pipeline'}${FULL ? ' (--full rediscovery)' : ''}${SPORT_FILTER ? ` sport=${SPORT_FILTER}` : ''}${LIMIT_SETS ? ` limit-sets=${LIMIT_SETS}` : ''}`);

  const { data: logRow } = await supabase
    .from('sports_import_log')
    .insert({ import_type: SETS_ONLY ? 'sets_only' : (FULL ? 'full' : 'incremental') })
    .select('id')
    .single();
  const logId = logRow ? logRow.id : null;

  try {
    const setsImported = await discoverSets();
    let productsImported = 0;
    if (!SETS_ONLY) {
      productsImported = await importProducts();
    }

    if (logId) {
      await supabase
        .from('sports_import_log')
        .update({
          sets_imported: setsImported,
          products_imported: productsImported,
          completed_at: new Date().toISOString(),
          status: 'completed',
        })
        .eq('id', logId);
    }

    const mins = ((Date.now() - startTime) / 60000).toFixed(1);
    console.log(`\n✅ Done in ${mins}m — ${setsImported} new sets, ${productsImported} products imported/updated`);
  } catch (err) {
    console.error(`\n❌ Import failed: ${err.message}`);
    if (logId) {
      await supabase
        .from('sports_import_log')
        .update({ status: 'failed', error_message: err.message, completed_at: new Date().toISOString() })
        .eq('id', logId);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

// Exported for tests and the coverage report script
module.exports = { parseConsoleName, parseProductName, normalizeCardNumber, parsePrice, parseCsv };
