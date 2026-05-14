/**
 * Welcome Email API — legacy endpoint
 *
 * Originally called from the web auth callback page. Still functional, but
 * the canonical trigger for welcome emails is now the auth-user-created
 * webhook (fired by Supabase on every auth.users INSERT — covering web,
 * mobile, and any future signup path). Both endpoints share the same
 * idempotent helper, so calling this endpoint after the webhook already
 * fired is safe — the second call is a no-op.
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendWelcomeEmail } from '@/lib/welcomeEmail'
import { scheduleFollowUpEmail } from '@/lib/emailScheduler'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, userId, name } = body

    const result = await sendWelcomeEmail({ email, userId, name })

    if (!result.success) {
      const status = result.error === 'Email is required' || result.error === 'Invalid email format' ? 400 : 500
      return NextResponse.json({ error: result.error || 'Failed to send welcome email' }, { status })
    }

    // The DB trigger schedules the 24h follow-up automatically when auth.users
    // is inserted, so this call is normally redundant. We keep it for legacy
    // safety — the unique constraint on (user_id, email_type) WHERE status='pending'
    // makes it a no-op if already scheduled.
    if (userId) {
      await scheduleFollowUpEmail(userId, email, 24)
    }

    return NextResponse.json({
      success: true,
      sent: result.sent,
      message: result.sent ? 'Welcome email sent' : 'Welcome email already sent (skipped)',
    })
  } catch (error: any) {
    console.error('[Welcome Email Route] Error:', error)
    return NextResponse.json({ error: 'Failed to send welcome email' }, { status: 500 })
  }
}
