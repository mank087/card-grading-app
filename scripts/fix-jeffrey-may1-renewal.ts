import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * Backfill Jeffrey's missed May 1, 2026 Card Lovers Monthly renewal.
 *
 * Stripe confirmed the $49.99 charge succeeded on May 1, 10:32 AM (Subscription
 * update / renewal of sub_1THOj4HgM2Rh4o2BDHhdroBm). The webhook handler at
 * src/app/api/stripe/webhook/route.ts:handleInvoicePaid never processed the
 * `invoice.paid` event for this renewal — see check-renewals-ever.ts which
 * shows zero `renewed` event_type rows in subscription_events ever.
 *
 * This script applies the same updates the renewal handler should have:
 *   - balance += 70
 *   - total_purchased += 70
 *   - card_lover_months_active += 1 (1 → 2)
 *   - card_lover_current_period_end → 2026-06-01T13:22:33Z (one month forward)
 *   - INSERT subscription_events (event_type=renewed)
 *   - INSERT credit_transactions (type=purchase)
 *
 * Idempotent: skips if a `renewed` subscription_events row already exists for
 * this user/sub from May 2026 (so re-running is safe).
 */

const USER_ID = '06c576a2-5012-446d-848d-abd57fcd7bcd';
const EMAIL = 'jgagrading@gmail.com';
const SUBSCRIPTION_ID = 'sub_1THOj4HgM2Rh4o2BDHhdroBm';
const MONTHLY_CREDITS = 70;
const NEW_PERIOD_END = '2026-06-01T13:22:33.139+00:00';
const RENEWAL_DATE = '2026-05-01T14:32:00.000+00:00'; // 10:32 AM ET == 14:32 UTC
const STRIPE_DESCRIPTION = 'Stripe May 1 2026 — Subscription update (renewal)';

async function main() {
  // 1. Idempotency check
  const { data: existing } = await supabase
    .from('subscription_events')
    .select('id, created_at')
    .eq('user_id', USER_ID)
    .eq('event_type', 'renewed')
    .gte('created_at', '2026-05-01')
    .lt('created_at', '2026-05-08')
    .maybeSingle();
  if (existing) {
    console.log(`Already backfilled (subscription_events row ${existing.id} from ${existing.created_at}). Aborting.`);
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

  const newBalance = before.balance + MONTHLY_CREDITS;
  const newTotalPurchased = before.total_purchased + MONTHLY_CREDITS;
  const newMonthsActive = before.card_lover_months_active + 1;

  // 3. Update user_credits
  const { error: updateErr } = await supabase
    .from('user_credits')
    .update({
      balance: newBalance,
      total_purchased: newTotalPurchased,
      card_lover_months_active: newMonthsActive,
      card_lover_current_period_end: NEW_PERIOD_END,
    })
    .eq('user_id', USER_ID);
  if (updateErr) { console.error('Update failed:', updateErr); return; }
  console.log(`\n✓ user_credits updated: balance ${before.balance} → ${newBalance}, months ${before.card_lover_months_active} → ${newMonthsActive}, period_end → ${NEW_PERIOD_END}`);

  // 4. Insert subscription_events (event_type=renewed)
  // Match the shape used by processCardLoverRenewal in src/lib/credits.ts
  const { error: subErr } = await supabase
    .from('subscription_events')
    .insert({
      user_id: USER_ID,
      event_type: 'renewed',
      plan: 'monthly',
      credits_added: MONTHLY_CREDITS,
      bonus_credits: 0,
      stripe_subscription_id: SUBSCRIPTION_ID,
      metadata: {
        months_active: newMonthsActive,
        backfilled: true,
        actual_renewal_at: RENEWAL_DATE,
        reason: 'Webhook handleInvoicePaid did not fire on 2026-05-01; manual backfill',
        stripe_description: STRIPE_DESCRIPTION,
      },
    });
  if (subErr) { console.error('subscription_events insert failed:', subErr); return; }
  console.log('✓ subscription_events row inserted');

  // 5. Insert credit_transactions (audit trail)
  const { error: txErr } = await supabase
    .from('credit_transactions')
    .insert({
      user_id: USER_ID,
      type: 'purchase',
      amount: MONTHLY_CREDITS,
      balance_after: newBalance,
      description: `Card Lovers Monthly — 70 credits (Month ${newMonthsActive}) [backfill: webhook missed 2026-05-01 renewal]`,
      metadata: {
        subscription: 'card_lovers',
        plan: 'monthly',
        months_active: newMonthsActive,
        loyalty_bonus: 0,
        backfilled: true,
        actual_renewal_at: RENEWAL_DATE,
        stripe_description: STRIPE_DESCRIPTION,
      },
    });
  if (txErr) { console.error('credit_transactions insert failed:', txErr); return; }
  console.log('✓ credit_transactions row inserted');

  // 6. Verify
  const { data: after } = await supabase
    .from('user_credits')
    .select('balance, total_purchased, card_lover_plan, card_lover_months_active, card_lover_current_period_end')
    .eq('user_id', USER_ID)
    .single();
  console.log(`\n=== After ===`);
  console.log(JSON.stringify(after, null, 2));
  console.log(`\n✓ DONE. Jeffrey's account now reflects the May 1 renewal.`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
