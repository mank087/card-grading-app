import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * Correct Toby Smart's annual Card Lovers period_end.
 *
 * Stripe shows ONE charge: $449 on Apr 1, 2026 (subscription creation, no
 * renewals yet). The annual cycle should end Apr 1, 2027 — but our DB has
 * 2026-05-01, exactly 30 days after signup, because activateCardLoverSub
 * read subscription.current_period_end (deprecated; returned undefined)
 * and safeTimestampToDate fell back to "now + 30 days". The webhook bug
 * is now fixed (see commit b944777 for annual credit logic and the new
 * getSubscriptionPeriodEnd helper for the source).
 *
 * No credit backfill needed — Toby's initial 900 credits were applied
 * correctly. Only the period_end is wrong.
 */

const USER_ID = '4e985962-86a4-4280-86d8-0faa3871d29e';
const EMAIL = 'toby.smart@gmail.com';
const SUBSCRIBED_AT = '2026-04-01T17:00:38.526+00:00'; // Apr 1, 1:00 PM ET (per Stripe)
const CORRECT_PERIOD_END = '2027-04-01T17:00:38.526+00:00';

async function main() {
  const { data: before, error: fetchErr } = await supabase
    .from('user_credits')
    .select('balance, total_purchased, card_lover_plan, card_lover_subscribed_at, card_lover_current_period_end, card_lover_months_active')
    .eq('user_id', USER_ID)
    .single();
  if (fetchErr || !before) { console.error('Fetch failed:', fetchErr); return; }

  console.log(`=== Before (${EMAIL}) ===`);
  console.log(JSON.stringify(before, null, 2));

  if (before.card_lover_plan !== 'annual') {
    console.error(`Plan mismatch: expected annual, got ${before.card_lover_plan}. Aborting.`);
    return;
  }

  const { error: updateErr } = await supabase
    .from('user_credits')
    .update({ card_lover_current_period_end: CORRECT_PERIOD_END })
    .eq('user_id', USER_ID);
  if (updateErr) { console.error('Update failed:', updateErr); return; }
  console.log(`\n✓ user_credits updated: card_lover_current_period_end → ${CORRECT_PERIOD_END}`);

  const { data: after } = await supabase
    .from('user_credits')
    .select('balance, total_purchased, card_lover_plan, card_lover_subscribed_at, card_lover_current_period_end, card_lover_months_active')
    .eq('user_id', USER_ID)
    .single();
  console.log(`\n=== After ===`);
  console.log(JSON.stringify(after, null, 2));
  console.log(`\n✓ DONE. Toby's annual period now correctly ends 2027-04-01.`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
