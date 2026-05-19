/**
 * GET /api/admin/analytics/revenue
 *
 * Unified revenue across web (Stripe) and mobile (Apple + Google IAP).
 *
 * Combines three source tables into a single view:
 *   1. credit_transactions where type='purchase' AND stripe_payment_intent_id IS NOT NULL
 *      → Stripe one-time credit packs (Basic/Pro/Elite/VIP). Dollar value
 *        is derived from description → tier mapping (no amount_usd column
 *        on credit_transactions today; can be hardened later by writing
 *        Stripe's payment_intent.amount into the row at webhook time).
 *
 *   2. subscription_events where event_type IN ('subscribed','renewed')
 *      → Stripe Card Lovers monthly ($49.99) / annual ($449). Price from
 *        plan column.
 *
 *   3. iap_transactions where status='active'
 *      → Apple + Google credit pack purchases. Price from raw_receipt.price
 *        (cents) when present, otherwise fall back to product-id → tier map.
 *
 * Query params:
 *   ?from=YYYY-MM-DD (default: 30 days ago)
 *   ?to=YYYY-MM-DD   (default: today)
 *
 * Response: headline metrics, daily trend, breakdown by source/product,
 * recent transactions, top spenders.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// ---------- Pricing constants ----------
// One-time Stripe credit packs (one source of truth — also referenced in
// src/lib/stripe.ts). Keep in sync with Stripe Dashboard product prices.
const STRIPE_CREDIT_PACK_PRICES: Record<string, number> = {
  basic: 2.99,
  pro: 9.99,
  elite: 19.99,
  vip: 99.0,
  founders: 99.0, // legacy package
}

// Stripe Card Lovers subscription
const CARD_LOVERS_PRICES: Record<string, number> = {
  monthly: 49.99,
  annual: 449.0,
}

// IAP credit pack fallback prices (in case raw_receipt.price is missing)
const IAP_PRICE_FALLBACK_USD: Record<string, number> = {
  'dcm.credits.basic': 2.99,
  'dcm.credits.pro': 9.99,
  'dcm.credits.elite': 19.99,
  'dcm.credits.vip': 99.0,
}

// ---------- Types ----------
type Source = 'stripe_credits' | 'stripe_subscription' | 'apple_iap' | 'google_iap'

interface UnifiedRow {
  id: string
  source: Source
  platform: 'web' | 'ios' | 'android'
  user_id: string
  product: string
  amount_usd: number
  created_at: string
}

// ---------- Helpers ----------
function descriptionToTier(desc: string | null): keyof typeof STRIPE_CREDIT_PACK_PRICES | null {
  if (!desc) return null
  const lc = desc.toLowerCase()
  if (lc.includes('basic')) return 'basic'
  if (lc.includes('elite')) return 'elite' // check before 'pro' (no overlap, but be explicit)
  if (lc.includes('pro')) return 'pro'
  if (lc.includes('vip')) return 'vip'
  if (lc.includes('founder')) return 'founders'
  return null
}

function parseRange(searchParams: URLSearchParams): { from: Date; to: Date } {
  const now = new Date()
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 3600 * 1000)
  const from = searchParams.get('from')
    ? new Date(searchParams.get('from')!)
    : defaultFrom
  const to = searchParams.get('to')
    ? new Date(searchParams.get('to')!)
    : now
  // Always include the full to-day
  to.setUTCHours(23, 59, 59, 999)
  return { from, to }
}

function bucketDayUTC(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toISOString().slice(0, 10)
}

// ---------- Source loaders ----------
async function loadStripeCreditPacks(from: Date, to: Date): Promise<UnifiedRow[]> {
  const { data } = await supabaseAdmin
    .from('credit_transactions')
    .select('id, user_id, description, created_at, amount, metadata, stripe_payment_intent_id')
    .eq('type', 'purchase')
    .not('stripe_payment_intent_id', 'is', null)
    .gte('created_at', from.toISOString())
    .lte('created_at', to.toISOString())
    .order('created_at', { ascending: false })
    .limit(10000)

  if (!data) return []
  return data.map((r) => {
    const tier = descriptionToTier(r.description as string | null)
    const amount_usd = tier ? STRIPE_CREDIT_PACK_PRICES[tier] : 0
    return {
      id: r.id as string,
      source: 'stripe_credits' as const,
      platform: 'web' as const,
      user_id: r.user_id as string,
      product: tier ? `Stripe ${tier.charAt(0).toUpperCase() + tier.slice(1)}` : 'Stripe credit pack',
      amount_usd,
      created_at: r.created_at as string,
    }
  })
}

async function loadStripeSubscriptions(from: Date, to: Date): Promise<UnifiedRow[]> {
  const { data } = await supabaseAdmin
    .from('subscription_events')
    .select('id, user_id, event_type, plan, created_at, stripe_subscription_id')
    .in('event_type', ['subscribed', 'renewed'])
    .gte('created_at', from.toISOString())
    .lte('created_at', to.toISOString())
    .order('created_at', { ascending: false })
    .limit(10000)

  if (!data) return []
  return data
    .filter((r) => !!r.stripe_subscription_id) // exclude purely-backfilled rows with no Stripe link
    .map((r) => {
      const plan = (r.plan as string)?.toLowerCase() || ''
      const amount_usd = CARD_LOVERS_PRICES[plan] ?? 0
      return {
        id: r.id as string,
        source: 'stripe_subscription' as const,
        platform: 'web' as const,
        user_id: r.user_id as string,
        product: plan === 'annual' ? 'Card Lovers Annual' : 'Card Lovers Monthly',
        amount_usd,
        created_at: r.created_at as string,
      }
    })
}

async function loadIAPTransactions(from: Date, to: Date): Promise<UnifiedRow[]> {
  // Filter to production environment ONLY — sandbox rows from TestFlight
  // testers and Apple reviewers (e.g. ar_user* accounts) don't represent
  // real money and would otherwise inflate the revenue dashboard.
  const { data } = await supabaseAdmin
    .from('iap_transactions')
    .select('id, user_id, platform, product_id, product_type, raw_receipt, created_at, status, environment')
    .eq('status', 'active')
    .eq('environment', 'production')
    .gte('created_at', from.toISOString())
    .lte('created_at', to.toISOString())
    .order('created_at', { ascending: false })
    .limit(10000)

  if (!data) return []
  return data.map((r) => {
    const productId = r.product_id as string
    // Try to read price from raw_receipt (Apple stores cents in raw_receipt.price)
    let amount_usd = 0
    const raw = r.raw_receipt as any
    if (raw && typeof raw.price === 'number') {
      amount_usd = raw.price / 100
    } else if (IAP_PRICE_FALLBACK_USD[productId] !== undefined) {
      amount_usd = IAP_PRICE_FALLBACK_USD[productId]
    }
    const isApple = r.platform === 'apple'
    return {
      id: r.id as string,
      source: (isApple ? 'apple_iap' : 'google_iap') as Source,
      platform: (isApple ? 'ios' : 'android') as 'ios' | 'android',
      user_id: r.user_id as string,
      product: productId,
      amount_usd,
      created_at: r.created_at as string,
    }
  })
}

// ---------- Handler ----------
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const admin = await verifyAdminSession(token)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { from, to } = parseRange(request.nextUrl.searchParams)

    const [stripeCredits, stripeSubs, iap] = await Promise.all([
      loadStripeCreditPacks(from, to),
      loadStripeSubscriptions(from, to),
      loadIAPTransactions(from, to),
    ])

    const rows: UnifiedRow[] = [...stripeCredits, ...stripeSubs, ...iap]
    rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))

    // ----- Headline totals -----
    const totalRevenue = rows.reduce((sum, r) => sum + r.amount_usd, 0)
    const totalTransactions = rows.length

    const nowMs = Date.now()
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)
    const sevenDaysAgo = new Date(nowMs - 7 * 24 * 3600 * 1000)
    const thirtyDaysAgo = new Date(nowMs - 30 * 24 * 3600 * 1000)

    const sumSince = (since: Date) =>
      rows.filter((r) => new Date(r.created_at) >= since).reduce((s, r) => s + r.amount_usd, 0)

    const headline = {
      total_revenue: Math.round(totalRevenue * 100) / 100,
      total_transactions: totalTransactions,
      today: Math.round(sumSince(todayStart) * 100) / 100,
      last_7_days: Math.round(sumSince(sevenDaysAgo) * 100) / 100,
      last_30_days: Math.round(sumSince(thirtyDaysAgo) * 100) / 100,
    }

    // ----- Breakdown by source -----
    const bySource: Record<Source, { revenue: number; count: number }> = {
      stripe_credits: { revenue: 0, count: 0 },
      stripe_subscription: { revenue: 0, count: 0 },
      apple_iap: { revenue: 0, count: 0 },
      google_iap: { revenue: 0, count: 0 },
    }
    rows.forEach((r) => {
      bySource[r.source].revenue += r.amount_usd
      bySource[r.source].count += 1
    })
    const sourceBreakdown = Object.entries(bySource).map(([source, v]) => ({
      source,
      revenue: Math.round(v.revenue * 100) / 100,
      count: v.count,
    }))

    // ----- Breakdown by platform (web / ios / android) -----
    const byPlatform: Record<string, { revenue: number; count: number }> = {
      web: { revenue: 0, count: 0 },
      ios: { revenue: 0, count: 0 },
      android: { revenue: 0, count: 0 },
    }
    rows.forEach((r) => {
      byPlatform[r.platform].revenue += r.amount_usd
      byPlatform[r.platform].count += 1
    })
    const platformBreakdown = Object.entries(byPlatform).map(([platform, v]) => ({
      platform,
      revenue: Math.round(v.revenue * 100) / 100,
      count: v.count,
    }))

    // ----- Breakdown by product (within range) -----
    const productAgg: Record<string, { revenue: number; count: number }> = {}
    rows.forEach((r) => {
      if (!productAgg[r.product]) productAgg[r.product] = { revenue: 0, count: 0 }
      productAgg[r.product].revenue += r.amount_usd
      productAgg[r.product].count += 1
    })
    const productBreakdown = Object.entries(productAgg)
      .map(([product, v]) => ({
        product,
        revenue: Math.round(v.revenue * 100) / 100,
        count: v.count,
      }))
      .sort((a, b) => b.revenue - a.revenue)

    // ----- Daily trend (stacked-by-source) -----
    const dailyMap = new Map<string, Record<Source, number> & { date: string; total: number }>()
    for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
      const key = bucketDayUTC(d)
      dailyMap.set(key, {
        date: key,
        stripe_credits: 0,
        stripe_subscription: 0,
        apple_iap: 0,
        google_iap: 0,
        total: 0,
      })
    }
    rows.forEach((r) => {
      const key = bucketDayUTC(r.created_at)
      const bucket = dailyMap.get(key)
      if (bucket) {
        bucket[r.source] += r.amount_usd
        bucket.total += r.amount_usd
      }
    })
    const dailyTrend = Array.from(dailyMap.values())
      .map((b) => ({
        date: b.date,
        stripe_credits: Math.round(b.stripe_credits * 100) / 100,
        stripe_subscription: Math.round(b.stripe_subscription * 100) / 100,
        apple_iap: Math.round(b.apple_iap * 100) / 100,
        google_iap: Math.round(b.google_iap * 100) / 100,
        total: Math.round(b.total * 100) / 100,
      }))
      .sort((a, b) => (a.date < b.date ? -1 : 1))

    // ----- Top 10 spenders (in range) — needs email lookup -----
    const spendByUser: Record<string, { revenue: number; transactions: number }> = {}
    rows.forEach((r) => {
      if (!spendByUser[r.user_id]) spendByUser[r.user_id] = { revenue: 0, transactions: 0 }
      spendByUser[r.user_id].revenue += r.amount_usd
      spendByUser[r.user_id].transactions += 1
    })
    const topUserIds = Object.entries(spendByUser)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 10)
      .map(([id]) => id)
    const { data: topUsers } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .in('id', topUserIds.length ? topUserIds : ['00000000-0000-0000-0000-000000000000'])
    const emailById: Record<string, string> = {}
    topUsers?.forEach((u: any) => { emailById[u.id] = u.email })
    const topSpenders = topUserIds.map((id) => ({
      user_id: id,
      email: emailById[id] || id.slice(0, 8) + '…',
      revenue: Math.round(spendByUser[id].revenue * 100) / 100,
      transactions: spendByUser[id].transactions,
    }))

    // ----- Recent transactions (latest 25) — enrich with email -----
    const recent = rows.slice(0, 25)
    const recentUserIds = Array.from(new Set(recent.map((r) => r.user_id)))
    const { data: recentUsers } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .in('id', recentUserIds.length ? recentUserIds : ['00000000-0000-0000-0000-000000000000'])
    const recentEmailById: Record<string, string> = {}
    recentUsers?.forEach((u: any) => { recentEmailById[u.id] = u.email })
    const recentTransactions = recent.map((r) => ({
      ...r,
      amount_usd: Math.round(r.amount_usd * 100) / 100,
      email: recentEmailById[r.user_id] || r.user_id.slice(0, 8) + '…',
    }))

    return NextResponse.json({
      range: { from: from.toISOString(), to: to.toISOString() },
      headline,
      source_breakdown: sourceBreakdown,
      platform_breakdown: platformBreakdown,
      product_breakdown: productBreakdown,
      daily_trend: dailyTrend,
      top_spenders: topSpenders,
      recent_transactions: recentTransactions,
      note:
        "Stripe credit-pack dollar values are derived from description text → tier mapping (no amount_usd column on credit_transactions yet). IAP dollar values come from raw_receipt.price (cents) with a product-id fallback table. Both can be hardened by capturing the verified price at webhook/verify time.",
    })
  } catch (error: any) {
    console.error('[admin/analytics/revenue] error:', error)
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 })
  }
}
