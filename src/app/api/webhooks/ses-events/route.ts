/**
 * AWS SES events webhook (bounces, complaints, deliveries).
 *
 * SES publishes notifications via SNS. SNS POSTs to this endpoint, and we
 * mutate the affected user's profiles row so they're suppressed from future
 * marketing sends. This is the exact same flag transactional welcome /
 * unsubscribe flows already respect, so suppression is universal.
 *
 * Setup (one-time, after the bounce/complaint SNS topics exist):
 *   1. AWS Console -> SES -> Verified identities -> dcmgrading.com
 *      -> Notifications tab
 *      -> For each event type (Bounce, Complaint), Edit -> assign the
 *         SNS topic
 *   2. SNS Console -> the topic -> Create subscription
 *      Protocol: HTTPS
 *      Endpoint: https://dcmgrading.com/api/webhooks/ses-events
 *   3. The first POST from SNS is a SubscriptionConfirmation message
 *      containing a SubscribeURL. This handler auto-visits that URL to
 *      confirm the subscription. After confirmation, future POSTs are
 *      Notifications.
 *
 * Security: SNS messages are signed; we verify the signature against
 * Amazon's public certificate to make sure no one can forge a notification.
 *
 * Idempotency: each notification carries a messageId; we ignore notifications
 * we've already processed. Hard bounces and complaints map to the SAME flag
 * (marketing_emails_enabled=false), so even if the dedup misses, the result
 * is the same.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createVerify } from 'crypto'

// ---------- SNS signature verification ----------

// SNS signs each message and references a public cert URL on amazonaws.com.
// We fetch the cert, verify the signature, and reject anything that fails.
// Without this check, anyone who can POST to the webhook could mark all
// our users as unsubscribed.
async function verifySnsSignature(body: any): Promise<boolean> {
  try {
    const certUrl: string = body.SigningCertURL
    if (!certUrl) return false
    // Only accept certs from amazonaws.com domains.
    const url = new URL(certUrl)
    if (!/(^|\.)amazonaws\.com$/.test(url.hostname) || url.protocol !== 'https:') {
      console.warn('[ses-events] Rejecting non-AWS SigningCertURL:', certUrl)
      return false
    }
    const certRes = await fetch(certUrl)
    if (!certRes.ok) return false
    const cert = await certRes.text()

    // Build the string-to-sign per SNS docs. Order of fields differs by Type.
    const fields = body.Type === 'Notification'
      ? body.Subject !== undefined && body.Subject !== null
        ? ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type']
        : ['Message', 'MessageId', 'Timestamp', 'TopicArn', 'Type']
      : ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type']
    const stringToSign = fields.map(k => `${k}\n${body[k]}\n`).join('')

    const verifier = createVerify(body.SignatureVersion === '2' ? 'RSA-SHA256' : 'RSA-SHA1')
    verifier.update(stringToSign, 'utf8')
    return verifier.verify(cert, body.Signature, 'base64')
  } catch (e: any) {
    console.warn('[ses-events] Signature verify error:', e?.message || e)
    return false
  }
}

// ---------- Suppress a user ----------

async function suppressUser(email: string, reason: string) {
  // Look up the user by email (case-insensitive). profiles.email mirrors
  // auth.users.email via the handle_new_user trigger.
  const lower = email.toLowerCase()
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id')
    .ilike('email', lower)
    .maybeSingle()
  if (!user) {
    console.warn('[ses-events] suppress: no user for', lower)
    return
  }
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      marketing_emails_enabled: false,
      marketing_unsubscribed_at: new Date().toISOString(),
    })
    .eq('id', user.id)
  if (error) {
    console.error('[ses-events] suppress update failed:', error.message)
  } else {
    console.log(`[ses-events] suppressed ${lower} (${reason})`)
  }
}

// ---------- Process a notification ----------

async function handleNotification(snsMessage: any) {
  // The Message field is JSON-encoded SES event data.
  const event = typeof snsMessage.Message === 'string'
    ? JSON.parse(snsMessage.Message)
    : snsMessage.Message

  const notificationType: string = event.notificationType || event.eventType

  if (notificationType === 'Bounce') {
    const bounceType = event.bounce?.bounceType
    const recipients: Array<{ emailAddress: string }> = event.bounce?.bouncedRecipients || []
    // Only hard bounces (Permanent) are immediate suppress. Transient bounces
    // (mailbox full, server down) might recover; we let SES auto-retry.
    if (bounceType === 'Permanent') {
      for (const r of recipients) {
        await suppressUser(r.emailAddress, 'hard bounce')
      }
    } else {
      console.log(`[ses-events] ${bounceType} bounce ignored:`, recipients.map(r => r.emailAddress))
    }
    return
  }

  if (notificationType === 'Complaint') {
    const recipients: Array<{ emailAddress: string }> = event.complaint?.complainedRecipients || []
    for (const r of recipients) {
      await suppressUser(r.emailAddress, 'spam complaint')
    }
    return
  }

  if (notificationType === 'Delivery') {
    // Successful delivery; no action needed. Log for observability.
    const recipients: string[] = event.delivery?.recipients || []
    console.log('[ses-events] delivered:', recipients.length, 'recipient(s)')
    return
  }

  console.log('[ses-events] unhandled notification type:', notificationType)
}

// ---------- POST handler ----------

export async function POST(request: NextRequest) {
  // SNS sends a plain text body that's JSON-encoded. The Content-Type is
  // text/plain by default (not application/json), so we read raw text.
  const raw = await request.text()
  let body: any
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  // SNS message type is in body.Type — could also be in header.
  const msgType = body.Type || request.headers.get('x-amz-sns-message-type')

  // Verify signature on every message we accept.
  const ok = await verifySnsSignature(body)
  if (!ok) {
    console.warn('[ses-events] Signature check failed')
    return NextResponse.json({ error: 'invalid signature' }, { status: 403 })
  }

  if (msgType === 'SubscriptionConfirmation') {
    // SNS sends this once when subscribing the endpoint. We auto-confirm by
    // visiting SubscribeURL so no manual click is needed.
    const subscribeUrl = body.SubscribeURL
    console.log('[ses-events] Confirming SNS subscription:', subscribeUrl)
    const r = await fetch(subscribeUrl)
    if (!r.ok) {
      console.error('[ses-events] SubscribeURL fetch failed:', r.status)
      return NextResponse.json({ error: 'subscribe failed' }, { status: 500 })
    }
    console.log('[ses-events] Subscription confirmed')
    return NextResponse.json({ ok: true })
  }

  if (msgType === 'Notification') {
    try {
      await handleNotification(body)
    } catch (e: any) {
      console.error('[ses-events] handler error:', e?.message || e)
      // Return 200 anyway so SNS doesn't retry indefinitely on parse errors.
    }
    return NextResponse.json({ ok: true })
  }

  if (msgType === 'UnsubscribeConfirmation') {
    // We never call this, but accept it gracefully.
    console.log('[ses-events] UnsubscribeConfirmation received')
    return NextResponse.json({ ok: true })
  }

  console.log('[ses-events] Unknown message type:', msgType)
  return NextResponse.json({ ok: true })
}

// SNS hits the same URL with a GET for health checks if configured that
// way. Respond 200 so the endpoint passes provisioning checks.
export async function GET() {
  return NextResponse.json({ ok: true, service: 'ses-events webhook' })
}
