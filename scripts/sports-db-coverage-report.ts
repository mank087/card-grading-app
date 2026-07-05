/**
 * Sports DB Coverage Report (WS1.3)
 *
 * Runs the real local matcher (src/lib/sportsCardMatcher.ts) against every
 * graded sports card in the cards table and reports match coverage — the
 * before/after KPI for Matching v2.
 *
 * Usage:
 *   npx tsx scripts/sports-db-coverage-report.ts [--limit=N] [--verbose]
 *
 * Requires .env.local (Supabase URL + service role key) and an imported
 * sports_card_products table (scripts/import-sports-database.js).
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { matchSportsCardLocal, isSportsLocalDbAvailable } from '../src/lib/sportsCardMatcher';

const args = process.argv.slice(2);
const LIMIT = parseInt((args.find(a => a.startsWith('--limit=')) || '').split('=')[1] || '0', 10);
const VERBOSE = args.includes('--verbose');

const SPORTS_CATEGORIES = ['sports', 'basketball', 'football', 'baseball', 'hockey', 'soccer', 'golf', 'boxing', 'wrestling', 'ufc', 'racing', 'tennis'];

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (!(await isSportsLocalDbAvailable())) {
    console.error('sports_card_products is empty — run scripts/import-sports-database.js first');
    process.exit(1);
  }

  let query = supabase
    .from('cards')
    .select('id, category, conversational_card_info, dcm_price_product_id, dcm_price_match_confidence')
    .not('conversational_card_info', 'is', null)
    .order('created_at', { ascending: false });
  if (LIMIT > 0) query = query.limit(LIMIT);
  else query = query.limit(5000);

  const { data: cards, error } = await query;
  if (error) throw new Error(error.message);

  const sportsCards = (cards || []).filter(c =>
    SPORTS_CATEGORIES.some(s => (c.category || '').toLowerCase().includes(s))
  );
  console.log(`Testing ${sportsCards.length} sports cards against the local DB...\n`);

  const stats = {
    total: 0,
    exact: 0,
    family: 0,
    none: 0,
    byConfidence: { high: 0, medium: 0, low: 0, none: 0 } as Record<string, number>,
    defaultedToBase: 0,
    variantNotFound: 0,
    missingPlayer: 0,
  };
  const misses: string[] = [];

  for (const card of sportsCards) {
    const ci = card.conversational_card_info as any;
    const player = ci?.player_or_character || ci?.featured;
    if (!player) { stats.missingPlayer++; continue; }
    stats.total++;

    const result = await matchSportsCardLocal({
      playerName: player,
      year: ci?.year || ci?.release_date,
      setName: ci?.set_name || ci?.card_set,
      cardNumber: ci?.card_number_raw || ci?.card_number,
      variant: ci?.parallel_type,
      subset: ci?.subset,
      serialNumbering: ci?.serial_numbering,
      sport: card.category,
    });

    stats[result.tier]++;
    stats.byConfidence[result.confidence] = (stats.byConfidence[result.confidence] || 0) + 1;
    if (result.defaultedToBase) stats.defaultedToBase++;
    if (result.variantNotFound) stats.variantNotFound++;

    if (result.tier === 'none' && misses.length < 25) {
      misses.push(`${player} | ${ci?.year || '?'} ${ci?.set_name || '?'} #${ci?.card_number || '?'} — ${result.notes.join('; ')}`);
    }
    if (VERBOSE) {
      console.log(`${result.tier.padEnd(6)} ${result.confidence.padEnd(6)} ${player} -> ${result.product?.product_name || '(none)'} [${result.product?.console_name || ''}]`);
    }
  }

  const pct = (n: number) => stats.total ? ((n / stats.total) * 100).toFixed(1) + '%' : '—';
  console.log('\n=== Sports DB Coverage Report ===');
  console.log(`Cards tested:        ${stats.total} (${stats.missingPlayer} skipped, no player)`);
  console.log(`Exact matches:       ${stats.exact} (${pct(stats.exact)})`);
  console.log(`Family matches:      ${stats.family} (${pct(stats.family)})`);
  console.log(`No match:            ${stats.none} (${pct(stats.none)})`);
  console.log(`Confidence:          high=${stats.byConfidence.high} medium=${stats.byConfidence.medium} low=${stats.byConfidence.low}`);
  console.log(`Defaulted to base:   ${stats.defaultedToBase} (parallel picker candidates)`);
  console.log(`Variant not found:   ${stats.variantNotFound} (AI named a nonexistent parallel)`);
  if (misses.length > 0) {
    console.log('\nSample misses:');
    misses.forEach(m => console.log(`  - ${m}`));
  }
}

main().catch(err => { console.error(err); process.exit(1); });
