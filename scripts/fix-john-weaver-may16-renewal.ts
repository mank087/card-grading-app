import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * Backfill John Weaver's THIRD missed Card Lovers Monthly renewal (May 16).
 *
 * Identified via scripts/audit-missed-renewals.ts on 2026-05-18 — same root
 * cause as the prior two (Stripe SDK v20 moved invoice.subscription to
 * invoice.parent.subscription_details.subscription; webhook handler hit the
 * "not a subscription invoice" early return). The bug fix has now landed in
 * src/app/api/stripe/webhook/route.ts, so future renewals will credit
 * automatically — this is the last manual cleanup needed for John.
 *
 * Stripe Workbench confirmed the invoice.paid event fired at 2026-05-17
 * 02:49:13 UTC (May 16 10:49 PM ET) on subscription sub_1T1dOsHgM2Rh4o2BtfqZc3tM.
 *
 * Renewal: months_active 3 → 4. Per processCardLoverRenewal logic the
 * loyalty bonus map is {3: 5, 6: 10, 9: 15, 12: 20} — month 4 gets none.
 * So: +70 credits, period_end → 2026-06-17 02:49 UTC.
 *
 * Idempotent: skips if a `renewed` event dated 2026-05-* already exists.
 * Note: Stripe invoice ID for this renewal was not fetched (audit ran on a
 * local env with the test-mode Stripe key); recorded in metadata as
 * audit_source instead.
 */

const USER_ID = 'a5c8b7ae-2056-4b87-a887-18d9a6dcd369';
const EMAIL = 'johnweaver44@yahoo.com';
const SUBSCRIPTION_ID = 'sub_1T1dOsHgM2Rh4o2BtfqZc3tM';
const MONTHLY_CREDITS = 70;
const RENEWAL_DATE = '2026-05-17T02:49:13.000+00:00';
const NEW_PERIOD_END = '2026-06-17T02:49:00.000+00:00';

async function main() {
  // 1. Idempotency — skip if a May 2026 renewed event already exists
  const { data: existing } = await supabase
    .from('subscription_events')
    .select('id, created_at, event_type')
    .eq('user_id', USER_ID)
    .eq('event_type', 'renewed')
    .gte('created_at', '2026-05-01')
    .lt('created_at', '2026-06-01')
    .maybeSingle();
  if (existing) {
    console.log(`Already backfilled (renewed event ${existing.id} from ${existing.created_at}). Aborting.`);
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
  if (before.card_lover_months_active !== 3) {
    console.error(`Expected months_active=3 before this renewal, got ${before.card_lover_months_active}. Aborting — review audit before proceeding.`);
    return;
  }

  const newBalance = before.balance + MONTHLY_CREDITS;
  const newTotalPurchased = before.total_purchased + MONTHLY_CREDITS;
  const newMonthsActive = before.card_lover_months_active + 1; // 3 → 4

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

  // 4. subscription_events row
  const { error: subErr } = await supabase
    .from('subscription_events')
    .insert({
      user_id: USER_ID,
      event_type: 'renewed',
      plan: 'monthly',
      credits_added: MONTHLY_CREDITS,
      bonus_credits: 0,
      stripe_subscription_id: SUBSCRIPTION_ID,
      stripe_invoice_id: null, // Not captured during audit; can be filled in if needed
      metadata: {
        months_active: newMonthsActive,
        backfilled: true,
        actual_renewal_at: RENEWAL_DATE,
        audit_source: 'scripts/audit-missed-renewals.ts (2026-05-18)',
        reason: 'Webhook handler buggy invoice.subscription check missed renewal; fixed in webhook/route.ts',
      },
    });
  if (subErr) { console.error('subscription_events insert failed:', subErr); return; }
  console.log('✓ subscription_events row inserted');

  // 5. credit_transactions row
  const { error: txErr } = await supabase
    .from('credit_transactions')
    .insert({
      user_id: USER_ID,
      type: 'purchase',
      amount: MONTHLY_CREDITS,
      balance_after: newBalance,
      description: `Card Lovers Monthly — 70 credits (Month ${newMonthsActive}) [backfill: webhook missed 2026-05-16 renewal]`,
      metadata: {
        subscription: 'card_lovers',
        plan: 'monthly',
        months_active: newMonthsActive,
        loyalty_bonus: 0,
        backfilled: true,
        actual_renewal_at: RENEWAL_DATE,
        audit_source: 'scripts/audit-missed-renewals.ts',
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
  console.log(`\n✓ DONE. John Weaver's account now reflects the May 16 renewal (Month 4).`);
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
