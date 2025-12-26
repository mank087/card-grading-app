/**
 * Credit management system for DCM Grading
 */

import { createClient } from '@supabase/supabase-js';

// Create a Supabase client with service role for server-side operations
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface UserCredits {
  id: string;
  user_id: string;
  balance: number;
  total_purchased: number;
  total_used: number;
  first_purchase_bonus_claimed: boolean;
  signup_bonus_claimed: boolean;
  stripe_customer_id: string | null;
  is_founder: boolean;
  founder_purchased_at: string | null;
  show_founder_badge: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  type: 'purchase' | 'bonus' | 'grade' | 'regrade' | 'refund' | 'admin_adjustment';
  amount: number;
  balance_after: number;
  description: string | null;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  card_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Get or create user credits record
 */
export async function getUserCredits(userId: string): Promise<UserCredits | null> {
  const supabase = getServiceClient();

  // Try to get existing credits
  const { data, error } = await supabase
    .from('user_credits')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found, which is ok
    console.error('Error fetching user credits:', error);
    return null;
  }

  // If no credits record exists, create one with 1 free signup credit
  if (!data) {
    const { data: newCredits, error: createError } = await supabase
      .from('user_credits')
      .insert({
        user_id: userId,
        balance: 1, // 1 free credit for signing up
        total_purchased: 0,
        total_used: 0,
        first_purchase_bonus_claimed: false,
        signup_bonus_claimed: true,
        is_founder: false,
        show_founder_badge: true,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating user credits:', createError);
      return null;
    }

    // Record the signup bonus transaction for audit trail
    if (newCredits) {
      await supabase.from('credit_transactions').insert({
        user_id: userId,
        type: 'bonus',
        amount: 1,
        balance_after: 1,
        description: 'Welcome bonus - 1 free credit for signing up',
        metadata: { bonus_type: 'signup' },
      });
    }

    return newCredits;
  }

  return data;
}

/**
 * Check if user has sufficient credits
 */
export async function hasCredits(userId: string, amount: number = 1): Promise<boolean> {
  const credits = await getUserCredits(userId);
  return credits !== null && credits.balance >= amount;
}

/**
 * Add credits to user account (used after successful payment)
 */
export async function addCredits(
  userId: string,
  amount: number,
  options: {
    stripeSessionId?: string;
    stripePaymentIntentId?: string;
    description?: string;
    isFirstPurchase?: boolean;
    bonusCredits?: number; // Tier-specific bonus credits (Basic: 1, Pro: 2, Elite: 5)
  } = {}
): Promise<{ success: boolean; newBalance: number; bonusAdded: boolean; bonusAmount: number }> {
  const supabase = getServiceClient();

  // Get current credits
  const credits = await getUserCredits(userId);
  if (!credits) {
    return { success: false, newBalance: 0, bonusAdded: false, bonusAmount: 0 };
  }

  // Check if this is first purchase and add tier-specific bonus
  let totalToAdd = amount;
  let bonusAdded = false;
  let bonusAmount = 0;

  if (options.isFirstPurchase && !credits.first_purchase_bonus_claimed) {
    // Use tier-specific bonus if provided, otherwise default to 1
    bonusAmount = options.bonusCredits ?? 1;
    totalToAdd += bonusAmount;
    bonusAdded = true;
  }

  const newBalance = credits.balance + totalToAdd;

  // Update credits balance
  const { error: updateError } = await supabase
    .from('user_credits')
    .update({
      balance: newBalance,
      total_purchased: credits.total_purchased + totalToAdd,
      first_purchase_bonus_claimed: bonusAdded ? true : credits.first_purchase_bonus_claimed,
    })
    .eq('user_id', userId);

  if (updateError) {
    console.error('Error updating credits:', updateError);
    return { success: false, newBalance: credits.balance, bonusAdded: false, bonusAmount: 0 };
  }

  // Record the purchase transaction
  await supabase.from('credit_transactions').insert({
    user_id: userId,
    type: 'purchase',
    amount: amount,
    balance_after: newBalance - (bonusAdded ? bonusAmount : 0), // Balance after purchase, before bonus
    description: options.description || `Purchased ${amount} credit(s)`,
    stripe_session_id: options.stripeSessionId,
    stripe_payment_intent_id: options.stripePaymentIntentId,
  });

  // Record bonus transaction separately if applicable
  if (bonusAdded) {
    await supabase.from('credit_transactions').insert({
      user_id: userId,
      type: 'bonus',
      amount: bonusAmount,
      balance_after: newBalance,
      description: `DCM Launch Special - ${bonusAmount} bonus credit${bonusAmount !== 1 ? 's' : ''}`,
      stripe_session_id: options.stripeSessionId,
    });
  }

  return { success: true, newBalance, bonusAdded, bonusAmount };
}

/**
 * Deduct credits from user account (used when grading)
 */
export async function deductCredit(
  userId: string,
  options: {
    cardId?: string;
    isRegrade?: boolean;
    description?: string;
  } = {}
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  const supabase = getServiceClient();

  // Get current credits
  const credits = await getUserCredits(userId);
  if (!credits) {
    return { success: false, newBalance: 0, error: 'User credits not found' };
  }

  if (credits.balance < 1) {
    return { success: false, newBalance: credits.balance, error: 'Insufficient credits' };
  }

  const newBalance = credits.balance - 1;

  // Update credits balance
  const { error: updateError } = await supabase
    .from('user_credits')
    .update({
      balance: newBalance,
      total_used: credits.total_used + 1,
    })
    .eq('user_id', userId);

  if (updateError) {
    console.error('Error deducting credit:', updateError);
    return { success: false, newBalance: credits.balance, error: 'Database error' };
  }

  // Record the transaction
  const transactionType = options.isRegrade ? 'regrade' : 'grade';
  const description = options.isRegrade
    ? 'Re-grade card'
    : options.description || 'Grade card';

  await supabase.from('credit_transactions').insert({
    user_id: userId,
    type: transactionType,
    amount: -1,
    balance_after: newBalance,
    description,
    card_id: options.cardId,
  });

  return { success: true, newBalance };
}

/**
 * Get user's transaction history
 */
export async function getTransactionHistory(
  userId: string,
  limit: number = 50
): Promise<CreditTransaction[]> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('credit_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching transaction history:', error);
    return [];
  }

  return data || [];
}

