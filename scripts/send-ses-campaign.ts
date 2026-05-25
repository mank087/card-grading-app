/**
 * Marketing campaign send script — uses AWS SES v2 with custom MAIL FROM.
 *
 * Reads an HTML template from emails/, pulls the opted-in audience from
 * Supabase (profiles.marketing_emails_enabled = true), renders per-recipient
 * merge tags, and sends via SES at a controlled rate. Logs every send to a
 * resumable CSV so a crash mid-campaign doesn't double-send when restarted.
 *
 * Usage:
 *   npx tsx scripts/send-ses-campaign.ts --template emails/app-launch-ios-android.html \
 *     --subject "DCM Grading is now on iPhone & Android" \
 *     --from "DCM Grading <news@dcmgrading.com>" \
 *     --reply-to admin@dcmgrading.com \
 *     [--dry-run]                  # render + log but do not call SES
 *     [--limit N]                  # cap at N recipients (use with --dry-run for testing)
 *     [--to email@example.com]     # send to only one address (must be in audience or verified)
 *     [--rate 5]                   # sends per second (default 5; sandbox cap is 1, prod is 14)
 *     [--campaign app-launch-may2026]  # log file slug; defaults to template filename
 *
 * Resumability: every attempt is appended to logs/<campaign>-sent.csv with
 * status (sent|failed|skipped). On startup the script reads that file and
 * skips any email that was already successfully sent. To force re-send,
 * delete or rename the log file.
 *
 * The unsubscribe URL uses the existing profiles.unsubscribe_token column
 * and the existing /api/unsubscribe/[token] endpoint, so this script
 * integrates with the same suppression flow used for transactional mail.
 */

import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

// ---------- Argument parsing ----------

