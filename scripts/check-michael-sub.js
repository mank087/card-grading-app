require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const EMAIL = process.argv[2] || 'huskers656565@gmail.com';

async function findUserByEmail(email) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    if (!data.users.length) return null;
    const hit = data.users.find(u => (u.email || '').toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < 200) return null; // last page
  }
  return null;
}

async function main() {
  let user = await findUserByEmail(EMAIL);

  if (!user) {
    console.log('No auth user found for', EMAIL);
    console.log('Searching for similar emails containing "huskers"...');
    for (let page = 1; page <= 50; page++) {
      const { data } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      if (!data.users.length) break;
      const matches = data.users.filter(u => (u.email || '').toLowerCase().includes('huskers') || (u.email || '').toLowerCase().includes('dishman'));
      matches.forEach(m => console.log('  candidate:', m.id, m.email, '| created:', m.created_at));
      if (data.users.length < 200) break;
    }
    process.exit(0);
  }

  console.log('User ID:', user.id);
  console.log('Email:', user.email);
  console.log('Created at:', user.created_at);
  console.log('Last sign-in:', user.last_sign_in_at);
  console.log('');

  const { data: credits } = await supabase
    .from('user_credits')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (credits) {
    console.log('=== USER CREDITS ===');
    console.log('All columns             :', Object.keys(credits).join(', '));
    console.log('Balance (best-guess)    :', credits.balance ?? credits.credits ?? credits.credit_balance ?? 'unknown');
    console.log('Is Card Lover           :', credits.is_card_lover);
    console.log('Card Lover Plan         :', credits.card_lover_plan);
    console.log('Subscribed At           :', credits.card_lover_subscribed_at);
    console.log('Current Period End      :', credits.card_lover_current_period_end);
    console.log('Subscription ID         :', credits.card_lover_subscription_id);
    console.log('Months Active           :', credits.card_lover_months_active);
    console.log('Stripe Customer ID      :', credits.stripe_customer_id);
    console.log('Is Founder              :', credits.is_founder);
    console.log('Is VIP                  :', credits.is_vip);
    console.log('');
  } else {
    console.log('No user_credits row found.');
  }

  // Last 15 credit transactions, newest first
  const { data: transactions } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(15);

  console.log('=== LAST 15 CREDIT TRANSACTIONS (newest first) ===');
  if (transactions && transactions.length) {
    transactions.forEach(function(t) {
      console.log(t.created_at, '|', t.type, '|', (t.amount >= 0 ? '+' : '') + t.amount, '| balance:', t.balance_after, '|', (t.description || '').slice(0, 80));
    });
  } else {
    console.log('No transactions.');
  }
  console.log('');

  // Last 10 subscription events
  const { data: subEvents } = await supabase
    .from('subscription_events')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('=== LAST 10 SUBSCRIPTION EVENTS (newest first) ===');
  if (subEvents && subEvents.length) {
    subEvents.forEach(function(e) {
      console.log(e.created_at, '|', e.event_type, '|', e.plan, '| credits:', e.credits_added, '| bonus:', e.bonus_credits, '| invoice:', e.stripe_invoice_id || 'n/a');
    });
  } else {
    console.log('No subscription events.');
  }
}

main().catch(function (err) { console.error(err); process.exit(1); });
