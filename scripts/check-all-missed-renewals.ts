import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  // Pull all Card Lovers + their subscription events
  const { data: lovers, error } = await supabase
    .from('user_credits')
    .select('user_id, balance, total_purchased, card_lover_plan, card_lover_subscribed_at, card_lover_current_period_end, card_lover_subscription_id, card_lover_months_active, updated_at, stripe_customer_id')
    .eq('is_card_lover', true)
    .order('card_lover_subscribed_at', { ascending: true });
  if (error) { console.error(error); return; }

  // Pull all auth users to get emails
  let allUsers: any[] = [];
  let page = 1;
  while (true) {
    const { data } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (!data?.users?.length) break;
    allUsers = allUsers.concat(data.users);
    if (data.users.length < 1000) break;
    page++;
  }
  const emailFor = (id: string) => allUsers.find(u => u.id === id)?.email ?? '(unknown)';

  console.log(`=== All ${lovers!.length} Card Lovers ===\n`);
  for (const l of lovers!) {
    const subscribed = l.card_lover_subscribed_at ? new Date(l.card_lover_subscribed_at) : null;
    const periodEnd = l.card_lover_current_period_end ? new Date(l.card_lover_current_period_end) : null;
    const now = new Date();

    // Roughly how many MONTHLY renewal cycles SHOULD have happened?
    let expectedRenewals = 0;
    if (subscribed && l.card_lover_plan === 'monthly') {
      const monthsSinceStart = Math.floor((now.getTime() - subscribed.getTime()) / (1000 * 60 * 60 * 24 * 30));
      expectedRenewals = Math.max(0, monthsSinceStart);
    }
    if (subscribed && l.card_lover_plan === 'annual') {
      const yearsSinceStart = Math.floor((now.getTime() - subscribed.getTime()) / (1000 * 60 * 60 * 24 * 365));
      expectedRenewals = Math.max(0, yearsSinceStart);
    }
    // months_active is initial+renewals; expected months_active = 1 + renewals
    const recordedRenewals = Math.max(0, l.card_lover_months_active - 1);
    const missed = Math.max(0, expectedRenewals - recordedRenewals);

    // Pull subscription_events for context
    const { data: evs } = await supabase
      .from('subscription_events')
      .select('event_type, created_at, credits_added, plan')
      .eq('user_id', l.user_id)
      .order('created_at', { ascending: true });

    console.log(`USER: ${emailFor(l.user_id)} (${l.user_id})`);
    console.log(`  plan: ${l.card_lover_plan} | subscribed: ${subscribed?.toISOString().slice(0, 10) ?? '(unset)'} | period_end: ${periodEnd?.toISOString().slice(0, 10) ?? '(unset)'}`);
    console.log(`  balance: ${l.balance} | total_purchased: ${l.total_purchased} | months_active: ${l.card_lover_months_active}`);
    console.log(`  expected ${l.card_lover_plan} renewals: ${expectedRenewals} | recorded: ${recordedRenewals} | MISSED: ${missed}`);
    console.log(`  events: [${evs?.map(e => `${e.event_type}@${e.created_at.slice(0, 10)}`).join(', ') ?? ''}]`);
    console.log(`  sub: ${l.card_lover_subscription_id} | customer: ${l.stripe_customer_id}`);
    console.log('');
  }

  // Summary
  const monthly = lovers!.filter(l => l.card_lover_plan === 'monthly');
  const annual = lovers!.filter(l => l.card_lover_plan === 'annual');
  console.log(`\n=== SUMMARY ===`);
  console.log(`Total Card Lovers: ${lovers!.length} (${monthly.length} monthly, ${annual.length} annual)`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
