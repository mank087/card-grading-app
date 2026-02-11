/**
 * Affiliate Program Business Logic
 * Core functions for managing affiliates, commissions, and attribution
 */

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import crypto from 'crypto';

// Types
export interface Affiliate {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  code: string;
  stripe_promotion_code_id: string | null;
  stripe_coupon_id: string | null;
  commission_rate: number;
  commission_type: 'percentage' | 'flat';
  flat_commission_amount: number | null;
  status: 'active' | 'paused' | 'deactivated';
  payout_method: string;
  payout_details: string | null;
  minimum_payout: number;
  attribution_window_days: number;
  total_referrals: number;
  total_commission_earned: number;
  total_commission_paid: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AffiliateCommission {
  id: string;
  affiliate_id: string;
  referred_user_id: string | null;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  order_amount: number;
  net_amount: number;
  commission_rate: number;
  commission_amount: number;
  status: 'pending' | 'approved' | 'paid' | 'reversed';
  hold_until: string | null;
  approved_at: string | null;
  paid_at: string | null;
  payout_reference: string | null;
  reversal_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AffiliateClick {
  id: string;
  affiliate_id: string;
  ip_hash: string | null;
  user_agent: string | null;
  landing_page: string | null;
  created_at: string;
}

// ============================================================================
// Lookup Functions
// ============================================================================

/**
 * Look up an affiliate by their unique referral code
 */
export async function getAffiliateByCode(code: string): Promise<Affiliate | null> {
  const { data, error } = await supabaseAdmin
    .from('affiliates')
    .select('*')
    .eq('code', code.toUpperCase())
    .single();

  if (error || !data) return null;
  return data as Affiliate;
}

/**
 * Look up an affiliate by their ID
 */
export async function getAffiliateById(id: string): Promise<Affiliate | null> {
  const { data, error } = await supabaseAdmin
    .from('affiliates')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return data as Affiliate;
}

/**
 * Look up an affiliate by their Stripe promotion code ID
 */
export async function getAffiliateByPromotionCode(stripePromotionCodeId: string): Promise<Affiliate | null> {
  const { data, error } = await supabaseAdmin
    .from('affiliates')
    .select('*')
    .eq('stripe_promotion_code_id', stripePromotionCodeId)
    .single();

  if (error || !data) return null;
  return data as Affiliate;
}

/**
 * List all affiliates with optional status filter
 */
export async function listAffiliates(status?: string): Promise<Affiliate[]> {
  let query = supabaseAdmin
    .from('affiliates')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error listing affiliates:', error);
    return [];
  }

  return (data || []) as Affiliate[];
}

// ============================================================================
// Click Tracking
// ============================================================================

/**
 * Hash an IP address for privacy-safe storage
 */
export function hashIP(ip: string): string {
  return crypto.createHash('sha256').update(ip + (process.env.IP_HASH_SALT || 'dcm-affiliate')).digest('hex').substring(0, 16);
}

/**
 * Record a click event for an affiliate's referral link
 */
export async function recordClick(
  affiliateId: string,
  ipHash: string | null,
  userAgent: string | null,
  landingPage: string | null
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from('affiliate_clicks')
    .insert({
      affiliate_id: affiliateId,
      ip_hash: ipHash,
      user_agent: userAgent?.substring(0, 500) || null,
      landing_page: landingPage?.substring(0, 2000) || null,
    });

  if (error) {
    console.error('Error recording click:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ============================================================================
// Commission Management
// ============================================================================

interface CreateCommissionOptions {
  referredUserId: string;
  stripeSessionId: string;
  stripePaymentIntentId?: string;
  orderAmount: number;
  netAmount: number;
  metadata?: Record<string, unknown>;
}

/**
 * Create a pending commission for an affiliate sale.
 * Includes fraud prevention: self-referral blocking and duplicate attribution check.
 */
export async function createCommission(
  affiliateId: string,
  options: CreateCommissionOptions
): Promise<{ success: boolean; commission?: AffiliateCommission; skipped?: string; error?: string }> {
  const { referredUserId, stripeSessionId, stripePaymentIntentId, orderAmount, netAmount, metadata } = options;

  // Look up the affiliate
  const affiliate = await getAffiliateById(affiliateId);
  if (!affiliate || affiliate.status !== 'active') {
    return { success: false, error: 'Affiliate not found or inactive' };
  }

  // FRAUD CHECK 1: Self-referral blocking
  if (affiliate.user_id && affiliate.user_id === referredUserId) {
    console.log(`[Affiliate] Self-referral blocked: affiliate ${affiliate.code}, user ${referredUserId}`);
    return { success: true, skipped: 'self_referral' };
  }

  // FRAUD CHECK 2: Duplicate attribution (first purchase only per referred user per affiliate)
  const { data: existingCommission } = await supabaseAdmin
    .from('affiliate_commissions')
    .select('id')
    .eq('affiliate_id', affiliateId)
    .eq('referred_user_id', referredUserId)
    .neq('status', 'reversed')
    .limit(1);

  if (existingCommission && existingCommission.length > 0) {
    console.log(`[Affiliate] Duplicate attribution blocked: affiliate ${affiliate.code}, user ${referredUserId}`);
    return { success: true, skipped: 'duplicate_attribution' };
  }

  // Calculate commission
  let commissionAmount: number;
  if (affiliate.commission_type === 'flat' && affiliate.flat_commission_amount) {
    commissionAmount = affiliate.flat_commission_amount;
  } else {
    commissionAmount = netAmount * affiliate.commission_rate;
  }

  // Round to 2 decimal places
  commissionAmount = Math.round(commissionAmount * 100) / 100;

  // Set hold period (14 days from now)
  const holdUntil = new Date();
  holdUntil.setDate(holdUntil.getDate() + 14);

  // Create commission record
  const { data: commission, error } = await supabaseAdmin
    .from('affiliate_commissions')
    .insert({
      affiliate_id: affiliateId,
      referred_user_id: referredUserId,
      stripe_session_id: stripeSessionId,
      stripe_payment_intent_id: stripePaymentIntentId || null,
      order_amount: orderAmount,
      net_amount: netAmount,
      commission_rate: affiliate.commission_rate,
      commission_amount: commissionAmount,
      status: 'pending',
      hold_until: holdUntil.toISOString(),
      metadata: metadata || {},
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating commission:', error);
    return { success: false, error: error.message };
  }

  // Update affiliate totals
  await supabaseAdmin
    .from('affiliates')
    .update({
      total_referrals: affiliate.total_referrals + 1,
      total_commission_earned: affiliate.total_commission_earned + commissionAmount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', affiliateId);

  console.log(`[Affiliate] Commission created: $${commissionAmount} for affiliate ${affiliate.code}, session ${stripeSessionId}`);

  return { success: true, commission: commission as AffiliateCommission };
}

/**
 * Batch approve all commissions that have passed their hold period
 */
export async function approveCommissions(): Promise<{ success: boolean; approvedCount: number; error?: string }> {
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('affiliate_commissions')
    .update({
      status: 'approved',
      approved_at: now,
      updated_at: now,
    })
    .eq('status', 'pending')
    .lte('hold_until', now)
    .select('id');

  if (error) {
    console.error('Error approving commissions:', error);
    return { success: false, approvedCount: 0, error: error.message };
  }

  const approvedCount = data?.length || 0;
  console.log(`[Affiliate] Approved ${approvedCount} commissions`);

  return { success: true, approvedCount };
}

/**
 * Reverse a commission (e.g., on refund/chargeback)
 */
export async function reverseCommission(
  stripeSessionId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  // Find the commission by Stripe session ID
  const { data: commission, error: findError } = await supabaseAdmin
    .from('affiliate_commissions')
    .select('*')
    .eq('stripe_session_id', stripeSessionId)
    .neq('status', 'reversed')
    .single();

  if (findError || !commission) {
    // No commission found for this session — not an error (not all purchases are affiliated)
    return { success: true };
  }

  const now = new Date().toISOString();

  // Update commission status to reversed
  const { error: updateError } = await supabaseAdmin
    .from('affiliate_commissions')
    .update({
      status: 'reversed',
      reversal_reason: reason,
      updated_at: now,
    })
    .eq('id', commission.id);

  if (updateError) {
    console.error('Error reversing commission:', updateError);
    return { success: false, error: updateError.message };
  }

  // Fetch current affiliate to calculate new totals and deduct
  const affiliate = await getAffiliateById(commission.affiliate_id);
  if (affiliate) {
    await supabaseAdmin
      .from('affiliates')
      .update({
        total_referrals: Math.max(0, affiliate.total_referrals - 1),
        total_commission_earned: Math.max(0, affiliate.total_commission_earned - commission.commission_amount),
        updated_at: now,
      })
      .eq('id', commission.affiliate_id);
  }

  console.log(`[Affiliate] Commission reversed: ${commission.id}, reason: ${reason}`);

  return { success: true };
}

// ============================================================================
// Stats & Reporting
// ============================================================================

export interface AffiliateStats {
  affiliate: Affiliate;
  totalClicks: number;
  totalCommissions: number;
  pendingCommissions: number;
  approvedCommissions: number;
  paidCommissions: number;
  reversedCommissions: number;
  pendingAmount: number;
  approvedAmount: number;
  paidAmount: number;
  conversionRate: number;
}

/**
 * Get comprehensive stats for an affiliate
 */
export async function getAffiliateStats(affiliateId: string): Promise<AffiliateStats | null> {
  const affiliate = await getAffiliateById(affiliateId);
  if (!affiliate) return null;

  // Get click count
  const { count: totalClicks } = await supabaseAdmin
    .from('affiliate_clicks')
    .select('*', { count: 'exact', head: true })
    .eq('affiliate_id', affiliateId);

  // Get commissions grouped by status
  const { data: commissions } = await supabaseAdmin
    .from('affiliate_commissions')
    .select('status, commission_amount')
    .eq('affiliate_id', affiliateId);

  const statusCounts = { pending: 0, approved: 0, paid: 0, reversed: 0 };
  const statusAmounts = { pending: 0, approved: 0, paid: 0 };

  for (const c of commissions || []) {
    statusCounts[c.status as keyof typeof statusCounts] = (statusCounts[c.status as keyof typeof statusCounts] || 0) + 1;
    if (c.status !== 'reversed') {
      statusAmounts[c.status as keyof typeof statusAmounts] = (statusAmounts[c.status as keyof typeof statusAmounts] || 0) + c.commission_amount;
    }
  }

  const totalCommissions = (commissions || []).filter(c => c.status !== 'reversed').length;
  const clicks = totalClicks || 0;

  return {
    affiliate,
    totalClicks: clicks,
    totalCommissions,
    pendingCommissions: statusCounts.pending,
    approvedCommissions: statusCounts.approved,
    paidCommissions: statusCounts.paid,
    reversedCommissions: statusCounts.reversed,
    pendingAmount: Math.round(statusAmounts.pending * 100) / 100,
    approvedAmount: Math.round(statusAmounts.approved * 100) / 100,
    paidAmount: Math.round(statusAmounts.paid * 100) / 100,
    conversionRate: clicks > 0 ? Math.round((totalCommissions / clicks) * 10000) / 100 : 0,
  };
}

/**
 * Get commissions that are approved and ready for payout
 */
export async function getPayableCommissions(affiliateId?: string): Promise<AffiliateCommission[]> {
  let query = supabaseAdmin
    .from('affiliate_commissions')
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: true });

  if (affiliateId) {
    query = query.eq('affiliate_id', affiliateId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching payable commissions:', error);
    return [];
  }

  return (data || []) as AffiliateCommission[];
}

/**
 * Mark commissions as paid with a payout reference
 */
export async function markCommissionsPaid(
  commissionIds: string[],
  payoutReference: string
): Promise<{ success: boolean; paidCount: number; error?: string }> {
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('affiliate_commissions')
    .update({
      status: 'paid',
      paid_at: now,
      payout_reference: payoutReference,
      updated_at: now,
    })
    .in('id', commissionIds)
    .eq('status', 'approved')
    .select('id, affiliate_id, commission_amount');

  if (error) {
    console.error('Error marking commissions paid:', error);
    return { success: false, paidCount: 0, error: error.message };
  }

  // Update affiliate total_commission_paid for each affected affiliate
  const affiliatePayments = new Map<string, number>();
  for (const c of data || []) {
    const current = affiliatePayments.get(c.affiliate_id) || 0;
    affiliatePayments.set(c.affiliate_id, current + c.commission_amount);
  }

  for (const [affId, amount] of affiliatePayments) {
    const affiliate = await getAffiliateById(affId);
    if (affiliate) {
      await supabaseAdmin
        .from('affiliates')
        .update({
          total_commission_paid: affiliate.total_commission_paid + amount,
          updated_at: now,
        })
        .eq('id', affId);
    }
  }

  const paidCount = data?.length || 0;
  console.log(`[Affiliate] Marked ${paidCount} commissions as paid, ref: ${payoutReference}`);

  return { success: true, paidCount };
}

/**
 * Get commission history for an affiliate (with pagination)
 */
export async function getCommissionHistory(
  affiliateId: string,
  options: { limit?: number; offset?: number; status?: string } = {}
): Promise<{ commissions: AffiliateCommission[]; total: number }> {
  const { limit = 50, offset = 0, status } = options;

  let query = supabaseAdmin
    .from('affiliate_commissions')
    .select('*', { count: 'exact' })
    .eq('affiliate_id', affiliateId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error('Error fetching commission history:', error);
    return { commissions: [], total: 0 };
  }

  return {
    commissions: (data || []) as AffiliateCommission[],
    total: count || 0,
  };
}

/**
 * List commissions with filters (for admin view)
 */
export async function listCommissions(options: {
  affiliateId?: string;
  status?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ commissions: AffiliateCommission[]; total: number }> {
  const { affiliateId, status, limit = 50, offset = 0 } = options;

  let query = supabaseAdmin
    .from('affiliate_commissions')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (affiliateId) {
    query = query.eq('affiliate_id', affiliateId);
  }
  if (status) {
    query = query.eq('status', status);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error('Error listing commissions:', error);
    return { commissions: [], total: 0 };
  }

  return {
    commissions: (data || []) as AffiliateCommission[],
    total: count || 0,
  };
}
