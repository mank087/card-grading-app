/**
 * Free Credit Conversion Analysis
 *
 * Run with: npx tsx scripts/free-credit-analysis.ts
 *
 * Analyzes the signup → free grade → purchase funnel to determine
 * whether the free credit is driving conversions or leaking value.
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

// Load env from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function analyze() {
  console.log('\n========================================')
  console.log('  FREE CREDIT CONVERSION ANALYSIS')
  console.log('========================================\n')

  // 1. Get all users
  const { data: users, error: usersError } = await supabase
    .from('user_credits')
    .select('user_id, balance, total_purchased, total_used, first_purchase_bonus_claimed, is_founder, created_at')

  if (usersError) { console.error('Error fetching users:', usersError); return }
  if (!users || users.length === 0) { console.log('No users found.'); return }

  // 2. Get all transactions
  const { data: transactions, error: txError } = await supabase
    .from('credit_transactions')
    .select('user_id, type, amount, description, created_at')
    .order('created_at', { ascending: true })

  if (txError) { console.error('Error fetching transactions:', txError); return }

  // Build lookup maps
  const gradesByUser = new Map<string, Date[]>()
  const purchasesByUser = new Map<string, { date: Date; amount: number; desc: string }[]>()

  transactions?.forEach(tx => {
    if (tx.type === 'grade' || tx.type === 'regrade') {
      const existing = gradesByUser.get(tx.user_id) || []
      existing.push(new Date(tx.created_at))
      gradesByUser.set(tx.user_id, existing)
    }
    if (tx.type === 'purchase') {
      const existing = purchasesByUser.get(tx.user_id) || []
      existing.push({ date: new Date(tx.created_at), amount: tx.amount, desc: tx.description || '' })
      purchasesByUser.set(tx.user_id, existing)
    }
  })

  // ============ FUNNEL OVERVIEW ============
  const totalUsers = users.length
  const usersWhoGraded = users.filter(u => gradesByUser.has(u.user_id))
  const usersWhoPurchased = users.filter(u => purchasesByUser.has(u.user_id))
  const usersGradedOnly = usersWhoGraded.filter(u => !purchasesByUser.has(u.user_id))
  const usersGradedThenPurchased = usersWhoGraded.filter(u => purchasesByUser.has(u.user_id))
  const usersNeverGraded = users.filter(u => !gradesByUser.has(u.user_id))
  const usersNeverGradedButPurchased = usersNeverGraded.filter(u => purchasesByUser.has(u.user_id))

  console.log('--- FUNNEL OVERVIEW ---')
  console.log(`Total signups:                    ${totalUsers}`)
  console.log(`Used free grade (graded at all):   ${usersWhoGraded.length}  (${pct(usersWhoGraded.length, totalUsers)})`)
  console.log(`Never graded a card:               ${usersNeverGraded.length}  (${pct(usersNeverGraded.length, totalUsers)})`)
  console.log(`Made a purchase (any):             ${usersWhoPurchased.length}  (${pct(usersWhoPurchased.length, totalUsers)})`)
  console.log()
  console.log(`Graded → Purchased:                ${usersGradedThenPurchased.length}  (${pct(usersGradedThenPurchased.length, usersWhoGraded.length)} of graders)`)
  console.log(`Graded → NEVER purchased:          ${usersGradedOnly.length}  (${pct(usersGradedOnly.length, usersWhoGraded.length)} of graders)`)
  console.log(`Never graded → Purchased anyway:   ${usersNeverGradedButPurchased.length}`)
  console.log()

  // ============ FREE CREDIT COST ============
  // Each grade costs ~$0.15-0.40 in OpenAI API (estimate)
  const estimatedCostPerGrade = 0.25 // conservative estimate
  const freeGradesUsed = usersWhoGraded.length // 1 free grade each
  const nonConvertingFreeGrades = usersGradedOnly.length
  console.log('--- FREE CREDIT COST ESTIMATE ---')
  console.log(`Free grades used:                  ${freeGradesUsed}`)
  console.log(`Free grades that never converted:  ${nonConvertingFreeGrades}`)
  console.log(`Est. API cost per grade:           $${estimatedCostPerGrade.toFixed(2)}`)
  console.log(`Est. wasted API cost:              $${(nonConvertingFreeGrades * estimatedCostPerGrade).toFixed(2)}`)
  console.log(`Est. total free grade cost:         $${(freeGradesUsed * estimatedCostPerGrade).toFixed(2)}`)
  console.log()

  // ============ USAGE DEPTH ============
  // How many total grades did each user segment do?
  const gradeCountsBySegment = {
    convertedGrades: 0,
    nonConvertedGrades: 0,
  }
  usersGradedThenPurchased.forEach(u => {
    gradeCountsBySegment.convertedGrades += (gradesByUser.get(u.user_id)?.length || 0)
  })
  usersGradedOnly.forEach(u => {
    gradeCountsBySegment.nonConvertedGrades += (gradesByUser.get(u.user_id)?.length || 0)
  })

  console.log('--- USAGE DEPTH ---')
  console.log(`Converters avg grades:             ${usersGradedThenPurchased.length > 0 ? (gradeCountsBySegment.convertedGrades / usersGradedThenPurchased.length).toFixed(1) : 'N/A'}`)
  console.log(`Non-converters avg grades:         ${usersGradedOnly.length > 0 ? (gradeCountsBySegment.nonConvertedGrades / usersGradedOnly.length).toFixed(1) : 'N/A'}`)
  console.log(`(Non-converters at exactly 1 grade = used free credit and left)`)
  const oneAndDone = usersGradedOnly.filter(u => (gradesByUser.get(u.user_id)?.length || 0) === 1)
  console.log(`Non-converters with exactly 1 grade: ${oneAndDone.length}  (${pct(oneAndDone.length, usersGradedOnly.length)} of non-converters)`)
  console.log()

  // ============ TIME TO PURCHASE ============
  const timeToPurchaseDays: number[] = []
  usersGradedThenPurchased.forEach(u => {
    const signupDate = new Date(u.created_at)
    const firstPurchase = purchasesByUser.get(u.user_id)?.[0]
    if (firstPurchase) {
      const days = (firstPurchase.date.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24)
      timeToPurchaseDays.push(days)
    }
  })
  timeToPurchaseDays.sort((a, b) => a - b)

  console.log('--- TIME FROM SIGNUP TO FIRST PURCHASE ---')
  if (timeToPurchaseDays.length > 0) {
    console.log(`Same day (< 24h):                  ${timeToPurchaseDays.filter(d => d < 1).length}  (${pct(timeToPurchaseDays.filter(d => d < 1).length, timeToPurchaseDays.length)})`)
    console.log(`Within 3 days:                     ${timeToPurchaseDays.filter(d => d <= 3).length}  (${pct(timeToPurchaseDays.filter(d => d <= 3).length, timeToPurchaseDays.length)})`)
    console.log(`Within 7 days:                     ${timeToPurchaseDays.filter(d => d <= 7).length}  (${pct(timeToPurchaseDays.filter(d => d <= 7).length, timeToPurchaseDays.length)})`)
    console.log(`Within 30 days:                    ${timeToPurchaseDays.filter(d => d <= 30).length}  (${pct(timeToPurchaseDays.filter(d => d <= 30).length, timeToPurchaseDays.length)})`)
    console.log(`Over 30 days:                      ${timeToPurchaseDays.filter(d => d > 30).length}  (${pct(timeToPurchaseDays.filter(d => d > 30).length, timeToPurchaseDays.length)})`)
    console.log(`Median days to purchase:           ${timeToPurchaseDays[Math.floor(timeToPurchaseDays.length / 2)].toFixed(1)}`)
    console.log(`Average days to purchase:          ${(timeToPurchaseDays.reduce((a, b) => a + b, 0) / timeToPurchaseDays.length).toFixed(1)}`)
  } else {
    console.log('No converted users to analyze.')
  }
  console.log()

  // ============ TIME FROM FREE GRADE TO PURCHASE ============
  const timeFromGradeToPurchase: number[] = []
  usersGradedThenPurchased.forEach(u => {
    const firstGrade = gradesByUser.get(u.user_id)?.[0]
    const firstPurchase = purchasesByUser.get(u.user_id)?.[0]
    if (firstGrade && firstPurchase) {
      const days = (firstPurchase.date.getTime() - firstGrade.getTime()) / (1000 * 60 * 60 * 24)
      timeFromGradeToPurchase.push(days)
    }
  })
  timeFromGradeToPurchase.sort((a, b) => a - b)

  console.log('--- TIME FROM FIRST GRADE TO FIRST PURCHASE ---')
  if (timeFromGradeToPurchase.length > 0) {
    console.log(`Same session (< 1h):               ${timeFromGradeToPurchase.filter(d => d < 1/24).length}  (${pct(timeFromGradeToPurchase.filter(d => d < 1/24).length, timeFromGradeToPurchase.length)})`)
    console.log(`Same day (< 24h):                  ${timeFromGradeToPurchase.filter(d => d < 1).length}  (${pct(timeFromGradeToPurchase.filter(d => d < 1).length, timeFromGradeToPurchase.length)})`)
    console.log(`Within 3 days:                     ${timeFromGradeToPurchase.filter(d => d <= 3).length}  (${pct(timeFromGradeToPurchase.filter(d => d <= 3).length, timeFromGradeToPurchase.length)})`)
    console.log(`Within 7 days:                     ${timeFromGradeToPurchase.filter(d => d <= 7).length}  (${pct(timeFromGradeToPurchase.filter(d => d <= 7).length, timeFromGradeToPurchase.length)})`)
    console.log(`Median days:                       ${timeFromGradeToPurchase[Math.floor(timeFromGradeToPurchase.length / 2)].toFixed(2)}`)
    console.log(`(Negative values = purchased before grading)`)
    const purchasedBeforeGrading = timeFromGradeToPurchase.filter(d => d < 0).length
    if (purchasedBeforeGrading > 0) {
      console.log(`Purchased BEFORE first grade:      ${purchasedBeforeGrading}`)
    }
  }
  console.log()

  // ============ PACKAGE BREAKDOWN ============
  const packageStats = { basic: 0, pro: 0, elite: 0, founders: 0, unknown: 0 }
  const packageRevenue = { basic: 0, pro: 0, elite: 0, founders: 0 }
  const allPurchases = transactions?.filter(tx => tx.type === 'purchase') || []

  allPurchases.forEach(p => {
    const desc = (p.description || '').toLowerCase()
    if (desc.includes('founder')) { packageStats.founders++; packageRevenue.founders += 99 }
    else if (desc.includes('elite') || p.amount === 20) { packageStats.elite++; packageRevenue.elite += 19.99 }
    else if (desc.includes('pro') || p.amount === 5) { packageStats.pro++; packageRevenue.pro += 9.99 }
    else if (desc.includes('basic') || p.amount === 1) { packageStats.basic++; packageRevenue.basic += 2.99 }
    else { packageStats.unknown++ }
  })

  const totalRevenue = Object.values(packageRevenue).reduce((a, b) => a + b, 0)
  const totalPurchases = Object.values(packageStats).reduce((a, b) => a + b, 0)

  console.log('--- PACKAGE BREAKDOWN (all purchases, not just first) ---')
  console.log(`Basic ($2.99):    ${packageStats.basic} purchases  →  $${packageRevenue.basic.toFixed(2)}`)
  console.log(`Pro ($9.99):      ${packageStats.pro} purchases  →  $${packageRevenue.pro.toFixed(2)}`)
  console.log(`Elite ($19.99):   ${packageStats.elite} purchases  →  $${packageRevenue.elite.toFixed(2)}`)
  console.log(`Founders ($99):   ${packageStats.founders} purchases  →  $${packageRevenue.founders.toFixed(2)}`)
  if (packageStats.unknown > 0) console.log(`Unknown:          ${packageStats.unknown}`)
  console.log(`Total:            ${totalPurchases} purchases  →  $${totalRevenue.toFixed(2)}`)
  console.log()

  // ============ REPEAT PURCHASE RATE ============
  const repeatBuyers = [...purchasesByUser.entries()].filter(([, purchases]) => purchases.length > 1)
  console.log('--- REPEAT PURCHASE RATE ---')
  console.log(`Users with 1 purchase:             ${usersWhoPurchased.length - repeatBuyers.length}`)
  console.log(`Users with 2+ purchases:           ${repeatBuyers.length}  (${pct(repeatBuyers.length, usersWhoPurchased.length)} of purchasers)`)
  console.log()

  // ============ KEY METRIC: ROI OF FREE CREDIT ============
  console.log('--- FREE CREDIT ROI ---')
  const revenueFromConverted = usersGradedThenPurchased.reduce((total, u) => {
    const purchases = purchasesByUser.get(u.user_id) || []
    return total + purchases.reduce((sum, p) => {
      const desc = (p.desc || '').toLowerCase()
      if (desc.includes('founder')) return sum + 99
      if (desc.includes('elite') || p.amount === 20) return sum + 19.99
      if (desc.includes('pro') || p.amount === 5) return sum + 9.99
      if (desc.includes('basic') || p.amount === 1) return sum + 2.99
      return sum
    }, 0)
  }, 0)

  const totalFreeGradeCost = freeGradesUsed * estimatedCostPerGrade
  console.log(`Revenue from users who used free grade then purchased:  $${revenueFromConverted.toFixed(2)}`)
  console.log(`Est. cost of all free grades:                          $${totalFreeGradeCost.toFixed(2)}`)
  console.log(`Net ROI of free credit program:                        $${(revenueFromConverted - totalFreeGradeCost).toFixed(2)}`)
  console.log(`ROI ratio:                                             ${totalFreeGradeCost > 0 ? (revenueFromConverted / totalFreeGradeCost).toFixed(1) : 'N/A'}x`)
  console.log()

  // ============ DORMANT USERS WITH BALANCE ============
  const dormantWithBalance = users.filter(u => {
    const hasBalance = u.balance > 0
    const noPurchase = !purchasesByUser.has(u.user_id)
    const noGrade = !gradesByUser.has(u.user_id)
    return hasBalance && noPurchase && noGrade
  })
  const dormantGradedNoBalance = usersGradedOnly.filter(u => u.balance === 0)

  console.log('--- DORMANT USERS ---')
  console.log(`Signed up, never graded, never purchased (unused free credit): ${dormantWithBalance.length}`)
  console.log(`Used free grade, balance = 0, never purchased (one-and-done):  ${dormantGradedNoBalance.length}`)
  console.log()

  console.log('========================================')
  console.log('  ANALYSIS COMPLETE')
  console.log('========================================\n')
}

function pct(num: number, denom: number): string {
  if (denom === 0) return '0%'
  return `${(num / denom * 100).toFixed(1)}%`
}

analyze().catch(console.error)
