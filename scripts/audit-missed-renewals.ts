/**
 * Audit script: find Card Lovers whose subscription renewals were silently
 * missed by the buggy invoice.subscription check in the webhook handler
 * (fixed in src/app/api/stripe/webhook/route.ts handleInvoicePaid).
 *
 * Strategy:
 *   For each active Card Lover, compute how many monthly cycles (or one
 *   annual cycle) SHOULD have been credited based on time since
 *   card_lover_subscribed_at, then compare against card_lover_months_active
 *   and the count of `renewed` rows in subscription_events.
 *
 *   Anyone where expected > actual is a candidate for backfill. The script
 *   only flags candidates — it does NOT mutate the DB. Cross-reference each
 *   candidate against Stripe (Customers → invoices) before backfilling.
 *
 * Run with:
 *   npx tsx scripts/audit-missed-renewals.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type Row = {
  user_id: string;
  email: string | null;
  is_card_lover: boolean;
  card_lover_plan: string | null;
  card_lover_subscribed_at: string | null;
  card_lover_current_period_end: string | null;
  card_lover_months_active: number | null;
  card_lover_subscription_id: string | null;
  stripe_customer_id: string | null;
};

function monthsBetween(start: Date, end: Date): number {
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    (end.getDate() >= start.getDate() ? 0 : -1)
  );
}

async function main() {
  // 1. Pull every active Card Lover
  const { data: clRows, error } = await supabase
    .from('user_credits')
    .select(`
      user_id,
      is_card_lover,
      card_lover_plan,
      card_lover_subscribed_at,
      card_lover_current_period_end,
      card_lover_months_active,
      card_lover_subscription_id,
      stripe_customer_id
    `)
    .eq('is_card_lover', true);
  if (error || !clRows) { console.error('Query failed:', error); return; }

  console.log(`Active Card Lovers: ${clRows.length}\n`);

  // 2. Pull emails from auth for these user_ids (one paged list, then map)
  const emailById = new Map<string, string>();
  for (let page = 1; page <= 50; page++) {
    const { data } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (!data.users.length) break;
    for (const u of data.users) {
      if (u.email) emailById.set(u.id, u.email);
    }
    if (data.users.length < 200) break;
  }

  // 3. Pull all `renewed` subscription_events grouped by user
  const { data: renewalEvents } = await supabase
    .from('subscription_events')
    .select('user_id, created_at, stripe_invoice_id, plan')
    .eq('event_type', 'renewed');
  const renewalsByUser = new Map<string, { created_at: string; stripe_invoice_id: string | null; plan: string }[]>();
  for (const r of renewalEvents || []) {
    if (!renewalsByUser.has(r.user_id)) renewalsByUser.set(r.user_id, []);
    renewalsByUser.get(r.user_id)!.push(r);
  }

  // 4. Diff
  const now = new Date();
  const suspects: any[] = [];
  let skippedComp = 0;
  for (const row of clRows as Row[]) {
    const subscribedAt = row.card_lover_subscribed_at ? new Date(row.card_lover_subscribed_at) : null;
    if (!subscribedAt) continue;
    // Skip comp / admin accounts — they have no Stripe subscription so the
    // expected-vs-actual math doesn't apply.
    if (!row.card_lover_subscription_id) { skippedComp++; continue; }

    const renewals = renewalsByUser.get(row.user_id) || [];
    let expected: number;
    if (row.card_lover_plan === 'annual') {
      // Annual: one renewal per year since subscribe
      const years = Math.floor((now.getTime() - subscribedAt.getTime()) / (365.25 * 24 * 3600 * 1000));
      expected = years;
    } else {
      // Monthly: months_active should be (months since subscribe) + 1 initial
      // We compare on # of `renewed` events, which equals months_active - 1.
      // So expected renewed events = months elapsed since subscribe.
      expected = monthsBetween(subscribedAt, now);
    }

    const actual = renewals.length;
    // card_lover_months_active includes the initial cycle, so a user just
    // past one full renewal should be at months_active = 2. The renewed
    // event count is the cleanest indicator.

    if (expected > actual) {
      const periodEndPassed = row.card_lover_current_period_end
        ? new Date(row.card_lover_current_period_end) < now
        : false;
      suspects.push({
        user_id: row.user_id,
        email: emailById.get(row.user_id) || row.user_id,
        plan: row.card_lover_plan,
        subscribed_at: row.card_lover_subscribed_at,
        current_period_end: row.card_lover_current_period_end,
        period_end_in_past: periodEndPassed,
        months_active: row.card_lover_months_active,
        expected_renewals: expected,
        actual_renewals: actual,
        gap: expected - actual,
        subscription_id: row.card_lover_subscription_id,
        stripe_customer_id: row.stripe_customer_id,
      });
    }
  }

  if (skippedComp) console.log(`Skipped ${skippedComp} comp/admin Card Lover account(s) (no Stripe subscription_id).\n`);

  if (!suspects.length) {
    console.log('✓ No silently-missed renewals detected. All Card Lovers up to date.');
    return;
  }

  suspects.sort((a, b) => b.gap - a.gap);
  console.log(`Found ${suspects.length} suspected user(s) with at least one missed renewal:\n`);
  console.log('═'.repeat(140));
  console.log('email'.padEnd(40), '| plan   | subscribed             | period_end             | past | mo_active | exp | act | gap | sub_id');
  console.log('─'.repeat(140));
  for (const s of suspects) {
    console.log(
      (s.email || s.user_id).padEnd(40),
      '|', String(s.plan).padEnd(6),
      '|', String(s.subscribed_at || 'n/a').slice(0, 22),
      '|', String(s.current_period_end || 'n/a').slice(0, 22),
      '|', s.period_end_in_past ? 'YES ' : 'no  ',
      '|', String(s.months_active ?? 'n/a').padStart(9),
      '|', String(s.expected_renewals).padStart(3),
      '|', String(s.actual_renewals).padStart(3),
      '|', String(s.gap).padStart(3),
      '|', s.subscription_id || 'n/a',
    );
  }
  console.log('═'.repeat(140));
  console.log('');
  console.log('NEXT STEPS:');
  console.log('  1. For each user above, look up cus_* in Stripe Dashboard → Customers');
  console.log('  2. Confirm the missing renewal invoice(s) are marked Paid');
  console.log('  3. Run scripts/backfill-missed-renewals.ts (or per-user manual fix script)');
  console.log('');
  console.log('JSON output (pipe to a file for backfill script input):');
  console.log(JSON.stringify(suspects, null, 2));
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