/**
 * Update user's Stripe customer ID
 */
export async function updateStripeCustomerId(
  userId: string,
  stripeCustomerId: string
): Promise<boolean> {
  const supabase = getServiceClient();

  const { error } = await supabase
    .from('user_credits')
    .update({ stripe_customer_id: stripeCustomerId })
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating Stripe customer ID:', error);
    return false;
  }

  return true;
}

/**
 * Check if user has already made a purchase (for first purchase bonus logic)
 */
export async function isFirstPurchase(userId: string): Promise<boolean> {
  const credits = await getUserCredits(userId);
  return credits !== null && !credits.first_purchase_bonus_claimed;
}

/**
 * Check if user is a founder
 */
export async function isFounder(userId: string): Promise<boolean> {
  const credits = await getUserCredits(userId);
  return credits !== null && credits.is_founder;
}

/**
 * Set user as founder (called after Founders Package purchase)
 */
export async function setFounderStatus(
  userId: string,
  options: {
    stripeSessionId?: string;
    stripePaymentIntentId?: string;
  } = {}
): Promise<{ success: boolean; error?: string }> {
  const supabase = getServiceClient();

  // Get current credits
  const credits = await getUserCredits(userId);
  if (!credits) {
    return { success: false, error: 'User credits not found' };
  }

  // Check if already a founder
  if (credits.is_founder) {
    return { success: false, error: 'User is already a founder' };
  }

  const founderCredits = 150;
  const newBalance = credits.balance + founderCredits;

  // Update user as founder and add credits
  const { error: updateError } = await supabase
    .from('user_credits')
    .update({
      is_founder: true,
      founder_purchased_at: new Date().toISOString(),
      show_founder_badge: true,
      balance: newBalance,
      total_purchased: credits.total_purchased + founderCredits,
    })
    .eq('user_id', userId);

  if (updateError) {
    console.error('Error setting founder status:', updateError);
    return { success: false, error: 'Database error' };
  }

  // Record the transaction
  await supabase.from('credit_transactions').insert({
    user_id: userId,
    type: 'purchase',
    amount: founderCredits,
    balance_after: newBalance,
    description: 'Founders Package - 150 credits',
    stripe_session_id: options.stripeSessionId,
    stripe_payment_intent_id: options.stripePaymentIntentId,
    metadata: { package: 'founders' },
  });

  return { success: true };
}

/**
 * Toggle founder badge visibility on labels
 */
export async function toggleFounderBadge(
  userId: string,
  showBadge: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = getServiceClient();

  const { error } = await supabase
    .from('user_credits')
    .update({ show_founder_badge: showBadge })
    .eq('user_id', userId);

  if (error) {
    console.error('Error toggling founder badge:', error);
    return { success: false, error: 'Database error' };
  }

  return { success: true };
}

/**
 * Get founder discount multiplier (20% off = 0.8)
 */
export function getFounderDiscountMultiplier(): number {
  return 0.8; // 20% off
}
