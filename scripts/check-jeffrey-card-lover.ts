import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const targetEmail = 'jgagrading@gmail.com';

  // Find user by email
  let allUsers: any[] = [];
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) { console.error('listUsers error:', error); return; }
    allUsers = allUsers.concat(data.users);
    if (data.users.length < perPage) break;
    page++;
  }
  const user = allUsers.find(u => u.email?.toLowerCase() === targetEmail.toLowerCase());
  if (!user) { console.error('User not found with email:', targetEmail); return; }

  console.log('=== USER INFO ===');
  console.log('User ID:', user.id);
  console.log('Email:', user.email);
  console.log('Created:', user.created_at);
  console.log('Last sign in:', user.last_sign_in_at);

  const { data: credits, error: creditsError } = await supabase
    .from('user_credits')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (creditsError) {
    console.error('Error fetching user_credits:', creditsError);
  } else {
    console.log('\n=== USER CREDITS ===');
    console.log('Balance:', credits.balance);
    console.log('Total purchased:', credits.total_purchased);
    console.log('Is Card Lover:', credits.is_card_lover);
    console.log('Card Lover Plan:', credits.card_lover_plan);
    console.log('Card Lover Subscribed At:', credits.card_lover_subscribed_at);
    console.log('Card Lover Period End:', credits.card_lover_current_period_end);
    console.log('Card Lover Subscription ID:', credits.card_lover_subscription_id);
    console.log('Card Lover Months Active:', credits.card_lover_months_active);
    console.log('Stripe Customer ID:', credits.stripe_customer_id);
    console.log('Updated At:', credits.updated_at);
  }

  // Subscription events — look for May 1st invoice.paid / customer.subscription.updated
  const { data: subEvents, error: subError } = await supabase
    .from('subscription_events')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('\n=== SUBSCRIPTION EVENTS (most recent 20) ===');
  if (subError) console.error('Error:', subError);
  else if (!subEvents?.length) console.log('(No subscription events found)');
  else subEvents.forEach((e: any) => {
    console.log(`  ${e.created_at} | ${e.event_type} | plan: ${e.plan} | credits: ${e.credits_added} | bonus: ${e.bonus_credits ?? ''} | stripe_sub: ${e.stripe_subscription_id} | stripe_event: ${e.stripe_event_id}`);
  });

  // Credit transactions — confirm whether 70 credits posted on May 1
  const { data: transactions, error: txError } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('\n=== CREDIT TRANSACTIONS (most recent 20) ===');
  if (txError) console.error('Error:', txError);
  else if (!transactions?.length) console.log('(No credit transactions found)');
  else transactions.forEach((t: any) => {
    console.log(`  ${t.created_at} | ${t.type} | amount: ${t.amount} | balance_after: ${t.balance_after} | "${t.description}" | session: ${t.stripe_session_id} | invoice: ${t.stripe_invoice_id ?? ''}`);
  });
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
