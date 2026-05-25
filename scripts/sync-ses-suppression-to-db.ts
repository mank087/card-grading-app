/**
 * Mirror AWS SES account-level suppression list into our internal DB
 * suppression flag (profiles.marketing_emails_enabled = false).
 *
 * Why: SES auto-suppresses hard bounces and complaints at the account
 * level, so future sends to those addresses are silently dropped by SES
 * regardless of what our DB says. But our audience query still INCLUDES
 * them, which means the next campaign tries to send to 4,000+ recipients
 * where some hundreds will be dropped at the SES gate. Pulls the actual
 * SES suppression list and mirrors it into profiles so the audience
 * shrinks to only addresses that will actually deliver.
 *
 * Safe to re-run any time after a send to keep the two in sync. Until
 * the SNS webhook auto-suppression is fixed, this script is the way to
 * close the loop after each campaign.
 *
 * Run: npx tsx scripts/sync-ses-suppression-to-db.ts
 */

import { SESv2Client, ListSuppressedDestinationsCommand } from '@aws-sdk/client-sesv2'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const SES_REGION = process.env.AWS_SES_REGION || 'us-east-1'
const SES_ACCESS_KEY_ID = process.env.AWS_SES_ACCESS_KEY_ID
const SES_SECRET_ACCESS_KEY = process.env.AWS_SES_SECRET_ACCESS_KEY

if (!SES_ACCESS_KEY_ID || !SES_SECRET_ACCESS_KEY) {
  console.error('Missing AWS_SES_ACCESS_KEY_ID / AWS_SES_SECRET_ACCESS_KEY in .env.local')
  process.exit(1)
}

const ses = new SESv2Client({
  region: SES_REGION,
  credentials: { accessKeyId: SES_ACCESS_KEY_ID, secretAccessKey: SES_SECRET_ACCESS_KEY },
})
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface SuppressedRow {
  email: string
  reason: 'BOUNCE' | 'COMPLAINT'
  lastUpdate: Date
}

async function fetchSuppressionList(): Promise<SuppressedRow[]> {
  const rows: SuppressedRow[] = []
  let nextToken: string | undefined
  do {
    const cmd = new ListSuppressedDestinationsCommand({
      PageSize: 1000,
      NextToken: nextToken,
    })
    const res = await ses.send(cmd)
    for (const s of res.SuppressedDestinationSummaries || []) {
      if (!s.EmailAddress) continue
      rows.push({
        email: s.EmailAddress.toLowerCase(),
        reason: (s.Reason as 'BOUNCE' | 'COMPLAINT') || 'BOUNCE',
        lastUpdate: s.LastUpdateTime || new Date(),
      })
    }
    nextToken = res.NextToken
  } while (nextToken)
  return rows
}

async function main() {
  console.log('Fetching SES account suppression list...')
  const suppressed = await fetchSuppressionList()
  console.log(`SES suppression list contains ${suppressed.length} address(es).\n`)

  if (suppressed.length === 0) {
    console.log('Nothing to mirror. Done.')
    return
  }

  // Group by reason for the summary
  const byReason: Record<string, number> = {}
  suppressed.forEach((r) => { byReason[r.reason] = (byReason[r.reason] || 0) + 1 })
  console.log('By reason:')
  Object.entries(byReason).forEach(([k, v]) => console.log(`  ${k.padEnd(12)} ${v}`))
  console.log('')

  const newlyMarked: string[] = []
  const alreadyMarked: string[] = []
  const notInDb: string[] = []
  const now = new Date().toISOString()

  let processed = 0
  for (const row of suppressed) {
    processed++
    if (processed % 50 === 0) {
      process.stdout.write(`  ...processed ${processed}/${suppressed.length}\r`)
    }
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .ilike('email', row.email)
      .maybeSingle()
    if (!user) {
      notInDb.push(row.email)
      continue
    }
    const { data: prof } = await supabase
      .from('profiles')
      .select('id, marketing_emails_enabled')
      .eq('id', user.id)
      .maybeSingle()
    if (prof && prof.marketing_emails_enabled === false) {
      alreadyMarked.push(row.email)
      continue
    }
    const { error: updErr } = await supabase
      .from('profiles')
      .update({
        marketing_emails_enabled: false,
        marketing_unsubscribed_at: now,
      })
      .eq('id', user.id)
    if (updErr) {
      console.warn(`\n  ! update error for ${row.email}: ${updErr.message}`)
      continue
    }
    newlyMarked.push(row.email)
  }
  console.log('\n')

  console.log(`Newly marked unsubscribed in DB: ${newlyMarked.length}`)
  if (newlyMarked.length > 0 && newlyMarked.length <= 30) {
    newlyMarked.forEach((e) => console.log(`  ${e}`))
  }
  console.log(`\nAlready marked unsubscribed: ${alreadyMarked.length}`)
  console.log(`\nNot in DB (was a bounce but the address isn't a registered DCM user): ${notInDb.length}`)
  if (notInDb.length > 0 && notInDb.length <= 30) {
    notInDb.forEach((e) => console.log(`  ${e}`))
  }
  console.log(`\nDone. Future audience queries will now exclude all ${newlyMarked.length + alreadyMarked.length} SES-suppressed users.`)
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1) })
