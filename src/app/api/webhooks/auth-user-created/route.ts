/**
 * Supabase Database Webhook — fired on every auth.users INSERT.
 *
 * This is the canonical entry point for welcome-email sends. It runs once
 * per new user regardless of signup path (web email/password, web OAuth,
 * mobile email/password, mobile Apple/Google/Facebook native SDK, admin-
 * created accounts, etc.).
 *
 * Setup (one-time, in Supabase Dashboard):
 *   Database -> Webhooks -> Create a new webhook
 *     Name: auth-user-created
 *     Table: auth.users
 *     Events: Insert
 *     URL: https://dcmgrading.com/api/webhooks/auth-user-created
 *     HTTP Method: POST
 *     HTTP Headers:
 *       Authorization: Bearer <SUPABASE_WEBHOOK_SECRET>
 *
 * The same secret must be set as `SUPABASE_WEBHOOK_SECRET` in Vercel env
 * variables for the production deployment.
 *
 * Idempotency: sendWelcomeEmail checks email_log for an existing successful
 * 'welcome' entry, so retried webhooks won't produce duplicate emails. The
 * legacy /api/email/welcome endpoint shares the same helper and check, so
 * web auth callback can keep calling it without risk of double sends.
 *
 * Supabase webhook payload shape (INSERT event):
 *   {
 *     type: 'INSERT',
 *     table: 'users',
 *     schema: 'auth',
 *     record: { id, email, raw_user_meta_data, ... },
 *     old_record: null
 *   }
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendWelcomeEmail } from '@/lib/welcomeEmail'

const WEBHOOK_SECRET = process.env.SUPABASE_WEBHOOK_SECRET

export async function POST(request: NextRequest) {
  if (!WEBHOOK_SECRET) {
    console.error('[auth-user-created] SUPABASE_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
    console.warn('[auth-user-created] Unauthorized webhook call')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: any
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (payload?.type !== 'INSERT' || payload?.table !== 'users') {
    // Ignore non-INSERT events (UPDATE/DELETE). Supabase shouldn't fire
    // these if the webhook is configured for INSERT only, but defensive
    // ignore in case of misconfiguration.
    return NextResponse.json({ skipped: true, reason: 'not an INSERT on users' })
  }

  const record = payload?.record
  if (!record?.id || !record?.email) {
    // OAuth providers occasionally create user rows without an email
    // (Facebook when the user denies email permission; some Apple
    // private-relay edge cases). Log and skip — we can't email them.
    console.warn('[auth-user-created] Missing id or email in payload', { id: record?.id, email: record?.email })
    return NextResponse.json({ skipped: true, reason: 'missing id or email' })
  }

  const name =
    record.raw_user_meta_data?.full_name ||
    record.raw_user_meta_data?.name ||
    null

  const result = await sendWelcomeEmail({
    email: record.email,
    userId: record.id,
    name,
  })

  if (!result.success) {
    console.error('[auth-user-created] Send failed:', result.error)
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ success: true, sent: result.sent })
}
