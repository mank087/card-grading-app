/**
 * Export Users for Email Marketing (EmailOctopus format)
 *
 * Run with: npx tsx scripts/export-users-email-list.ts
 *
 * Outputs a CSV file matching EmailOctopus import format:
 * - Identifier (UUID)
 * - Email address
 * - First name / Last name (from OAuth metadata)
 * - User Status: purchased_credits | only_used_free_credit | didnt_use_free_credit_yet
 * - Founder/VIP Status
 * - Credits Purchased / Used / Balance
 * - Paying Customer (Yes/No)
 * - Tags (empty)
 *
 * Uses paginated fetches to handle any number of users (no 1000-row limit).
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

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

/**
 * Paginated fetch — pulls all rows from a table, 1000 at a time.
 */
async function fetchAll(table: string, select: string, filters?: { column: string; op: string; value: any }[]) {
  const PAGE_SIZE = 1000
  let allData: any[] = []
  let from = 0
  let hasMore = true

  while (hasMore) {
    let query = supabase.from(table).select(select).range(from, from + PAGE_SIZE - 1)
    if (filters) {
      for (const f of filters) {
        if (f.op === 'in') query = query.in(f.column, f.value)
      }
    }
    const { data, error } = await query
    if (error) throw new Error(`Error fetching ${table}: ${error.message}`)
    if (!data || data.length === 0) {
      hasMore = false
    } else {
      allData = allData.concat(data)
      from += PAGE_SIZE
      if (data.length < PAGE_SIZE) hasMore = false
    }
  }
  return allData
}

/**
 * Fetch all auth users via the admin API (paginated, 1000 per page).
 */
async function fetchAllAuthUsers() {
  const allUsers: any[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`Error fetching auth users: ${error.message}`)
    if (!data?.users || data.users.length === 0) {
      hasMore = false
    } else {
      allUsers.push(...data.users)
      if (data.users.length < 1000) {
        hasMore = false
      } else {
        page++
      }
    }
  }
  return allUsers
}

