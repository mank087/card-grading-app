/**
 * Export Users for Email Advertising
 *
 * Run with: npx tsx scripts/export-users-email-list.ts
 *
 * Outputs a CSV file with:
 * - Email address
 * - Credits purchased (total_purchased)
 * - Credit balance (current)
 * - Paying customer (Yes/No)
 * - User status: "Paying Customer" | "Free Grader" | "Signed Up Only"
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

async function exportUsers() {
  console.log('\nFetching user data...\n')

  // 1. Get all users with emails
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, created_at')

  if (usersError) { console.error('Error fetching users:', usersError); return }
  if (!users || users.length === 0) { console.log('No users found.'); return }

  // 2. Get all credit records
  const { data: credits, error: creditsError } = await supabase
    .from('user_credits')
    .select('user_id, balance, total_purchased, total_used')

  if (creditsError) { console.error('Error fetching credits:', creditsError); return }

  // 3. Get grade transactions to identify who has graded
  const { data: gradeTransactions, error: txError } = await supabase
    .from('credit_transactions')
    .select('user_id, type')
    .in('type', ['grade', 'regrade'])

  if (txError) { console.error('Error fetching transactions:', txError); return }

  // Build lookup maps
  const creditsByUser = new Map<string, { balance: number; total_purchased: number; total_used: number }>()
  credits?.forEach(c => {
    creditsByUser.set(c.user_id, {
      balance: c.balance,
      total_purchased: c.total_purchased,
      total_used: c.total_used,
    })
  })

  const usersWhoGraded = new Set<string>()
  gradeTransactions?.forEach(tx => {
    usersWhoGraded.add(tx.user_id)
  })

  // 4. Build rows
  const rows: {
    email: string
    credits_purchased: number
    credit_balance: number
    paying_customer: string
    user_status: string
    signup_date: string
  }[] = []

  for (const user of users) {
    const credit = creditsByUser.get(user.id)
    const totalPurchased = credit?.total_purchased ?? 0
    const balance = credit?.balance ?? 0
    const hasGraded = usersWhoGraded.has(user.id)
    const isPaying = totalPurchased > 0

    let userStatus: string
    if (isPaying) {
      userStatus = 'Paying Customer'
    } else if (hasGraded) {
      userStatus = 'Free Grader'
    } else {
      userStatus = 'Signed Up Only'
    }

    rows.push({
      email: user.email,
      credits_purchased: totalPurchased,
      credit_balance: balance,
      paying_customer: isPaying ? 'Yes' : 'No',
      user_status: userStatus,
      signup_date: new Date(user.created_at).toISOString().split('T')[0],
    })
  }

  // Sort: paying customers first, then free graders, then signed up only
  const statusOrder: Record<string, number> = { 'Paying Customer': 0, 'Free Grader': 1, 'Signed Up Only': 2 }
  rows.sort((a, b) => statusOrder[a.user_status] - statusOrder[b.user_status])

  // 5. Summary
  const paying = rows.filter(r => r.user_status === 'Paying Customer').length
  const freeGraders = rows.filter(r => r.user_status === 'Free Grader').length
  const signedUpOnly = rows.filter(r => r.user_status === 'Signed Up Only').length

  console.log('--- USER SUMMARY ---')
  console.log(`Total users:       ${rows.length}`)
  console.log(`Paying Customers:  ${paying}`)
  console.log(`Free Graders:      ${freeGraders}`)
  console.log(`Signed Up Only:    ${signedUpOnly}`)
  console.log()

  // 6. Write CSV
  const header = 'Email,Credits Purchased,Credit Balance,Paying Customer,User Status,Signup Date'
  const csvLines = rows.map(r =>
    `${escapeCsv(r.email)},${r.credits_purchased},${r.credit_balance},${r.paying_customer},${r.user_status},${r.signup_date}`
  )

  const csv = [header, ...csvLines].join('\n')
  const filename = `user-export-${new Date().toISOString().split('T')[0]}.csv`
  const outputPath = path.resolve(process.cwd(), filename)
  fs.writeFileSync(outputPath, csv, 'utf-8')

  console.log(`CSV exported to: ${outputPath}`)
  console.log(`Total rows: ${rows.length}`)
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

exportUsers().catch(console.error)
