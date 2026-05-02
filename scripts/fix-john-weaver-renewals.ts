import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * Backfill John Weaver's TWO missed Card Lovers Monthly renewals.
 *
 * Stripe payments confirmed:
 *   2026-02-16  $49.99  Subscription creation  (initial — already credited)
 *   2026-03-16  $49.99  Subscription update    (renewal #1 — MISSED)
 *   2026-04-16  $49.99  Subscription update    (renewal #2 — MISSED)
 *
 * Same root cause as Jeffrey: handleInvoicePaid never fired (zero `renewed`
 * events ever in subscription_events). Per processCardLoverRenewal logic in
 * src/lib/credits.ts:606-614, the per-renewal additions are:
 *
 *   Renewal 1 (months_active 1 → 2):  70 credits, no loyalty bonus
 *   Renewal 2 (months_active 2 → 3):  70 credits + 5 loyalty bonus = 75
 *
 * Total backfill: 145 credits.
 *
 * Idempotent: skips if any `renewed` event already exists for this user.
 */

const USER_ID = 'a5c8b7ae-2056-4b87-a887-18d9a6dcd369';
const EMAIL = 'johnweaver44@yahoo.com';
const SUBSCRIPTION_ID = 'sub_1T1dOsHgM2Rh4o2BtfqZc3tM';
const RENEWAL_1_DATE = '2026-03-17T02:49:00.000+00:00'; // Mar 16 22:49 ET → Mar 17 02:49 UTC
const RENEWAL_2_DATE = '2026-04-17T02:49:00.000+00:00'; // Apr 16 22:49 ET → Apr 17 02:49 UTC
const NEW_PERIOD_END = '2026-05-17T02:49:00.000+00:00'; // Next renewal due ~May 16

async function main() {
  // 1. Idempotency check
  const { data: existing } = await supabase
    .from('subscription_events')
    .select('id, created_at, event_type')
    .eq('user_id', USER_ID)
    .eq('event_type', 'renewed')
    .maybeSingle();
  if (existing) {
    console.log(`Already backfilled (renewed event ${existing.id} at ${existing.created_at}). Aborting.`);
    return;
  }

  // 2. Read current state
  const { data: before, error: fetchErr } = await supabase
    .from('user_credits')
    .select('balance, total_purchased, card_lover_plan, card_lover_months_active, card_lover_current_period_end')
    .eq('user_id', USER_ID)
    .single();
  if (fetchErr || !before) { console.error('Fetch failed:', fetchErr); return; }

  console.log(`=== Before (${EMAIL}) ===`);
  console.log(JSON.stringify(before, null, 2));

  if (before.card_lover_plan !== 'monthly') {
    console.error(`Plan mismatch: expected monthly, got ${before.card_lover_plan}. Aborting.`);
    return;
  }

  // Renewal #1: month 1 → 2, +70, no bonus
  const RENEWAL_1_CREDITS = 70;
  const RENEWAL_1_BONUS = 0;
  const r1Total = RENEWAL_1_CREDITS + RENEWAL_1_BONUS;
  const r1Balance = before.balance + r1Total;
  const r1Months = before.card_lover_months_active + 1;

  // Renewal #2: month 2 → 3, +70, +5 loyalty bonus
  const RENEWAL_2_CREDITS = 70;
  const RENEWAL_2_BONUS = 5; // loyalty bonus at month 3 per src/lib/credits.ts:610
  const r2Total = RENEWAL_2_CREDITS + RENEWAL_2_BONUS;
  const r2Balance = r1Balance + r2Total;
  const r2Months = r1Months + 1;

  const totalAdded = r1Total + r2Total;
  const newTotalPurchased = before.total_purchased + totalAdded;

  console.log(`\nWill apply:`);
  console.log(`  Renewal 1 (Mar 16): +${RENEWAL_1_CREDITS} credits → balance ${before.balance} → ${r1Balance}, months ${before.card_lover_months_active} → ${r1Months}`);
  console.log(`  Renewal 2 (Apr 16): +${RENEWAL_2_CREDITS} credits +${RENEWAL_2_BONUS} loyalty → balance ${r1Balance} → ${r2Balance}, months ${r1Months} → ${r2Months}`);
  console.log(`  Total added: ${totalAdded} credits`);

  // 3. Update user_credits to final state
  const { error: updateErr } = await supabase
    .from('user_credits')
    .update({
      balance: r2Balance,
      total_purchased: newTotalPurchased,
      card_lover_months_active: r2Months,
      card_lover_current_period_end: NEW_PERIOD_END,
    })
    .eq('user_id', USER_ID);
  if (updateErr) { console.error('Update failed:', updateErr); return; }
  console.log(`\n✓ user_credits updated: balance → ${r2Balance}, months → ${r2Months}, period_end → ${NEW_PERIOD_END}`);

  // 4. Insert subscription_events for both renewals
  const subEventsResult = await supabase
    .from('subscription_events')
    .insert([
      {
        user_id: USER_ID,
        event_type: 'renewed',
        plan: 'monthly',
        credits_added: RENEWAL_1_CREDITS,
        bonus_credits: RENEWAL_1_BONUS,
        stripe_subscription_id: SUBSCRIPTION_ID,
        metadata: { months_active: r1Months, backfilled: true, actual_renewal_at: RENEWAL_1_DATE, reason: 'Webhook handleInvoicePaid did not fire on 2026-03-16; manual backfill' },
      },
      {
        user_id: USER_ID,
        event_type: 'renewed',
        plan: 'monthly',
        credits_added: RENEWAL_2_CREDITS,
        bonus_credits: RENEWAL_2_BONUS,
        stripe_subscription_id: SUBSCRIPTION_ID,
        metadata: { months_active: r2Months, backfilled: true, actual_renewal_at: RENEWAL_2_DATE, reason: 'Webhook handleInvoicePaid did not fire on 2026-04-16; manual backfill' },
      },
      {
        user_id: USER_ID,
        event_type: 'loyalty_bonus',
        plan: 'monthly',
        credits_added: 0,
        bonus_credits: RENEWAL_2_BONUS,
        stripe_subscription_id: SUBSCRIPTION_ID,
        metadata: { milestone_month: r2Months, backfilled: true, actual_renewal_at: RENEWAL_2_DATE },
      },
    ]);
  if (subEventsResult.error) { console.error('subscription_events insert failed:', subEventsResult.error); return; }
  console.log('✓ 3 subscription_events rows inserted (2 renewed + 1 loyalty_bonus)');

  // 5. Insert credit_transactions for both renewals
  const txResult = await supabase
    .from('credit_transactions')
    .insert([
      {
        user_id: USER_ID,
        type: 'purchase',
        amount: r1Total,
        balance_after: r1Balance,
        description: `Card Lovers Monthly — 70 credits (Month ${r1Months}) [backfill: webhook missed 2026-03-16 renewal]`,
        metadata: { subscription: 'card_lovers', plan: 'monthly', months_active: r1Months, loyalty_bonus: 0, backfilled: true, actual_renewal_at: RENEWAL_1_DATE },
      },
      {
        user_id: USER_ID,
        type: 'purchase',
        amount: r2Total,
        balance_after: r2Balance,
        description: `Card Lovers Monthly — 70 credits + 5 loyalty bonus (Month ${r2Months}) [backfill: webhook missed 2026-04-16 renewal]`,
        metadata: { subscription: 'card_lovers', plan: 'monthly', months_active: r2Months, loyalty_bonus: RENEWAL_2_BONUS, backfilled: true, actual_renewal_at: RENEWAL_2_DATE },
      },
    ]);
  if (txResult.error) { console.error('credit_transactions insert failed:', txResult.error); return; }
  console.log('✓ 2 credit_transactions rows inserted');

  // 6. Verify
  const { data: after } = await supabase
    .from('user_credits')
    .select('balance, total_purchased, card_lover_plan, card_lover_months_active, card_lover_current_period_end')
    .eq('user_id', USER_ID)
    .single();
  console.log(`\n=== After ===`);
  console.log(JSON.stringify(after, null, 2));
  console.log(`\n✓ DONE. John's account now reflects both missed renewals (Mar 16 + Apr 16).`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
