/**
 * Reset sports no-match negative cache (WS2.8)
 *
 * Cards that failed the OLD live-API matching carry
 * dcm_price_match_confidence = 'no-match' with a fresh timestamp, which
 * suppresses retries for 7 days. After the local sports DB import, those
 * cards deserve a retry against the new matcher — this clears the marker
 * (and the timestamp) so the weekly cron / manual refresh picks them up.
 *
 * Usage: node scripts/reset-sports-nomatch-cache.js [--dry-run]
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');
const SPORTS_CATEGORIES = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports'];

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase
    .from('cards')
    .select('id, category')
    .eq('dcm_price_match_confidence', 'no-match')
    .in('category', SPORTS_CATEGORIES);

  if (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }

  console.log(`${data.length} sports cards carry a no-match marker`);
  if (DRY_RUN || data.length === 0) {
    if (DRY_RUN) console.log('(dry run — nothing changed)');
    return;
  }

  const ids = data.map(c => c.id);
  const BATCH = 200;
  let cleared = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const { error: updateErr } = await supabase
      .from('cards')
      .update({ dcm_price_match_confidence: null, dcm_price_updated_at: null })
      .in('id', ids.slice(i, i + BATCH));
    if (updateErr) {
      console.error('Update failed:', updateErr.message);
      process.exit(1);
    }
    cleared += Math.min(BATCH, ids.length - i);
    console.log(`  cleared ${cleared}/${ids.length}`);
  }
  console.log('✅ Done — these cards will re-match on the next cron run or manual refresh');
}

main();
