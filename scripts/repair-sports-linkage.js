/**
 * Repair sports_sets ↔ sports_card_products linkage (one-time fix)
 *
 * The first import stored page-title text as sports_sets.console_name
 * ("2026 Bowman Card") while products carry the CSV's authoritative name
 * ("Baseball Cards 2026 Bowman"). Products therefore imported with
 * set_uid = NULL and sets got no sport/year/manufacturer parsing.
 *
 * This repairs everything from data already in the database:
 *   per set: find its true console-name from products (slug-token match),
 *   fix the set row (name + parsed sport/year/manufacturer/set_name),
 *   link its products (set_uid), and set product_count.
 *
 * Usage: node scripts/repair-sports-linkage.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');
const { parseConsoleName } = require('./import-sports-database.js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normalizeForJoin(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function main() {
  // Load all sets (paged past the 1000-row default)
  const sets = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('sports_sets')
      .select('uid, slug, console_name, product_count')
      .order('uid')
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    sets.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  console.log(`${sets.length} sets loaded`);

  // Collect ALL distinct console-names from products via keyset pagination —
  // each hop is a single btree-indexed lookup (the previous ilike pattern scan
  // hit statement timeouts on the 6.1M-row table).
  console.log('Collecting distinct console names...');
  const distinctNames = [];
  let cursor = '';
  for (;;) {
    const { data, error } = await supabase
      .from('sports_card_products')
      .select('console_name')
      .gt('console_name', cursor)
      .order('console_name', { ascending: true })
      .limit(1);
    if (error) throw new Error(`distinct scan failed at "${cursor}": ${error.message}`);
    if (!data || data.length === 0) break;
    distinctNames.push(data[0].console_name);
    cursor = data[0].console_name;
    if (distinctNames.length % 500 === 0) console.log(`  ...${distinctNames.length} distinct names`);
  }
  console.log(`${distinctNames.length} distinct console names found`);
  const nameByJoinKey = new Map(distinctNames.map(n => [normalizeForJoin(n), n]));

  let repaired = 0, linked = 0, noProducts = 0, ambiguous = 0;

  for (let i = 0; i < sets.length; i++) {
    const set = sets[i];
    const trueName = nameByJoinKey.get(normalizeForJoin(set.slug));
    if (!trueName) {
      noProducts++; // products not imported yet — the fixed import handles these
      continue;
    }

    // Fix the set row
    const parsed = parseConsoleName(trueName);
    const { error: setErr } = await supabase
      .from('sports_sets')
      .update({
        console_name: trueName,
        sport: parsed.sport,
        year: parsed.year,
        manufacturer: parsed.manufacturer,
        set_name: parsed.setName,
        updated_at: new Date().toISOString(),
      })
      .eq('uid', set.uid);
    if (setErr) { console.log(`  ⚠ set update ${set.slug}: ${setErr.message}`); continue; }

    // Link products (equality on the indexed console_name column; retry once
    // on timeout — very large sets update ~20k rows)
    let prodErr = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const { error } = await supabase
        .from('sports_card_products')
        .update({ set_uid: set.uid })
        .eq('console_name', trueName)
        .is('set_uid', null);
      prodErr = error;
      if (!error) break;
      await new Promise(r => setTimeout(r, 2000));
    }
    if (prodErr) { console.log(`  ⚠ product link ${set.slug}: ${prodErr.message}`); continue; }

    // Count
    const { count } = await supabase
      .from('sports_card_products')
      .select('id', { count: 'exact', head: true })
      .eq('set_uid', set.uid);
    await supabase
      .from('sports_sets')
      .update({ product_count: count || 0, last_imported_at: new Date().toISOString() })
      .eq('uid', set.uid);

    repaired++;
    linked += count || 0;
    if (repaired % 100 === 0) console.log(`  ${repaired} sets repaired, ${linked} products linked (${i + 1}/${sets.length} scanned)`);
  }

  console.log(`\n✅ Done: ${repaired} sets repaired, ${linked} products linked, ${noProducts} sets have no products yet (pending import), ${ambiguous} ambiguous (no exact slug match)`);
}

main().catch(err => { console.error(err); process.exit(1); });
