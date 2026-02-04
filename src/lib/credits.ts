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
  // Card Lovers subscription fields
  is_card_lover: boolean;
  card_lover_subscribed_at: string | null;
  card_lover_current_period_end: string | null;
  card_lover_subscription_id: string | null;
  card_lover_plan: 'monthly' | 'annual' | null;
  card_lover_months_active: number;
  show_card_lover_badge: boolean;
  preferred_label_emblem: 'founder' | 'card_lover' | 'none' | 'auto';
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
      const { error: transactionError } = await supabase.from('credit_transactions').insert({
        user_id: userId,
        type: 'bonus',
        amount: 1,
        balance_after: 1,
        description: 'Welcome bonus - 1 free credit for signing up',
        metadata: { bonus_type: 'signup' },
      });

      if (transactionError) {
        console.error('Failed to record signup bonus transaction:', transactionError);
      }
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
  const { error: transactionError } = await supabase.from('credit_transactions').insert({
    user_id: userId,
    type: 'purchase',
    amount: amount,
    balance_after: newBalance - (bonusAdded ? bonusAmount : 0), // Balance after purchase, before bonus
    description: options.description || `Purchased ${amount} credit(s)`,
    stripe_session_id: options.stripeSessionId,
    stripe_payment_intent_id: options.stripePaymentIntentId,
  });

  if (transactionError) {
    console.error('Failed to record purchase transaction:', transactionError);
    // Don't fail the operation - credits were added, just audit log is incomplete
  }

  // Record bonus transaction separately if applicable
  if (bonusAdded) {
    const { error: bonusError } = await supabase.from('credit_transactions').insert({
      user_id: userId,
      type: 'bonus',
      amount: bonusAmount,
      balance_after: newBalance,
      description: `DCM Launch Special - ${bonusAmount} bonus credit${bonusAmount !== 1 ? 's' : ''}`,
      stripe_session_id: options.stripeSessionId,
    });

    if (bonusError) {
      console.error('Failed to record bonus transaction:', bonusError);
    }
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

  const { error: transactionError } = await supabase.from('credit_transactions').insert({
    user_id: userId,
    type: transactionType,
    amount: -1,
    balance_after: newBalance,
    description,
    card_id: options.cardId,
  });

  if (transactionError) {
    console.error('Failed to record grade transaction:', transactionError);
    // Don't fail - credit was deducted, just audit log is incomplete
  }

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
 * Set user as founder and add credits (called after Founders Package purchase)
 * Can be purchased multiple times - adds 150 credits each time
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

  const founderCredits = 150;
  const newBalance = credits.balance + founderCredits;
  const isFirstFounderPurchase = !credits.is_founder;

  // Update user as founder and add credits
  const updateData: Record<string, unknown> = {
    balance: newBalance,
    total_purchased: credits.total_purchased + founderCredits,
  };

  // Only set founder status fields on first purchase
  if (isFirstFounderPurchase) {
    updateData.is_founder = true;
    updateData.founder_purchased_at = new Date().toISOString();
    updateData.show_founder_badge = true;
  }

  const { error: updateError } = await supabase
    .from('user_credits')
    .update(updateData)
    .eq('user_id', userId);

  if (updateError) {
    console.error('Error setting founder status:', updateError);
    return { success: false, error: 'Database error' };
  }

  // Record the transaction
  const description = isFirstFounderPurchase
    ? 'Founders Package - 150 credits'
    : 'Founders Package (additional) - 150 credits';

  const { error: transactionError } = await supabase.from('credit_transactions').insert({
    user_id: userId,
    type: 'purchase',
    amount: founderCredits,
    balance_after: newBalance,
    description,
    stripe_session_id: options.stripeSessionId,
    stripe_payment_intent_id: options.stripePaymentIntentId,
    metadata: { package: 'founders', isRepeatPurchase: !isFirstFounderPurchase },
  });

  if (transactionError) {
    console.error('Failed to record founder transaction:', transactionError);
    // Don't fail - credits were added, just audit log is incomplete
  }

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

// ============================================
// CARD LOVERS SUBSCRIPTION FUNCTIONS
// ============================================

/**
 * Check if user has an active Card Lovers subscription
 */
export async function isActiveCardLover(userId: string): Promise<boolean> {
  const credits = await getUserCredits(userId);
  if (!credits || !credits.is_card_lover) return false;

  // Check if subscription is still active (period end is in the future)
  if (!credits.card_lover_current_period_end) return false;
  return new Date(credits.card_lover_current_period_end) > new Date();
}

/**
 * Get Card Lovers subscription status
 */
export async function getCardLoverStatus(userId: string): Promise<{
  isActive: boolean;
  plan: 'monthly' | 'annual' | null;
  monthsActive: number;
  currentPeriodEnd: Date | null;
  subscriptionId: string | null;
}> {
  const credits = await getUserCredits(userId);

  if (!credits) {
    return {
      isActive: false,
      plan: null,
      monthsActive: 0,
      currentPeriodEnd: null,
      subscriptionId: null,
    };
  }

  const isActive = credits.is_card_lover &&
    credits.card_lover_current_period_end &&
    new Date(credits.card_lover_current_period_end) > new Date();

  return {
    isActive,
    plan: credits.card_lover_plan,
    monthsActive: credits.card_lover_months_active,
    currentPeriodEnd: credits.card_lover_current_period_end
      ? new Date(credits.card_lover_current_period_end)
      : null,
    subscriptionId: credits.card_lover_subscription_id,
  };
}

/**
 * Activate Card Lovers subscription (called after initial subscription checkout)
 */
export async function activateCardLoverSubscription(
  userId: string,
  options: {
    plan: 'monthly' | 'annual';
    subscriptionId: string;
    currentPeriodEnd: Date;
    stripeInvoiceId?: string;
  }
): Promise<{ success: boolean; creditsAdded: number; error?: string }> {
  const supabase = getServiceClient();

  const credits = await getUserCredits(userId);
  if (!credits) {
    return { success: false, creditsAdded: 0, error: 'User credits not found' };
  }

  // Calculate credits to add
  let creditsToAdd = 70; // Monthly base
  let bonusCredits = 0;

  if (options.plan === 'annual') {
    creditsToAdd = 840; // 70 x 12
    bonusCredits = 60; // Annual bonus
  }

  const totalCredits = creditsToAdd + bonusCredits;
  const newBalance = credits.balance + totalCredits;

  // Update user_credits
  const { error: updateError } = await supabase
    .from('user_credits')
    .update({
      is_card_lover: true,
      card_lover_subscribed_at: new Date().toISOString(),
      card_lover_current_period_end: options.currentPeriodEnd.toISOString(),
      card_lover_subscription_id: options.subscriptionId,
      card_lover_plan: options.plan,
      card_lover_months_active: options.plan === 'annual' ? 12 : 1,
      show_card_lover_badge: true,
      balance: newBalance,
      total_purchased: credits.total_purchased + totalCredits,
    })
    .eq('user_id', userId);

  if (updateError) {
    console.error('Error activating Card Lovers subscription:', updateError);
    return { success: false, creditsAdded: 0, error: 'Database error' };
  }

  // Record subscription event
  await supabase.from('subscription_events').insert({
    user_id: userId,
    event_type: 'subscribed',
    plan: options.plan,
    credits_added: creditsToAdd,
    bonus_credits: bonusCredits,
    stripe_subscription_id: options.subscriptionId,
    stripe_invoice_id: options.stripeInvoiceId,
    metadata: { initial_subscription: true },
  });

  // Record credit transaction
  await supabase.from('credit_transactions').insert({
    user_id: userId,
    type: 'purchase',
    amount: totalCredits,
    balance_after: newBalance,
    description: options.plan === 'annual'
      ? 'Card Lovers Annual - 900 credits (840 + 60 bonus)'
      : 'Card Lovers Monthly - 70 credits',
    metadata: {
      subscription: 'card_lovers',
      plan: options.plan,
      base_credits: creditsToAdd,
      bonus_credits: bonusCredits,
    },
  });

  return { success: true, creditsAdded: totalCredits };
}

/**
 * Process Card Lovers subscription renewal (called by webhook on invoice.paid)
 */
export async function processCardLoverRenewal(
  userId: string,
  options: {
    stripeInvoiceId: string;
    subscriptionId: string;
    currentPeriodEnd: Date;
  }
): Promise<{ success: boolean; creditsAdded: number; bonusCredits: number; error?: string }> {
  const supabase = getServiceClient();

  const credits = await getUserCredits(userId);
  if (!credits) {
    return { success: false, creditsAdded: 0, bonusCredits: 0, error: 'User credits not found' };
  }

  // Only process for monthly subscriptions - annual doesn't renew monthly
  if (credits.card_lover_plan !== 'monthly') {
    // For annual, just update the period end
    await supabase
      .from('user_credits')
      .update({
        card_lover_current_period_end: options.currentPeriodEnd.toISOString(),
        card_lover_months_active: 12, // Reset to 12 for annual renewal
      })
      .eq('user_id', userId);

    return { success: true, creditsAdded: 0, bonusCredits: 0 };
  }

  const creditsToAdd = 70;
  const newMonthsActive = credits.card_lover_months_active + 1;

  // Check for loyalty bonus
  const loyaltyBonuses: Record<number, number> = { 3: 5, 6: 10, 9: 15, 12: 20 };
  const bonusCredits = loyaltyBonuses[newMonthsActive] || 0;

  const totalCredits = creditsToAdd + bonusCredits;
  const newBalance = credits.balance + totalCredits;

  // Update user_credits
  const { error: updateError } = await supabase
    .from('user_credits')
    .update({
      card_lover_current_period_end: options.currentPeriodEnd.toISOString(),
      card_lover_months_active: newMonthsActive,
      balance: newBalance,
      total_purchased: credits.total_purchased + totalCredits,
    })
    .eq('user_id', userId);

  if (updateError) {
    console.error('Error processing Card Lovers renewal:', updateError);
    return { success: false, creditsAdded: 0, bonusCredits: 0, error: 'Database error' };
  }

  // Record subscription event
  await supabase.from('subscription_events').insert({
    user_id: userId,
    event_type: 'renewed',
    plan: 'monthly',
    credits_added: creditsToAdd,
    bonus_credits: bonusCredits,
    stripe_subscription_id: options.subscriptionId,
    stripe_invoice_id: options.stripeInvoiceId,
    metadata: { months_active: newMonthsActive },
  });

  // Record credit transaction
  await supabase.from('credit_transactions').insert({
    user_id: userId,
    type: 'purchase',
    amount: totalCredits,
    balance_after: newBalance,
    description: bonusCredits > 0
      ? `Card Lovers Monthly - 70 credits + ${bonusCredits} loyalty bonus (Month ${newMonthsActive})`
      : `Card Lovers Monthly - 70 credits (Month ${newMonthsActive})`,
    metadata: {
      subscription: 'card_lovers',
      plan: 'monthly',
      months_active: newMonthsActive,
      loyalty_bonus: bonusCredits,
    },
  });

  // Record loyalty bonus separately if applicable
  if (bonusCredits > 0) {
    await supabase.from('subscription_events').insert({
      user_id: userId,
      event_type: 'loyalty_bonus',
      plan: 'monthly',
      credits_added: 0,
      bonus_credits: bonusCredits,
      stripe_subscription_id: options.subscriptionId,
      metadata: { milestone_month: newMonthsActive },
    });
  }

  return { success: true, creditsAdded: creditsToAdd, bonusCredits };
}

/**
 * Cancel Card Lovers subscription (called by webhook on subscription.deleted)
 */
export async function cancelCardLoverSubscription(
  userId: string,
  options: {
    subscriptionId: string;
  } = { subscriptionId: '' }
): Promise<{ success: boolean; error?: string }> {
  const supabase = getServiceClient();

  const credits = await getUserCredits(userId);
  if (!credits) {
    return { success: false, error: 'User credits not found' };
  }

  // Update user_credits - set is_card_lover to false but keep credits
  const { error: updateError } = await supabase
    .from('user_credits')
    .update({
      is_card_lover: false,
      card_lover_months_active: 0, // Reset loyalty progress
      // Keep other fields for historical reference
    })
    .eq('user_id', userId);

  if (updateError) {
    console.error('Error cancelling Card Lovers subscription:', updateError);
    return { success: false, error: 'Database error' };
  }

  // Record subscription event
  await supabase.from('subscription_events').insert({
    user_id: userId,
    event_type: 'cancelled',
    plan: credits.card_lover_plan,
    credits_added: 0,
    bonus_credits: 0,
    stripe_subscription_id: options.subscriptionId,
    metadata: {
      months_active_at_cancel: credits.card_lover_months_active,
      credits_retained: credits.balance,
    },
  });

  return { success: true };
}

/**
 * Upgrade Card Lovers subscription from monthly to annual
 */
export async function upgradeCardLoverToAnnual(
  userId: string,
  options: {
    subscriptionId: string;
    currentPeriodEnd: Date;
    creditsAlreadyGivenThisCycle: number;
    stripeInvoiceId?: string;
  }
): Promise<{ success: boolean; creditsAdded: number; error?: string }> {
  const supabase = getServiceClient();

  const credits = await getUserCredits(userId);
  if (!credits) {
    return { success: false, creditsAdded: 0, error: 'User credits not found' };
  }

  // Calculate credits to add: annual total minus what they already received
  const annualTotal = 840 + 60; // 900 total
  const creditsToAdd = annualTotal - options.creditsAlreadyGivenThisCycle;
  const newBalance = credits.balance + creditsToAdd;

  // Update user_credits
  const { error: updateError } = await supabase
    .from('user_credits')
    .update({
      card_lover_plan: 'annual',
      card_lover_current_period_end: options.currentPeriodEnd.toISOString(),
      card_lover_subscription_id: options.subscriptionId,
      card_lover_months_active: 12, // Set to 12 for annual
      balance: newBalance,
      total_purchased: credits.total_purchased + creditsToAdd,
    })
    .eq('user_id', userId);

  if (updateError) {
    console.error('Error upgrading Card Lovers subscription:', updateError);
    return { success: false, creditsAdded: 0, error: 'Database error' };
  }

  // Record subscription event
  await supabase.from('subscription_events').insert({
    user_id: userId,
    event_type: 'upgraded',
    plan: 'annual',
    credits_added: creditsToAdd,
    bonus_credits: 60,
    stripe_subscription_id: options.subscriptionId,
    stripe_invoice_id: options.stripeInvoiceId,
    metadata: {
      upgraded_from: 'monthly',
      credits_already_received: options.creditsAlreadyGivenThisCycle,
    },
  });

  // Record credit transaction
  await supabase.from('credit_transactions').insert({
    user_id: userId,
    type: 'purchase',
    amount: creditsToAdd,
    balance_after: newBalance,
    description: `Card Lovers Upgrade to Annual - ${creditsToAdd} credits (prorated)`,
    metadata: {
      subscription: 'card_lovers',
      plan: 'annual',
      upgrade: true,
      prorated_credits: creditsToAdd,
    },
  });

  return { success: true, creditsAdded };
}

/**
 * Toggle Card Lovers badge visibility
 */
export async function toggleCardLoverBadge(
  userId: string,
  showBadge: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = getServiceClient();

  const { error } = await supabase
    .from('user_credits')
    .update({ show_card_lover_badge: showBadge })
    .eq('user_id', userId);

  if (error) {
    console.error('Error toggling Card Lover badge:', error);
    return { success: false, error: 'Database error' };
  }

  return { success: true };
}

/**
 * Update preferred label emblem
 */
export async function updateLabelEmblemPreference(
  userId: string,
  preference: 'founder' | 'card_lover' | 'none' | 'auto'
): Promise<{ success: boolean; error?: string }> {
  const supabase = getServiceClient();

  const { error } = await supabase
    .from('user_credits')
    .update({ preferred_label_emblem: preference })
    .eq('user_id', userId);

  if (error) {
    console.error('Error updating label emblem preference:', error);
    return { success: false, error: 'Database error' };
  }

  return { success: true };
}

/**
 * Get the emblem to display on labels based on user preferences
 */
export async function getLabelEmblem(userId: string): Promise<'founder' | 'card_lover' | null> {
  const credits = await getUserCredits(userId);
  if (!credits) return null;

  const preference = credits.preferred_label_emblem || 'auto';
  const isActiveSubscriber = credits.is_card_lover &&
    credits.card_lover_current_period_end &&
    new Date(credits.card_lover_current_period_end) > new Date();

  if (preference === 'none') return null;
  if (preference === 'founder' && credits.is_founder) return 'founder';
  if (preference === 'card_lover' && isActiveSubscriber) return 'card_lover';

  // Auto: prefer founder, then card_lover
  if (preference === 'auto') {
    if (credits.is_founder) return 'founder';
    if (isActiveSubscriber) return 'card_lover';
  }

  return null;
}

/**
 * Get Card Lovers discount amount (20% for active subscribers)
 */
export async function getCardLoverDiscount(userId: string): Promise<number> {
  const isActive = await isActiveCardLover(userId);
  return isActive ? 0.20 : 0;
}