async function exportUsers() {
  console.log('\nFetching user data (paginated)...\n')

  // 1. Get all auth users (includes metadata for names)
  const authUsers = await fetchAllAuthUsers()
  console.log(`  Auth users fetched: ${authUsers.length}`)

  // 2. Get all credit records
  const credits = await fetchAll('user_credits', 'user_id, balance, total_purchased, total_used, is_founder, is_vip')
  console.log(`  Credit records fetched: ${credits.length}`)

  // 3. Get grade transactions to identify who has graded
  const gradeTransactions = await fetchAll('credit_transactions', 'user_id, type', [
    { column: 'type', op: 'in', value: ['grade', 'regrade'] }
  ])
  console.log(`  Grade transactions fetched: ${gradeTransactions.length}`)

  // Build lookup maps
  const creditsByUser = new Map<string, {
    balance: number; total_purchased: number; total_used: number;
    is_founder: boolean; is_vip: boolean;
  }>()
  credits.forEach((c: any) => {
    creditsByUser.set(c.user_id, {
      balance: c.balance ?? 0,
      total_purchased: c.total_purchased ?? 0,
      total_used: c.total_used ?? 0,
      is_founder: c.is_founder ?? false,
      is_vip: c.is_vip ?? false,
    })
  })

  const usersWhoGraded = new Set<string>()
  gradeTransactions.forEach((tx: any) => {
    usersWhoGraded.add(tx.user_id)
  })

  // 4. Build rows
  interface ExportRow {
    identifier: string
    email: string
    first_name: string
    last_name: string
    user_status: string
    founder_vip_status: string
    credits_purchased: number
    credits_used: number
    credits_balance: number
    paying_customer: string
    tags: string
  }

  const rows: ExportRow[] = []

  for (const user of authUsers) {
    const credit = creditsByUser.get(user.id)
    const totalPurchased = credit?.total_purchased ?? 0
    const totalUsed = credit?.total_used ?? 0
    const balance = credit?.balance ?? 0
    const isFounder = credit?.is_founder ?? false
    const isVip = credit?.is_vip ?? false

    // Parse names from OAuth metadata
    const meta = user.user_metadata || {}
    const fullName = meta.full_name || meta.name || ''
    const nameParts = fullName.trim().split(/\s+/)
    const firstName = nameParts[0] || ''
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''

    // User status
    let userStatus: string
    if (totalPurchased > 0) {
      userStatus = 'purchased_credits'
    } else if (totalUsed > 0 || usersWhoGraded.has(user.id)) {
      userStatus = 'only_used_free_credit'
    } else if (balance > 0) {
      userStatus = 'didnt_use_free_credit_yet'
    } else {
      userStatus = 'didnt_use_free_credit_yet'
    }

    // Founder/VIP status
    let founderVipStatus: string
    if (isFounder && isVip) {
      founderVipStatus = 'TRUE'
    } else if (isFounder) {
      founderVipStatus = 'TRUE'
    } else if (isVip) {
      founderVipStatus = 'TRUE'
    } else {
      founderVipStatus = 'FALSE'
    }

    rows.push({
      identifier: user.id,
      email: user.email || '',
      first_name: firstName,
      last_name: lastName,
      user_status: userStatus,
      founder_vip_status: founderVipStatus,
      credits_purchased: totalPurchased,
      credits_used: totalUsed,
      credits_balance: balance,
      paying_customer: totalPurchased > 0 ? 'Yes' : 'No',
      tags: '',
    })
  }

  // Sort: paying first (by credits desc), then free graders, then unused
  const statusOrder: Record<string, number> = {
    'purchased_credits': 0,
    'only_used_free_credit': 1,
    'didnt_use_free_credit_yet': 2,
  }
  rows.sort((a, b) => {
    const orderDiff = (statusOrder[a.user_status] ?? 3) - (statusOrder[b.user_status] ?? 3)
    if (orderDiff !== 0) return orderDiff
    return b.credits_purchased - a.credits_purchased
  })

  // 5. Summary
  const purchased = rows.filter(r => r.user_status === 'purchased_credits').length
  const freeGraders = rows.filter(r => r.user_status === 'only_used_free_credit').length
  const didntUse = rows.filter(r => r.user_status === 'didnt_use_free_credit_yet').length
  const founders = rows.filter(r => r.founder_vip_status === 'TRUE').length

  console.log('\n--- USER SUMMARY ---')
  console.log(`Total users:            ${rows.length}`)
  console.log(`Purchased Credits:      ${purchased}`)
  console.log(`Only Used Free Credit:  ${freeGraders}`)
  console.log(`Didn't Use Free Credit: ${didntUse}`)
  console.log(`Founders/VIPs:          ${founders}`)
  console.log()

  // 6. Write CSV
  const header = 'Identifier,Email address,First name,Last name,User Status,Founder/VIP Status,Credits Purchased,Credits Used,Credits Balance,Paying Customer,Tags'
  const csvLines = rows.map(r =>
    [
      escapeCsv(r.identifier),
      escapeCsv(r.email),
      escapeCsv(r.first_name),
      escapeCsv(r.last_name),
      r.user_status,
      r.founder_vip_status,
      r.credits_purchased,
      r.credits_used,
      r.credits_balance,
      r.paying_customer,
      r.tags,
    ].join(',')
  )

  const csv = [header, ...csvLines].join('\n')
  const filename = `user-export-${new Date().toISOString().split('T')[0]}.csv`
  const outputPath = path.resolve(process.cwd(), filename)
  fs.writeFileSync(outputPath, csv, 'utf-8')

  console.log(`CSV exported to: ${outputPath}`)
  console.log(`Total rows: ${rows.length}`)
}

function escapeCsv(value: string): string {
  if (!value) return ''
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

exportUsers().catch(console.error)
