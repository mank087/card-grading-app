import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// OpenAI GPT-5.1 pricing (single API call per grading with 3-pass consensus in prompt)
// The 3-pass system runs within one API response, not 3 separate calls
const PRICING = {
  'gpt-5.1': {
    input_per_1k: 0.005,   // $5.00 per 1M tokens = $0.005 per 1K
    output_per_1k: 0.015,   // $15.00 per 1M tokens = $0.015 per 1K
    image: 0.002            // ~$2.00 per image
  }
}

// Estimated token usage per grading (single API call, 3-pass output in one response)
// Input: rubric prompt + card-type delta + images
// Output: 3 grading passes + averaged results + narrative (~16K max)
const ESTIMATED_TOKENS = {
  sports: { input: 8000, output: 8000, images: 2 },
  pokemon: { input: 7500, output: 7500, images: 2 },
  mtg: { input: 7000, output: 7000, images: 2 },
  lorcana: { input: 7200, output: 7200, images: 2 },
  onepiece: { input: 7200, output: 7200, images: 2 },
  other: { input: 6800, output: 6800, images: 2 }
}

function estimateCostPerGrading(category: string = 'sports'): number {
  // Normalize category to match ESTIMATED_TOKENS keys
  const sportCategories = ['football', 'baseball', 'basketball', 'hockey', 'soccer', 'wrestling', 'sports']
  const categoryLower = category.toLowerCase()
  const tokenKey = sportCategories.includes(categoryLower) ? 'sports'
    : categoryLower === 'one piece' ? 'onepiece'
    : categoryLower
  const tokens = ESTIMATED_TOKENS[tokenKey as keyof typeof ESTIMATED_TOKENS] || ESTIMATED_TOKENS.sports

  const inputCost = (tokens.input / 1000) * PRICING['gpt-5.1'].input_per_1k
  const outputCost = (tokens.output / 1000) * PRICING['gpt-5.1'].output_per_1k
  const imageCost = tokens.images * PRICING['gpt-5.1'].image

  return inputCost + outputCost + imageCost
}

export async function GET(request: NextRequest) {
  try {
    // Verify admin session
    const token = request.cookies.get('admin_token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await verifyAdminSession(token)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if api_usage_log has data
    const { data: apiLogs, error: apiError } = await supabaseAdmin
      .from('api_usage_log')
      .select('cost_usd, created_at, service')
      .order('created_at', { ascending: false })
      .limit(1000)

    // If we have actual API logs, use them but still return full response shape
    // (the frontend expects total_estimated_cost, by_category, monthly_trend, etc.)
    // Fall through to estimate path which always works

    // Otherwise, estimate based on card gradings (explicit limit to bypass Supabase 1000 default)
    const { data: cards, error: cardsError } = await supabaseAdmin
      .from('cards')
      .select('id, category, created_at')
      .not('conversational_decimal_grade', 'is', null)
      .limit(100000)

    if (cardsError) {
      throw cardsError
    }

    // Estimate costs by category
    const costByCategory: Record<string, { cards: number; cost: number }> = {}
    let totalEstimatedCost = 0

    cards?.forEach(card => {
      const category = card.category || 'Sports'
      const cost = estimateCostPerGrading(category)

      if (!costByCategory[category]) {
        costByCategory[category] = { cards: 0, cost: 0 }
      }

      costByCategory[category].cards++
      costByCategory[category].cost += cost
      totalEstimatedCost += cost
    })

    // Cost breakdown by category
    const categoryBreakdown = Object.keys(costByCategory).map(category => ({
      category,
      cards_graded: costByCategory[category].cards,
      total_cost: Math.round(costByCategory[category].cost * 100) / 100,
      avg_cost_per_card: Math.round((costByCategory[category].cost / costByCategory[category].cards) * 1000) / 1000
    })).sort((a, b) => b.total_cost - a.total_cost)

    // Monthly costs (last 12 months)
    const monthlyCosts: Array<{ month: string; cost: number; cards: number }> = []
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date()
      monthStart.setMonth(monthStart.getMonth() - i)
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)

      const monthEnd = new Date(monthStart)
      monthEnd.setMonth(monthEnd.getMonth() + 1)

      const monthCards = cards?.filter(c => {
        const cardDate = new Date(c.created_at)
        return cardDate >= monthStart && cardDate < monthEnd
      }) || []

      const monthCost = monthCards.reduce((sum, c) => {
        return sum + estimateCostPerGrading(c.category || 'Sports')
      }, 0)

      monthlyCosts.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        cost: Math.round(monthCost * 100) / 100,
        cards: monthCards.length
      })
    }

    // Calculate projections
    const cardsLast30Days = cards?.filter(c => {
      const cardDate = new Date(c.created_at)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      return cardDate >= thirtyDaysAgo
    }).length || 0

    const costLast30Days = cards?.filter(c => {
      const cardDate = new Date(c.created_at)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      return cardDate >= thirtyDaysAgo
    }).reduce((sum, c) => sum + estimateCostPerGrading(c.category || 'Sports'), 0) || 0

    const projectedMonthlyCost = costLast30Days
    const projectedAnnualCost = projectedMonthlyCost * 12

    const avgCostPerCard = (cards?.length || 0) > 0
      ? totalEstimatedCost / cards.length
      : 0.015 // Default estimate

    const analytics = {
      overview: {
        total_estimated_cost: Math.round(totalEstimatedCost * 100) / 100,
        total_cards_graded: cards?.length || 0,
        avg_cost_per_card: Math.round(avgCostPerCard * 1000) / 1000,
        cost_last_30_days: Math.round(costLast30Days * 100) / 100,
        cards_last_30_days: cardsLast30Days,
        projected_monthly: Math.round(projectedMonthlyCost * 100) / 100,
        projected_annual: Math.round(projectedAnnualCost * 100) / 100,
        has_actual_data: false
      },
      by_category: categoryBreakdown,
      monthly_trend: monthlyCosts,
      pricing_model: {
        input_per_1k_tokens: PRICING['gpt-5.1'].input_per_1k,
        output_per_1k_tokens: PRICING['gpt-5.1'].output_per_1k,
        per_image: PRICING['gpt-5.1'].image
      },
      note: 'Costs are estimated based on card gradings. Integrate API logging for actual costs.'
    }

    return NextResponse.json(analytics, { status: 200 })
  } catch (error) {
    console.error('Error fetching financial analytics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
