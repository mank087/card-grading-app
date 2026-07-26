/**
 * Import generic TCG card databases from the apitcg open-data GitHub repos
 *
 * Source: github.com/apitcg/<game>-tcg-data — plain JSON files under
 * cards/en/*.json, no API key required. Games imported: Digimon,
 * Dragon Ball Fusion World, Union Arena, Gundam, Riftbound.
 *
 * All writes are upserts on (game, code) — always safe to re-run.
 *
 * Usage: node scripts/import-tcg-database.js [game]
 *   (optional game arg limits to one game, e.g. "digimon")
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const GAMES = {
  digimon: 'digimon-tcg-data',
  'dragon-ball-fusion': 'dragon-ball-fusion-tcg-data',
  'union-arena': 'union-arena-tcg-data',
  gundam: 'gundam-tcg-data',
  riftbound: 'riftbound-tcg-data',
};

const UA = { 'User-Agent': 'DCMGrading/1.0 (import; contact admin@dcmgrading.com)', Accept: 'application/json' };

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: Missing Supabase environment variables');
  process.exit(1);
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

/** List cards/en/*.json download URLs for a repo (1 GitHub API call per repo) */
async function listCardFiles(repo) {
  const entries = await fetchJson(`https://api.github.com/repos/apitcg/${repo}/contents/cards/en`);
  return entries.filter(e => e.name.endsWith('.json')).map(e => e.download_url);
}

function mapCard(game, c) {
  const code = String(c.code || c.id || '').toUpperCase().trim();
  if (!code) return null;
  return {
    game,
    code,
    name: c.name ?? null,
    set_id: c.set?.id ?? null,
    set_name: c.set?.name ?? null,
    rarity: c.rarity ?? c.rarity_code ?? null,
    card_type: c.cardType ?? c.type ?? null,
    image_small: c.images?.small ?? null,
    image_large: c.images?.large ?? null,
    raw: c,
    source: 'apitcg-github',
    updated_at: new Date().toISOString(),
  };
}

async function importGame(game, repo) {
  console.log(`\n=== ${game} (${repo}) ===`);
  let files;
  try {
    files = await listCardFiles(repo);
  } catch (e) {
    console.warn(`  Skipped: could not list files (${e.message})`);
    return 0;
  }
  console.log(`  ${files.length} data files`);

  let total = 0;
  const seen = new Set(); // codes can repeat across files (reprint listings) — last write wins per run
  for (const url of files) {
    let cards;
    try {
      cards = await fetchJson(url);
    } catch (e) {
      console.warn(`  file failed (${e.message}) — continuing`);
      continue;
    }
    if (!Array.isArray(cards)) continue;
    const rows = cards.map(c => mapCard(game, c)).filter(Boolean)
      .filter(r => { const k = r.code; if (seen.has(k)) return false; seen.add(k); return true; });
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200);
      const { error } = await supabase.from('tcg_cards').upsert(batch, { onConflict: 'game,code' });
      if (error) throw new Error(`${game} upsert failed: ${error.message}`);
      total += batch.length;
    }
    await new Promise(r => setTimeout(r, 150));
  }
  console.log(`  ✅ ${total} cards upserted`);
  return total;
}

async function main() {
  console.log('=== Generic TCG database import (apitcg GitHub data) ===');
  const only = process.argv[2];
  let grand = 0;
  for (const [game, repo] of Object.entries(GAMES)) {
    if (only && game !== only) continue;
    grand += await importGame(game, repo);
  }
  console.log(`\n✅ Done. ${grand} cards total.`);
}

main().catch(err => {
  console.error('\n❌ Import failed:', err.message);
  process.exit(1);
});
