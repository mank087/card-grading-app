/**
 * Welcome Email Helper
 *
 * Idempotent welcome-email send. Used by both the legacy /api/email/welcome
 * endpoint (called from web auth callback) and the new auth-user-created
 * webhook (called by Supabase on every auth.users INSERT — covering mobile
 * and web alike).
 *
 * Idempotency: before sending, we check email_log for an existing successful
 * 'welcome' entry for this user_id. If found, skip — prevents duplicate sends
 * even if both code paths fire for the same user.
 */

import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logEmailSend } from '@/lib/emailScheduler'
import { getWelcomeEmailHtml } from '@/lib/welcomeEmailTemplate'

const resend = new Resend(process.env.RESEND_API_KEY)

const WELCOME_SUBJECT = 'Welcome to DCM Grading!'

export interface SendWelcomeResult {
  success: boolean
  sent: boolean // false if skipped (already sent)
  emailId?: string
  error?: string
}

/**
 * Returns true if a successful 'welcome' email is already logged for this
 * user. Used to short-circuit duplicate sends.
 */
async function alreadySent(userId: string | null, email: string): Promise<boolean> {
  if (!userId) {
    // No user_id provided — fall back to email lookup
    const { data } = await supabaseAdmin
      .from('email_log')
      .select('id')
      .eq('user_email', email)
      .eq('email_type', 'welcome')
      .eq('status', 'sent')
      .limit(1)
      .maybeSingle()
    return !!data
  }

  const { data } = await supabaseAdmin
    .from('email_log')
    .select('id')
    .eq('user_id', userId)
    .eq('email_type', 'welcome')
    .eq('status', 'sent')
    .limit(1)
    .maybeSingle()
  return !!data
}

export async function sendWelcomeEmail(params: {
  email: string
  userId?: string | null
  name?: string | null
}): Promise<SendWelcomeResult> {
  const { email, userId = null, name = null } = params

  if (!email) {
    return { success: false, sent: false, error: 'Email is required' }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  if (!emailRegex.test(email)) {
    return { success: false, sent: false, error: 'Invalid email format' }
  }

  if (await alreadySent(userId, email)) {
    console.log('[WelcomeEmail] Already sent for', email, '— skipping')
    return { success: true, sent: false }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'DCM Grading <admin@dcmgrading.com>',
      to: [email],
      subject: WELCOME_SUBJECT,
      html: getWelcomeEmailHtml({ name }),
    })

    if (error) {
      console.error('[WelcomeEmail] Resend error:', error)
      await logEmailSend(userId, email, 'welcome', WELCOME_SUBJECT, 'failed', undefined, error.message)
      return { success: false, sent: false, error: error.message }
    }

    await logEmailSend(userId, email, 'welcome', WELCOME_SUBJECT, 'sent', data?.id)
    console.log('[WelcomeEmail] Sent to', email, '— Resend ID:', data?.id)
    return { success: true, sent: true, emailId: data?.id }
  } catch (err: any) {
    console.error('[WelcomeEmail] Send threw:', err)
    await logEmailSend(userId, email, 'welcome', WELCOME_SUBJECT, 'failed', undefined, err?.message || 'unknown')
    return { success: false, sent: false, error: err?.message || 'unknown' }
  }
}
