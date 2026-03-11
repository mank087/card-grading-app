import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixCardLoverStatus() {
  const userId = '48846a6b-26e1-4241-ab54-8fd5f0d6c4f0'; // Dimitri Audie
  const MONTHLY_CREDITS = 70;

  // 1. Get current balance
  const { data: current, error: fetchError } = await supabase
    .from('user_credits')
    .select('balance, total_purchased')
    .eq('user_id', userId)
    .single();

  if (fetchError || !current) {
    console.error('Error fetching current credits:', fetchError);
    return;
  }

  console.log('Current balance:', current.balance);
  console.log('Current total_purchased:', current.total_purchased);

  const newBalance = current.balance + MONTHLY_CREDITS;
  const newTotalPurchased = current.total_purchased + MONTHLY_CREDITS;

  // 2. Activate Card Lovers + add credits
  const { data, error } = await supabase
    .from('user_credits')
    .update({
      is_card_lover: true,
      card_lover_plan: 'monthly',
      card_lover_subscribed_at: '2026-02-12T19:18:00.000Z', // approximate time of Stripe payment
      card_lover_current_period_end: new Date(
        new Date('2026-02-12T19:18:00.000Z').getTime() + 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
      card_lover_months_active: 1,
      show_card_lover_badge: true,
      balance: newBalance,
      total_purchased: newTotalPurchased,
    })
    .eq('user_id', userId)
    .select();

  if (error) {
    console.error('Error updating user_credits:', error);
    return;
  }

  console.log('\nCard Lovers status activated!');
  console.log('New balance:', newBalance);

  // 3. Record credit transaction for audit trail
  const { error: txError } = await supabase
    .from('credit_transactions')
    .insert({
      user_id: userId,
      type: 'purchase',
      amount: MONTHLY_CREDITS,
      balance_after: newBalance,
      description: 'Card Lovers monthly subscription - 70 credits (manual fix: webhook did not process)',
    });

  if (txError) {
    console.error('Error recording transaction:', txError);
  } else {
    console.log('Credit transaction recorded.');
  }

  // 4. Record subscription event
  const { error: subError } = await supabase
    .from('subscription_events')
    .insert({
      user_id: userId,
      event_type: 'subscribed',
      plan: 'monthly',
      credits_added: MONTHLY_CREDITS,
      bonus_credits: 0,
    });

  if (subError) {
    console.error('Error recording subscription event:', subError);
  } else {
    console.log('Subscription event recorded.');
  }

  // 5. Verify final state
  const { data: final } = await supabase
    .from('user_credits')
    .select('balance, is_card_lover, card_lover_plan, card_lover_current_period_end, show_card_lover_badge')
    .eq('user_id', userId)
    .single();

  console.log('\n=== FINAL STATE ===');
  console.log(JSON.stringify(final, null, 2));
}

fixCardLoverStatus();