const args = process.argv.slice(2)
function getArg(name: string): string | undefined {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
function getFlag(name: string): boolean {
  return args.includes(`--${name}`)
}

const templatePath = getArg('template')
const subject = getArg('subject')
const fromAddr = getArg('from')
const replyTo = getArg('reply-to') || 'admin@dcmgrading.com'
const dryRun = getFlag('dry-run')
const testMode = getFlag('test')
const limit = Number(getArg('limit')) || undefined
const sendOnlyTo = getArg('to')
const rate = Number(getArg('rate')) || 5
const campaignSlug = getArg('campaign') ||
  (templatePath ? path.basename(templatePath, path.extname(templatePath)) : 'campaign')

if (!templatePath || !subject || !fromAddr) {
  console.error('Missing required args. See header comment for usage.')
  process.exit(1)
}

// ---------- Setup ----------

const SES_REGION = process.env.AWS_SES_REGION || 'us-east-1'
const SES_ACCESS_KEY_ID = process.env.AWS_SES_ACCESS_KEY_ID
const SES_SECRET_ACCESS_KEY = process.env.AWS_SES_SECRET_ACCESS_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SITE_URL = 'https://dcmgrading.com'

if (!SES_ACCESS_KEY_ID || !SES_SECRET_ACCESS_KEY) {
  console.error('Missing AWS_SES_ACCESS_KEY_ID / AWS_SES_SECRET_ACCESS_KEY in .env.local')
  process.exit(1)
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const ses = new SESv2Client({
  region: SES_REGION,
  credentials: { accessKeyId: SES_ACCESS_KEY_ID, secretAccessKey: SES_SECRET_ACCESS_KEY },
})
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ---------- Audience query ----------

interface Recipient {
  user_id: string
  email: string
  first_name: string
  unsubscribe_token: string
}

async function loadAudience(): Promise<Recipient[]> {
  // Paginate over profiles where marketing is opted-in, joined with users for
  // the email + first name. Bypass the 1000-row PostgREST cap by ranging.
  const recipients: Recipient[] = []
  const batchSize = 1000
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, unsubscribe_token, marketing_emails_enabled, users!inner(email, full_name)')
      .eq('marketing_emails_enabled', true)
      .range(from, from + batchSize - 1)
    if (error) throw new Error(`profiles query failed: ${error.message}`)
    if (!data || data.length === 0) break
    for (const row of data as any[]) {
      const email = row.users?.email || row.email
      if (!email) continue
      const fullName = row.users?.full_name || ''
      const firstName = fullName.split(' ')[0] || 'there'
      recipients.push({
        user_id: row.id,
        email,
        first_name: firstName,
        unsubscribe_token: row.unsubscribe_token,
      })
    }
    if (data.length < batchSize) break
    from += batchSize
  }
  return recipients
}

// ---------- Log file (resumability) ----------

const logDir = path.join(process.cwd(), 'logs')
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
const logPath = path.join(logDir, `${campaignSlug}-sent.csv`)

async function loadAlreadySent(): Promise<Set<string>> {
  const sent = new Set<string>()
  if (!fs.existsSync(logPath)) return sent
  const rl = readline.createInterface({
    input: fs.createReadStream(logPath),
    crlfDelay: Infinity,
  })
  for await (const line of rl) {
    const [ts, email, status] = line.split(',')
    if (status === 'sent') sent.add(email)
  }
  return sent
}

function logSend(email: string, status: 'sent' | 'failed' | 'skipped', detail: string) {
  const line = `${new Date().toISOString()},${email},${status},"${detail.replace(/"/g, '""')}"\n`
  fs.appendFileSync(logPath, line)
}

// ---------- Template rendering ----------

function render(html: string, recipient: Recipient): string {
  const unsubscribeUrl = `${SITE_URL}/api/unsubscribe/${recipient.unsubscribe_token}`
  return html
    .replace(/\{\{\s*firstName\s*\}\}/g, escapeHtml(recipient.first_name))
    .replace(/\{\{\s*unsubscribeUrl\s*\}\}/g, unsubscribeUrl)
    .replace(/\{\{\s*email\s*\}\}/g, escapeHtml(recipient.email))
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ---------- Send loop ----------

async function sendOne(recipient: Recipient, html: string): Promise<void> {
  const body = render(html, recipient)
  const unsubscribeUrl = `${SITE_URL}/api/unsubscribe/${recipient.unsubscribe_token}`

  if (dryRun) {
    logSend(recipient.email, 'skipped', 'dry-run')
    return
  }

  await ses.send(new SendEmailCommand({
    FromEmailAddress: fromAddr,
    ReplyToAddresses: [replyTo],
    Destination: { ToAddresses: [recipient.email] },
    // Gmail/Yahoo bulk sender requirement: One-Click List-Unsubscribe
    // RFC 8058 — POST to the URL = immediate unsubscribe, handled by
    // existing /api/unsubscribe/[token] route.ts POST handler.
    Content: {
      Simple: {
        Subject: { Data: subject!, Charset: 'UTF-8' },
        Body: { Html: { Data: body, Charset: 'UTF-8' } },
        Headers: [
          { Name: 'List-Unsubscribe', Value: `<${unsubscribeUrl}>` },
          { Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' },
        ],
      },
    },
  }))
}

async function main() {
  const html = fs.readFileSync(templatePath!, 'utf8')

  // --test bypasses the audience query entirely and sends to whatever --to
  // is specified. Use for smoke tests where the test recipient is not a
  // registered DCM user (e.g. admin@dcmgrading.com). The unsubscribe link
  // will use a synthetic token that resolves to "invalid" on click, which
  // is the right behavior for a non-real recipient.
  let audience: Recipient[]
  if (testMode) {
    if (!sendOnlyTo) {
      console.error('--test requires --to <email> to specify the test recipient.')
      process.exit(1)
    }
    audience = [{
      user_id: 'test',
      email: sendOnlyTo,
      first_name: 'there',
      unsubscribe_token: 'SMOKE_TEST_TOKEN_NOT_REAL_USED_FOR_RENDERING_CHECK_ONLY_' + Date.now(),
    }]
    console.log(`TEST MODE: sending one email to ${sendOnlyTo} (audience query skipped)`)
  } else {
    audience = await loadAudience()
    console.log(`Audience: ${audience.length} opted-in recipients`)

    if (sendOnlyTo) {
      audience = audience.filter(r => r.email.toLowerCase() === sendOnlyTo.toLowerCase())
      if (audience.length === 0) {
        console.error(`--to ${sendOnlyTo} did not match any opted-in profile. Aborting.`)
        console.error(`To send to a non-audience recipient (e.g. for smoke testing), add --test.`)
        process.exit(1)
      }
      console.log(`Filtered to single recipient: ${audience[0].email}`)
    }
  }

  const alreadySent = await loadAlreadySent()
  if (alreadySent.size > 0) {
    console.log(`Resuming: ${alreadySent.size} previously-sent emails will be skipped`)
  }
  audience = audience.filter(r => !alreadySent.has(r.email))

  if (limit && audience.length > limit) {
    audience = audience.slice(0, limit)
    console.log(`--limit ${limit} applied; ${audience.length} recipients will be processed`)
  }

  console.log(`Sending ${audience.length} emails ${dryRun ? '(DRY RUN)' : 'at ' + rate + '/sec'}`)
  console.log(`Log file: ${logPath}`)

  const delayMs = Math.ceil(1000 / rate)
  let success = 0
  let failed = 0

  for (let i = 0; i < audience.length; i++) {
    const r = audience[i]
    try {
      await sendOne(r, html)
      if (!dryRun) logSend(r.email, 'sent', `index=${i + 1}`)
      success++
      if ((i + 1) % 100 === 0 || i === audience.length - 1) {
        console.log(`  [${i + 1}/${audience.length}] ✓ ${r.email} (${success} sent, ${failed} failed)`)
      }
    } catch (err: any) {
      failed++
      const msg = err?.message || String(err)
      logSend(r.email, 'failed', msg)
      console.warn(`  [${i + 1}/${audience.length}] ✗ ${r.email}: ${msg}`)
    }
    if (i < audience.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  console.log(`\nDone. ${success} sent, ${failed} failed. Log: ${logPath}`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
