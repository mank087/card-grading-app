/**
 * GET /api/admin/costs/summary
 *
 * Unified monthly P&L for the /admin/costs dashboard. Pulls:
 *   • Revenue (from credit_transactions + subscription_events + iap_transactions
 *     — same source-combining logic as /api/admin/analytics/revenue but
 *     summarized into monthly totals here)
 *   • Variable costs:
 *       - OpenAI grading cost (actual from openai_daily_costs when present,
 *         token-estimate fallback when not)
 *       - Stripe processing fees (actual from stripe_daily_fees when present,
 *         formula 2.9% + $0.30 per charge fallback when not)
 *       - Apple IAP fee (30% of apple revenue; hardcoded constant, configurable)
 *       - Google IAP fee (30% of google revenue)
 *   • Fixed costs (monthly_costs rows active in the month)
 *   • Gross margin / Net margin / Burn
 *   • 12-month trend (revenue / variable / fixed / net per month)
 *
 * Query params:
 *   ?month=YYYY-MM   (default: current month)
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// ---------- Constants ----------

// Apple Small Business Program is 15%, standard rate is 30%. DCM is awaiting
// SBP approval as of 2026-05-19 — use 30% for now. Update this to 0.15 once
// approval lands.
const IAP_FEE_RATE = 0.30
const STRIPE_PERCENT = 0.029
const STRIPE_FIXED = 0.30

// Stripe credit pack prices (same source of truth as the revenue endpoint)
const STRIPE_CREDIT_PACK_PRICES: Record<string, number> = {
  basic: 2.99, pro: 9.99, elite: 19.99, vip: 99.0, founders: 99.0,
}
const CARD_LOVERS_PRICES: Record<string, number> = {
  monthly: 49.99, annual: 449.0,
}
const IAP_PRICE_FALLBACK_USD: Record<string, number> = {
  'dcm.credits.basic': 2.99, 'dcm.credits.pro': 9.99,
  'dcm.credits.elite': 19.99, 'dcm.credits.vip': 99.0,
}

// Token estimates for OpenAI fallback when no row exists in openai_daily_costs
// yet (very first runs before the nightly sync populates). Once an actual
// cost is recorded, the fallback path is bypassed. Token counts here are
// approximate based on observed GPT-5.1 traffic per category.
const ESTIMATED_TOKENS = {
  sports: { input: 8000, output: 8000, images: 2 },
  pokemon: { input: 7500, output: 7500, images: 2 },
  mtg: { input: 7000, output: 7000, images: 2 },
  lorcana: { input: 7200, output: 7200, images: 2 },
  onepiece: { input: 7200, output: 7200, images: 2 },
  other: { input: 6800, output: 6800, images: 2 },
}
const OPENAI_PRICING = { input_per_1k: 0.005, output_per_1k: 0.015, image: 0.002 }

// ---------- Helpers ----------

function descriptionToTier(desc: string | null): keyof typeof STRIPE_CREDIT_PACK_PRICES | null {
  if (!desc) return null
  const lc = desc.toLowerCase()
  if (lc.includes('basic')) return 'basic'
  if (lc.includes('elite')) return 'elite'
  if (lc.includes('pro')) return 'pro'
  if (lc.includes('vip')) return 'vip'
  if (lc.includes('founder')) return 'founders'
  return null
}

function estimateGradingCost(category: string): number {
  const sportsCats = ['football', 'baseball', 'basketball', 'hockey', 'soccer', 'wrestling', 'sports']
  const cat = category.toLowerCase()
  const key = sportsCats.includes(cat) ? 'sports' : cat === 'one piece' ? 'onepiece' : cat
  const t = ESTIMATED_TOKENS[key as keyof typeof ESTIMATED_TOKENS] || ESTIMATED_TOKENS.sports
  return (t.input / 1000) * OPENAI_PRICING.input_per_1k
    + (t.output / 1000) * OPENAI_PRICING.output_per_1k
    + t.images * OPENAI_PRICING.image
}

function monthBounds(monthStr: string): { start: Date; end: Date } {
  // monthStr: YYYY-MM
  const [y, m] = monthStr.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0)) // exclusive — start of next month
  return { start, end }
}

function monthLabel(d: Date): string {
  return d.toISOString().slice(0, 7)
}

// ---------- Revenue + variable cost computation for one month ----------

interface MonthBreakdown {
  month: string

  // Revenue
  revenue_total: number
  revenue_stripe_credits: number
  revenue_stripe_subscription: number
  revenue_apple_iap: number
  revenue_google_iap: number

  // Variable costs
  openai_cost: number
  openai_source: 'actual' | 'estimate'
  stripe_fees: number
  stripe_fees_source: 'actual' | 'estimate'
  apple_iap_fee: number
  google_iap_fee: number
  variable_cost_total: number

  // Fixed costs
  fixed_cost_total: number

  // Computed
  gross_margin: number       // revenue - variable
  gross_margin_pct: number
  net_margin: number         // revenue - variable - fixed
  net_margin_pct: number
  card_count: number         // cards graded that month
}

async function computeMonth(start: Date, end: Date): Promise<MonthBreakdown> {
  const month = monthLabel(start)
  const startIso = start.toISOString()
  const endIso = end.toISOString()
  const startDateOnly = start.toISOString().slice(0, 10)
  const endDateOnly = new Date(end.getTime() - 1).toISOString().slice(0, 10) // last day of month

  // ----- Revenue -----
  const [stripeCreditsRes, subsRes, iapRes] = await Promise.all([
    supabaseAdmin
      .from('credit_transactions')
      .select('description, amount, stripe_payment_intent_id')
      .eq('type', 'purchase')
      .not('stripe_payment_intent_id', 'is', null)
      .gte('created_at', startIso)
      .lt('created_at', endIso)
      .limit(10000),
    supabaseAdmin
      .from('subscription_events')
      .select('plan, event_type, stripe_subscription_id')
      .in('event_type', ['subscribed', 'renewed'])
      .gte('created_at', startIso)
      .lt('created_at', endIso)
      .limit(10000),
    // Production environment only — exclude TestFlight + Apple reviewer
    // sandbox rows so the P&L reflects real money.
    supabaseAdmin
      .from('iap_transactions')
      .select('platform, product_id, raw_receipt, status, environment')
      .eq('status', 'active')
      .eq('environment', 'production')
      .gte('created_at', startIso)
      .lt('created_at', endIso)
      .limit(10000),
  ])

  let stripeCredits = 0
  ;(stripeCreditsRes.data || []).forEach((r: any) => {
    const tier = descriptionToTier(r.description)
    if (tier) stripeCredits += STRIPE_CREDIT_PACK_PRICES[tier]
  })

  let stripeSubs = 0
  ;(subsRes.data || []).forEach((r: any) => {
    if (!r.stripe_subscription_id) return
    const plan = (r.plan || '').toLowerCase()
    stripeSubs += CARD_LOVERS_PRICES[plan] || 0
  })

  let appleRev = 0
  let googleRev = 0
  ;(iapRes.data || []).forEach((r: any) => {
    let amt = 0
    if (r.raw_receipt && typeof r.raw_receipt.price === 'number') {
      amt = r.raw_receipt.price / 100
    } else if (IAP_PRICE_FALLBACK_USD[r.product_id] !== undefined) {
      amt = IAP_PRICE_FALLBACK_USD[r.product_id]
    }
    if (r.platform === 'apple') appleRev += amt
    else if (r.platform === 'google') googleRev += amt
  })

  const revenueTotal = stripeCredits + stripeSubs + appleRev + googleRev
  const stripeChargeCount = (stripeCreditsRes.data || []).length + (subsRes.data || []).filter((r: any) => !!r.stripe_subscription_id).length
  const stripeGrossRevenue = stripeCredits + stripeSubs

  // ----- OpenAI cost: prefer actual from openai_daily_costs, fall back to estimate -----
  const { data: oaiActuals } = await supabaseAdmin
    .from('openai_daily_costs')
    .select('cost_usd, date')
    .gte('date', startDateOnly)
    .lte('date', endDateOnly)
  const oaiActualSum = (oaiActuals || []).reduce((s, r: any) => s + Number(r.cost_usd || 0), 0)

  let openaiCost: number
  let openaiSource: 'actual' | 'estimate'
  if (oaiActuals && oaiActuals.length > 0) {
    openaiCost = oaiActualSum
    openaiSource = 'actual'
  } else {
    // Fallback: estimate from cards graded that month
    const { data: cards } = await supabaseAdmin
      .from('cards')
      .select('category')
      .not('conversational_decimal_grade', 'is', null)
      .gte('created_at', startIso)
      .lt('created_at', endIso)
      .limit(10000)
    openaiCost = (cards || []).reduce((s, c: any) => s + estimateGradingCost(c.category || 'Sports'), 0)
    openaiSource = 'estimate'
  }

  // ----- Stripe fees: prefer actual from stripe_daily_fees, fall back to formula -----
  const { data: stripeActuals } = await supabaseAdmin
    .from('stripe_daily_fees')
    .select('fee_usd, date')
    .gte('date', startDateOnly)
    .lte('date', endDateOnly)
  const stripeActualSum = (stripeActuals || []).reduce((s, r: any) => s + Number(r.fee_usd || 0), 0)

  let stripeFees: number
  let stripeFeesSource: 'actual' | 'estimate'
  if (stripeActuals && stripeActuals.length > 0) {
    stripeFees = stripeActualSum
    stripeFeesSource = 'actual'
  } else {
    stripeFees = stripeGrossRevenue * STRIPE_PERCENT + stripeChargeCount * STRIPE_FIXED
    stripeFeesSource = 'estimate'
  }

  // ----- IAP fees (deterministic % of revenue) -----
  const appleFee = appleRev * IAP_FEE_RATE
  const googleFee = googleRev * IAP_FEE_RATE

  const variableTotal = openaiCost + stripeFees + appleFee + googleFee

  // ----- Fixed costs active in this month -----
  // Active = effective_from <= last_day AND (effective_to IS NULL OR effective_to >= first_day)
  const { data: fixed } = await supabaseAdmin
    .from('monthly_costs')
    .select('amount_usd, cost_type, effective_from, effective_to')
    .lte('effective_from', endDateOnly)
  const fixedTotal = (fixed || [])
    .filter((c: any) => !c.effective_to || c.effective_to >= startDateOnly)
    .reduce((sum: number, c: any) => sum + Number(c.amount_usd || 0), 0)

  // ----- Card count for the month (cost / card metric) -----
  const { count: cardCount } = await supabaseAdmin
    .from('cards')
    .select('id', { count: 'exact', head: true })
    .not('conversational_decimal_grade', 'is', null)
    .gte('created_at', startIso)
    .lt('created_at', endIso)

  const grossMargin = revenueTotal - variableTotal
  const netMargin = grossMargin - fixedTotal
  const grossPct = revenueTotal > 0 ? (grossMargin / revenueTotal) * 100 : 0
  const netPct = revenueTotal > 0 ? (netMargin / revenueTotal) * 100 : 0

  return {
    month,
    revenue_total: Math.round(revenueTotal * 100) / 100,
    revenue_stripe_credits: Math.round(stripeCredits * 100) / 100,
    revenue_stripe_subscription: Math.round(stripeSubs * 100) / 100,
    revenue_apple_iap: Math.round(appleRev * 100) / 100,
    revenue_google_iap: Math.round(googleRev * 100) / 100,
    openai_cost: Math.round(openaiCost * 100) / 100,
    openai_source: openaiSource,
    stripe_fees: Math.round(stripeFees * 100) / 100,
    stripe_fees_source: stripeFeesSource,
    apple_iap_fee: Math.round(appleFee * 100) / 100,
    google_iap_fee: Math.round(googleFee * 100) / 100,
    variable_cost_total: Math.round(variableTotal * 100) / 100,
    fixed_cost_total: Math.round(fixedTotal * 100) / 100,
    gross_margin: Math.round(grossMargin * 100) / 100,
    gross_margin_pct: Math.round(grossPct * 10) / 10,
    net_margin: Math.round(netMargin * 100) / 100,
    net_margin_pct: Math.round(netPct * 10) / 10,
    card_count: cardCount || 0,
  }
}

// ---------- Handler ----------

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const admin = await verifyAdminSession(token)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const monthParam = request.nextUrl.searchParams.get('month')
    const now = new Date()
    const defaultMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
    const targetMonth = monthParam || defaultMonth

    if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
      return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 })
    }

    // Compute selected month + the previous 11 months for the trend chart.
    const [y, m] = targetMonth.split('-').map(Number)
    const months: Array<{ start: Date; end: Date }> = []
    for (let i = 11; i >= 0; i--) {
      const monthY = m - i > 0 ? y : y - 1
      const monthM = ((m - i - 1 + 12) % 12) + 1
      const start = new Date(Date.UTC(monthY, monthM - 1, 1))
      const end = new Date(Date.UTC(monthY, monthM, 1))
      months.push({ start, end })
    }

    const breakdowns = await Promise.all(months.map((mb) => computeMonth(mb.start, mb.end)))
    const selected = breakdowns[breakdowns.length - 1]

    // Cost-by-category for the selected month (fixed costs grouped)
    const { data: fixedRows } = await supabaseAdmin
      .from('monthly_costs')
      .select('vendor, category, amount_usd, cost_type, effective_from, effective_to, notes')
      .lte('effective_from', new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10))
    const activeFixed = (fixedRows || []).filter((r: any) => {
      const firstDay = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10)
      return !r.effective_to || r.effective_to >= firstDay
    })
    const categoryAgg: Record<string, { total: number; vendors: string[] }> = {}
    activeFixed.forEach((r: any) => {
      if (!categoryAgg[r.category]) categoryAgg[r.category] = { total: 0, vendors: [] }
      categoryAgg[r.category].total += Number(r.amount_usd || 0)
      categoryAgg[r.category].vendors.push(r.vendor)
    })
    const fixedByCategory = Object.entries(categoryAgg).map(([category, v]) => ({
      category,
      total: Math.round(v.total * 100) / 100,
      vendors: v.vendors,
    })).sort((a, b) => b.total - a.total)

    return NextResponse.json({
      month: selected.month,
      iap_fee_rate_pct: IAP_FEE_RATE * 100,
      selected,
      trend: breakdowns,
      fixed_by_category: fixedByCategory,
      fixed_rows: activeFixed,
    })
  } catch (err: any) {
    console.error('[admin/costs/summary] error:', err)
    return NextResponse.json({ error: 'Internal server error', details: err?.message }, { status: 500 })
  }
}
