import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabase } from '@/lib/supabaseClient'

// OpenAI GPT-4o pricing (as of Nov 2025)
const PRICING = {
  'gpt-4o': {
    input_per_1k: 0.0025,  // $2.50 per 1M tokens = $0.0025 per 1K
    output_per_1k: 0.010,   // $10.00 per 1M tokens = $0.010 per 1K
    image: 0.001275         // ~$1.275 per image (roughly 1000 tokens)
  }
}

// Estimated token usage per grading (based on your prompts)
const ESTIMATED_TOKENS = {
  sports: { input: 8000, output: 1500, images: 2 },
  pokemon: { input: 7500, output: 1400, images: 2 },
  mtg: { input: 7000, output: 1300, images: 2 },
  lorcana: { input: 7200, output: 1350, images: 2 },
  other: { input: 6800, output: 1250, images: 2 }
}

function estimateCostPerGrading(category: string = 'sports'): number {
  const categoryLower = category.toLowerCase()
  const tokens = ESTIMATED_TOKENS[categoryLower as keyof typeof ESTIMATED_TOKENS] || ESTIMATED_TOKENS.sports

  const inputCost = (tokens.input / 1000) * PRICING['gpt-4o'].input_per_1k
  const outputCost = (tokens.output / 1000) * PRICING['gpt-4o'].output_per_1k
  const imageCost = tokens.images * PRICING['gpt-4o'].image

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
    const { data: apiLogs, error: apiError } = await supabase
      .from('api_usage_log')
      .select('cost_usd, created_at, service')
      .order('created_at', { ascending: false })
      .limit(1000)

    // If we have actual API logs, use them
    if (apiLogs && apiLogs.length > 0) {
      // Calculate actual costs from logs
      const totalCost = apiLogs.reduce((sum, log) => sum + (log.cost_usd || 0), 0)

      // Group by day
      const costByDay: Record<string, number> = {}
      apiLogs.forEach(log => {
        const date = new Date(log.created_at).toISOString().split('T')[0]
        costByDay[date] = (costByDay[date] || 0) + (log.cost_usd || 0)
      })

      const dailyData = Object.keys(costByDay).sort().map(date => ({
        date,
        cost: Math.round(costByDay[date] * 100) / 100
      }))

      return NextResponse.json({
        overview: {
          total_cost: Math.round(totalCost * 100) / 100,
          has_actual_data: true
        },
        daily_costs: dailyData
      }, { status: 200 })
    }

    // Otherwise, estimate based on card gradings
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .select('id, category, created_at')
      .not('conversational_decimal_grade', 'is', null)

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
        input_per_1k_tokens: PRICING['gpt-4o'].input_per_1k,
        output_per_1k_tokens: PRICING['gpt-4o'].output_per_1k,
        per_image: PRICING['gpt-4o'].image
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
