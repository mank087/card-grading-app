/**
 * Import Kayou Naruto card database from narutodb.com API
 *
 * Source: https://api.narutodb.com (community-verified NA-release database)
 *   - /api/sets            → naruto_sets
 *   - /api/sets/{id}/cards → naruto_cards
 *   - /api/promos          → naruto_cards (is_promo = true)
 *
 * All writes are upserts (onConflict on the primary key), so re-running is
 * always safe. Run whenever the freshness watchdog flags a gap, or after a
 * new NA set releases.
 *
 * Environment (from .env.local):
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage: node scripts/import-naruto-database.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const API_BASE = 'https://api.narutodb.com/api';
const UA = { 'User-Agent': 'DCMGrading/1.0 (import; contact admin@dcmgrading.com)', Accept: 'application/json' };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing Supabase environment variables');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fetchJson(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: UA });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json();
}

function mapCard(c, setId) {
  return {
    card_number: c.card_number,
    set_id: setId ?? c.set_id ?? null,
    rarity_code: c.rarity_code ?? null,
    slot_number: c.slot_number ?? null,
    l_tier: c.l_tier ?? null,
    serial_text: c.serial_text ?? null,
    character_name: c.character_name ?? null,
    character_title: c.character_title ?? null,
    featured_characters: Array.isArray(c.featured_characters) ? c.featured_characters : null,
    is_promo: !!c.is_promo,
    promo_type: c.promo_type ?? null,
    promo_distribution: c.promo_distribution ?? null,
    promo_print_run: c.promo_print_run != null ? String(c.promo_print_run) : null,
    art_theme_notes: c.art_theme_notes ?? null,
    image_thumb_url: c.image_thumb_url ?? null,
    image_front_url: c.image_front_url ?? null,
    image_back_url: c.image_back_url ?? null,
    image_is_stand_in: !!c.image_is_stand_in,
    source: 'narutodb',
    updated_at: new Date().toISOString(),
  };
}

async function upsertCards(cards, label) {
  const BATCH = 200;
  let done = 0;
  for (let i = 0; i < cards.length; i += BATCH) {
    const batch = cards.slice(i, i + BATCH);
    const { error } = await supabase.from('naruto_cards').upsert(batch, { onConflict: 'card_number' });
    if (error) throw new Error(`${label} upsert failed: ${error.message}`);
    done += batch.length;
  }
  return done;
}

async function main() {
  console.log('=== Kayou Naruto database import (narutodb.com) ===\n');

  // 1. Sets
  const sets = await fetchJson('/sets');
  console.log(`Fetched ${sets.length} sets`);
  const setRows = sets.map(s => ({
    id: s.id,
    name: s.name,
    subtitle: s.subtitle ?? null,
    story_arc: s.story_arc ?? null,
    parent_chinese_set: s.parent_chinese_set ?? null,
    release_online: s.release_online ?? null,
    release_instore: s.release_instore ?? null,
    total_cards: s.total_cards ?? 0,
    msrp_per_pack_cents: s.msrp_per_pack_cents ?? null,
    pack_size: s.pack_size ?? null,
    packs_per_box: s.packs_per_box ?? null,
    cover_image_url: s.cover_image_url ?? null,
    display_order: s.display_order ?? null,
    source: 'narutodb',
    last_imported_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
  const { error: setsError } = await supabase.from('naruto_sets').upsert(setRows, { onConflict: 'id' });
  if (setsError) throw new Error(`sets upsert failed: ${setsError.message}`);
  console.log(`Upserted ${setRows.length} sets`);

  // 2. Cards per set
  let totalCards = 0;
  for (const s of sets) {
    const cards = await fetchJson(`/sets/${s.id}/cards`);
    const rows = cards.map(c => mapCard(c, s.id));
    const n = await upsertCards(rows, s.id);
    totalCards += n;
    console.log(`  ${s.id} "${s.name}": ${n} cards`);
    await new Promise(r => setTimeout(r, 300)); // be polite to the fan API
  }

  // 3. Promos
  try {
    const promos = await fetchJson('/promos');
    const rows = promos.map(c => mapCard(c, c.set_id ?? null))
      // Promos may reference set ids we don't have — drop the FK rather than fail
      .map(r => ({ ...r, set_id: sets.some(s => s.id === r.set_id) ? r.set_id : null, is_promo: true }));
    const n = await upsertCards(rows, 'promos');
    totalCards += n;
    console.log(`  promos: ${n} cards`);
  } catch (e) {
    console.warn(`Promos import skipped: ${e.message}`);
  }

  console.log(`\n✅ Done. ${setRows.length} sets, ${totalCards} cards upserted.`);
}

main().catch(err => {
  console.error('\n❌ Import failed:', err.message);
  process.exit(1);
});
