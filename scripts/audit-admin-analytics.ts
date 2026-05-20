/**
 * Reproduces the exact queries each /api/admin/analytics/* endpoint runs
 * and prints the totals so we can sanity-check the admin dashboard
 * numbers against the database.
 *
 * Run: npx tsx scripts/audit-admin-analytics.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const PLATFORMS = ['web', 'ios_app', 'android_app'] as const
function np(s: string | null | undefined): typeof PLATFORMS[number] {
  if (s === 'ios_app' || s === 'android_app' || s === 'web') return s
  return 'web'
}

async function section(title: string) {
  console.log('\n' + '═'.repeat(70))
  console.log('  ' + title)
  console.log('═'.repeat(70))
}

async function auditUsers() {
  await section('USERS analytics')

  const { data: allUsers, count: usersCount } = await supabase
    .from('users')
    .select('id, email, created_at, signup_source', { count: 'exact' })
    .limit(100000)
  console.log(`Total users in public.users: ${usersCount}`)

  // signup_source distribution
  const bySource: Record<string, number> = { web: 0, ios_app: 0, android_app: 0, null: 0 }
  allUsers?.forEach((u: any) => {
    if (u.signup_source === null || u.signup_source === undefined) bySource.null += 1
    else bySource[u.signup_source] = (bySource[u.signup_source] || 0) + 1
  })
  console.log('By signup_source (raw):')
  for (const [k, v] of Object.entries(bySource)) console.log(`  ${k.padEnd(15)} ${v}`)

  // Auth users count (compare against public.users)
  let authCount = 0
  for (let page = 1; page <= 50; page++) {
    const { data } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (!data.users.length) break
    authCount += data.users.length
    if (data.users.length < 200) break
  }
  console.log(`Total users in auth.users:   ${authCount}`)
  if (authCount !== usersCount) {
    console.log(`  ⚠️  MISMATCH — auth has ${authCount}, public.users has ${usersCount}`)
  }

  // Activity counts
  const now = new Date()
  const day = (n: number) => new Date(now.getTime() - n * 24 * 3600 * 1000).toISOString()
  const { data: cards7 } = await supabase.from('cards').select('user_id').gte('created_at', day(7)).limit(100000)
  const { data: cards30 } = await supabase.from('cards').select('user_id').gte('created_at', day(30)).limit(100000)
  console.log(`Active users (uploaded card last 7d):  ${new Set(cards7?.map((c: any) => c.user_id)).size}`)
  console.log(`Active users (uploaded card last 30d): ${new Set(cards30?.map((c: any) => c.user_id)).size}`)
}

async function auditCards() {
  await section('CARDS analytics')
  const { data: cards, count } = await supabase
    .from('cards')
    .select('id, category, created_at, is_public, visibility, graded_from, conversational_decimal_grade', { count: 'exact' })
    .limit(100000)
  console.log(`Total cards in cards table: ${count}`)

  const byCat: Record<string, number> = {}
  const byPlatform: Record<string, number> = { web: 0, ios_app: 0, android_app: 0 }
  let pub = 0
  let graded = 0
  let nullGradedFrom = 0
  cards?.forEach((c: any) => {
    const cat = c.category || 'Other'
    byCat[cat] = (byCat[cat] || 0) + 1
    if (c.graded_from === null || c.graded_from === undefined) nullGradedFrom += 1
    byPlatform[np(c.graded_from)] += 1
    if (c.is_public === true || c.visibility === 'public') pub += 1
    if (c.conversational_decimal_grade !== null) graded += 1
  })
  console.log(`Cards with non-null grade (counted as "graded"): ${graded}`)
  console.log(`Public cards: ${pub}    Private: ${(count || 0) - pub}`)
  console.log(`graded_from = NULL: ${nullGradedFrom}  (these get default-bucketed to "web")`)
  console.log('Cards by platform:')
  for (const [p, v] of Object.entries(byPlatform)) console.log(`  ${p.padEnd(15)} ${v}`)
  console.log('Top 10 categories:')
  Object.entries(byCat)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 10)
    .forEach(([cat, n]) => console.log(`  ${cat.padEnd(20)} ${n}`))
}

async function auditGrading() {
  await section('GRADING analytics')
  const { data: cards, count } = await supabase
    .from('cards')
    .select('conversational_decimal_grade, category, created_at, graded_from', { count: 'exact' })
    .not('conversational_decimal_grade', 'is', null)
    .limit(100000)
  console.log(`Cards with conversational_decimal_grade NOT NULL: ${count}`)

  let sumGrade = 0
  let perfectTen = 0
  let highGrades = 0
  const byPlatform: Record<string, number> = { web: 0, ios_app: 0, android_app: 0 }
  cards?.forEach((c: any) => {
    sumGrade += c.conversational_decimal_grade
    if (c.conversational_decimal_grade === 10) perfectTen += 1
    if (c.conversational_decimal_grade >= 9) highGrades += 1
    byPlatform[np(c.graded_from)] += 1
  })
  const avg = cards && cards.length > 0 ? sumGrade / cards.length : 0
  console.log(`Average grade: ${avg.toFixed(2)}`)
  console.log(`Perfect 10s: ${perfectTen} (${count ? ((perfectTen / count) * 100).toFixed(1) : 0}%)`)
  console.log(`High grades (9+): ${highGrades} (${count ? ((highGrades / count) * 100).toFixed(1) : 0}%)`)
  console.log('Graded by platform:')
  for (const [p, v] of Object.entries(byPlatform)) console.log(`  ${p.padEnd(15)} ${v}`)
}

async function auditConversion() {
  await section('CONVERSION analytics')

  const { data: users, count: userCount } = await supabase
    .from('user_credits')
    .select('user_id, created_at', { count: 'exact' })
    .limit(100000)
  console.log(`Users with a user_credits row: ${userCount}`)

  const { data: grades, count: gradesCount } = await supabase
    .from('credit_transactions')
    .select('user_id, type', { count: 'exact' })
    .eq('type', 'grade')
    .limit(200000)
  console.log(`credit_transactions where type=grade: ${gradesCount}`)
  const usersWhoGraded = new Set(grades?.map((g: any) => g.user_id))
  console.log(`Unique users who graded: ${usersWhoGraded.size}`)

  const { data: purchases, count: purchaseCount } = await supabase
    .from('credit_transactions')
    .select('user_id, type', { count: 'exact' })
    .eq('type', 'purchase')
    .limit(100000)
  console.log(`credit_transactions where type=purchase: ${purchaseCount}`)
  const usersWhoPurchasedStripe = new Set(purchases?.map((p: any) => p.user_id))
  console.log(`Unique users who purchased via Stripe: ${usersWhoPurchasedStripe.size}`)

  const { data: iap, count: iapCount } = await supabase
    .from('iap_transactions')
    .select('user_id, status, environment', { count: 'exact' })
    .eq('status', 'active')
    .eq('environment', 'production')
    .limit(100000)
  console.log(`iap_transactions active+production: ${iapCount}`)
  const usersWhoPurchasedIAP = new Set(iap?.map((t: any) => t.user_id))
  console.log(`Unique users who purchased via IAP (prod): ${usersWhoPurchasedIAP.size}`)

  const combined = new Set([...usersWhoPurchasedStripe, ...usersWhoPurchasedIAP])
  console.log(`Unique users who purchased (Stripe + IAP combined): ${combined.size}`)

  // Per-platform funnel
  console.log('')
  console.log('Per-platform funnel (signups → graded → purchased):')
  const { data: userPlatforms } = await supabase
    .from('users')
    .select('id, signup_source')
    .limit(100000)
  const platformBy: Record<string, string> = {}
  userPlatforms?.forEach((u: any) => { platformBy[u.id] = u.signup_source || 'web' })

  const buckets: Record<string, { signups: number; graded: number; purchased: number }> = {
    web: { signups: 0, graded: 0, purchased: 0 },
    ios_app: { signups: 0, graded: 0, purchased: 0 },
    android_app: { signups: 0, graded: 0, purchased: 0 },
  }

  // Iterate ALL user_credits user_ids (the source the conversion endpoint uses for signups)
  for (const u of users || []) {
    const userId = (u as any).user_id
    const p = np(platformBy[userId])
    buckets[p].signups += 1
    if (usersWhoGraded.has(userId)) buckets[p].graded += 1
    if (combined.has(userId)) buckets[p].purchased += 1
  }
  for (const [platform, b] of Object.entries(buckets)) {
    const rate = b.signups > 0 ? ((b.purchased / b.signups) * 100).toFixed(1) : '0.0'
    console.log(`  ${platform.padEnd(15)} signups=${String(b.signups).padStart(4)}  graded=${String(b.graded).padStart(4)}  purchased=${String(b.purchased).padStart(4)}  purchase%=${rate}`)
  }
}

async function diffAuthVsPublicUsers() {
  await section('SANITY: users without a public.users row?')
  // user_credits user_ids vs public.users.id
  const { data: uc } = await supabase.from('user_credits').select('user_id').limit(100000)
  const { data: pu } = await supabase.from('users').select('id').limit(100000)
  const ucSet = new Set((uc || []).map((u: any) => u.user_id))
  const puSet = new Set((pu || []).map((u: any) => u.id))
  const inUcNotPu = [...ucSet].filter((id) => !puSet.has(id))
  const inPuNotUc = [...puSet].filter((id) => !ucSet.has(id))
  console.log(`user_credits rows: ${ucSet.size}`)
  console.log(`public.users rows: ${puSet.size}`)
  console.log(`in user_credits but NOT in public.users: ${inUcNotPu.length}`)
  console.log(`in public.users but NOT in user_credits: ${inPuNotUc.length}`)
  if (inUcNotPu.length > 0) {
    console.log(`  Sample: ${inUcNotPu.slice(0, 3).join(', ')}`)
    console.log(`  ⚠️  Conversion endpoint uses user_credits for signup source platform lookup;`)
    console.log(`     these users won't have a platform attribution → default to 'web'.`)
  }
}

async function main() {
  await auditUsers()
  await auditCards()
  await auditGrading()
  await auditConversion()
  await diffAuthVsPublicUsers()
  console.log('')
}

main().catch((e) => { console.error(e); process.exit(1) })
