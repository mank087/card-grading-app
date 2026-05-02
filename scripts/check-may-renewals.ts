import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  // 1. All subscription_events on/around May 1
  console.log('=== SUBSCRIPTION_EVENTS on/around 2026-05-01 (April 28 → May 4) ===');
  const { data: events, error: evErr } = await supabase
    .from('subscription_events')
    .select('*')
    .gte('created_at', '2026-04-28')
    .lt('created_at', '2026-05-05')
    .order('created_at', { ascending: true });
  if (evErr) console.error('Error:', evErr);
  else if (!events?.length) {
    console.log('(NO subscription_events in this 7-day window)');
  } else {
    console.log(`Found ${events.length} events:`);
    events.forEach((e: any) => {
      console.log(`  ${e.created_at} | user: ${e.user_id} | ${e.event_type} | plan: ${e.plan} | credits: ${e.credits_added} | sub: ${e.stripe_subscription_id}`);
    });
  }

  // 2. All Card Lovers whose period_end was May 1 (should have renewed)
  console.log('\n=== CARD LOVERS with period_end on 2026-05-01 ===');
  const { data: lovers, error: lvErr } = await supabase
    .from('user_credits')
    .select('user_id, balance, card_lover_plan, card_lover_subscribed_at, card_lover_current_period_end, card_lover_subscription_id, card_lover_months_active, updated_at')
    .eq('is_card_lover', true)
    .gte('card_lover_current_period_end', '2026-05-01')
    .lt('card_lover_current_period_end', '2026-05-02')
    .order('card_lover_current_period_end', { ascending: true });
  if (lvErr) console.error('Error:', lvErr);
  else if (!lovers?.length) {
    console.log('(none)');
  } else {
    console.log(`Found ${lovers.length} Card Lovers due for renewal on May 1:`);
    lovers.forEach((l: any) => {
      console.log(`  user: ${l.user_id} | plan: ${l.card_lover_plan} | balance: ${l.balance} | months: ${l.card_lover_months_active} | sub: ${l.card_lover_subscription_id} | updated: ${l.updated_at}`);
    });
  }

  // 3. Card Lovers whose period_end has now passed but updated_at < period_end
  // (likely missed renewal)
  console.log('\n=== CARD LOVERS with period_end in the past (might have missed renewal) ===');
  const todayIso = new Date().toISOString();
  const { data: stale, error: stErr } = await supabase
    .from('user_credits')
    .select('user_id, balance, card_lover_plan, card_lover_current_period_end, card_lover_months_active, updated_at')
    .eq('is_card_lover', true)
    .lt('card_lover_current_period_end', todayIso)
    .order('card_lover_current_period_end', { ascending: true });
  if (stErr) console.error('Error:', stErr);
  else if (!stale?.length) {
    console.log('(none)');
  } else {
    console.log(`Found ${stale.length} Card Lovers with stale period_end (in the past):`);
    stale.forEach((l: any) => {
      console.log(`  user: ${l.user_id} | period_end: ${l.card_lover_current_period_end} | balance: ${l.balance} | months: ${l.card_lover_months_active} | updated: ${l.updated_at}`);
    });
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
