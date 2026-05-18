import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * Backfill Michael Dishman's missed May 18, 2026 Card Lovers Monthly renewal.
 *
 * Stripe confirmed the $49.99 charge succeeded on May 18, 2026 1:17:06 PM ET
 * (17:17:06 UTC) — invoice in_1TYCgRHgM2Rh4o2B7SstRnXz, subscription
 * sub_1TNKNxHgM2Rh4o2BS99BvlT7. The original May 17 auto-renewal payment
 * failed (card was locked), DCM admin manually paid the invoice via the
 * Stripe Dashboard on May 18 once the user unlocked his card.
 *
 * Stripe fired invoice.paid + invoice.payment_succeeded +
 * customer.subscription.updated webhooks at 17:17:06 UTC, but our
 * handleInvoicePaid handler at src/app/api/stripe/webhook/route.ts:357
 * did not process them — the user_credits row still reflects the pre-renewal
 * state (months_active=1, period_end=2026-05-17, balance=72, no
 * subscription_events row for the renewal).
 *
 * This is the same recurring webhook miss pattern that produced earlier
 * fix-jeffrey-may1-renewal.ts, fix-john-weaver-renewals.ts, etc. Worth
 * investigating why Stripe webhook deliveries to our production endpoint
 * keep being missed.
 *
 * Applies the same updates that processCardLoverRenewal() in
 * src/lib/credits.ts:600 would have done for a monthly renewal at
 * months_active 1 → 2 (no loyalty bonus until month 3):
 *   - balance += 70
 *   - total_purchased += 70
 *   - card_lover_months_active 1 → 2
 *   - card_lover_current_period_end → 2026-06-17T21:57:15.969+00:00
 *   - INSERT subscription_events (event_type=renewed, stripe_invoice_id set)
 *   - INSERT credit_transactions (type=purchase, audit trail)
 *
 * Idempotent: skips if a subscription_events row with this stripe_invoice_id
 * already exists, so re-running is safe even if the original Stripe webhook
 * eventually retries successfully.
 */

const USER_ID = '40e9362f-3f3f-4b51-9eff-5c7b62ccb463';
const EMAIL = 'huskers656565@gmail.com';
const SUBSCRIPTION_ID = 'sub_1TNKNxHgM2Rh4o2BS99BvlT7';
const STRIPE_INVOICE_ID = 'in_1TYCgRHgM2Rh4o2B7SstRnXz';
const MONTHLY_CREDITS = 70;
const NEW_PERIOD_END = '2026-06-17T21:57:15.969+00:00';
const RENEWAL_DATE = '2026-05-18T17:17:06.000+00:00';
const STRIPE_DESCRIPTION = 'Stripe May 18 2026 — Subscription update (renewal after May 17 declined payment)';

async function main() {
  // 1. Idempotency on stripe_invoice_id
  const { data: existing } = await supabase
    .from('subscription_events')
    .select('id, created_at, event_type')
    .eq('user_id', USER_ID)
    .eq('stripe_invoice_id', STRIPE_INVOICE_ID)
    .maybeSingle();
  if (existing) {
    console.log(`Already backfilled (subscription_events row ${existing.id}, type ${existing.event_type}, from ${existing.created_at}). Aborting.`);
    return;
  }

  // 2. Read current state
  const { data: before, error: fetchErr } = await supabase
    .from('user_credits')
    .select('balance, total_purchased, card_lover_plan, card_lover_months_active, card_lover_current_period_end, is_card_lover')
    .eq('user_id', USER_ID)
    .single();
  if (fetchErr || !before) { console.error('Fetch failed:', fetchErr); return; }

  console.log(`=== Before (${EMAIL}) ===`);
  console.log(JSON.stringify(before, null, 2));

  if (before.card_lover_plan !== 'monthly') {
    console.error(`Plan mismatch: expected monthly, got ${before.card_lover_plan}. Aborting.`);
    return;
  }
  if (!before.is_card_lover) {
    console.error('is_card_lover is false. Aborting.');
    return;
  }

  const newBalance = before.balance + MONTHLY_CREDITS;
  const newTotalPurchased = before.total_purchased + MONTHLY_CREDITS;
  const newMonthsActive = before.card_lover_months_active + 1; // 1 → 2

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

  // 4. subscription_events row (matches processCardLoverRenewal shape)
  const { error: subErr } = await supabase
    .from('subscription_events')
    .insert({
      user_id: USER_ID,
      event_type: 'renewed',
      plan: 'monthly',
      credits_added: MONTHLY_CREDITS,
      bonus_credits: 0,
      stripe_subscription_id: SUBSCRIPTION_ID,
      stripe_invoice_id: STRIPE_INVOICE_ID,
      metadata: {
        months_active: newMonthsActive,
        backfilled: true,
        actual_renewal_at: RENEWAL_DATE,
        reason: 'Webhook handleInvoicePaid did not fire on 2026-05-18 manual invoice payment; backfilled by admin',
        stripe_description: STRIPE_DESCRIPTION,
      },
    });
  if (subErr) { console.error('subscription_events insert failed:', subErr); return; }
  console.log('✓ subscription_events row inserted');

  // 5. credit_transactions row (audit trail)
  const { error: txErr } = await supabase
    .from('credit_transactions')
    .insert({
      user_id: USER_ID,
      type: 'purchase',
      amount: MONTHLY_CREDITS,
      balance_after: newBalance,
      description: `Card Lovers Monthly — 70 credits (Month ${newMonthsActive}) [backfill: webhook missed 2026-05-18 renewal]`,
      metadata: {
        subscription: 'card_lovers',
        plan: 'monthly',
        months_active: newMonthsActive,
        loyalty_bonus: 0,
        backfilled: true,
        actual_renewal_at: RENEWAL_DATE,
        stripe_invoice_id: STRIPE_INVOICE_ID,
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
  console.log(`\n✓ DONE. Michael's account now reflects the May 18 renewal (Month 2).`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
