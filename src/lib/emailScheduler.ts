/**
 * Email Scheduler Utility
 * Handles scheduling and sending marketing emails
 */

import { supabaseAdmin } from '@/lib/supabaseAdmin';

export interface ScheduledEmail {
  id: string;
  user_id: string;
  user_email: string;
  email_type: string;
  scheduled_for: string;
  status: string;
}

export interface EmailSendResult {
  success: boolean;
  emailId?: string;
  error?: string;
}

/**
 * Schedule a follow-up email for a user
 * Called when a new user signs up
 */
export async function scheduleFollowUpEmail(
  userId: string,
  userEmail: string,
  delayHours: number = 24
): Promise<{ success: boolean; scheduleId?: string; error?: string }> {
  try {
    const scheduledFor = new Date();
    scheduledFor.setHours(scheduledFor.getHours() + delayHours);

    const { data, error } = await supabaseAdmin
      .from('email_schedule')
      .insert({
        user_id: userId,
        user_email: userEmail,
        email_type: 'follow_up_24h',
        scheduled_for: scheduledFor.toISOString(),
        status: 'pending'
      })
      .select('id')
      .single();

    if (error) {
      // Check if it's a duplicate (user already has pending email)
      if (error.code === '23505') {
        console.log('[EmailScheduler] Follow-up already scheduled for:', userEmail);
        return { success: true, error: 'Already scheduled' };
      }
      throw error;
    }

    console.log('[EmailScheduler] Scheduled follow-up for:', userEmail, 'at:', scheduledFor.toISOString());
    return { success: true, scheduleId: data?.id };

  } catch (error: any) {
    console.error('[EmailScheduler] Error scheduling email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get pending emails that are due to be sent
 */
export async function getPendingEmails(limit: number = 50): Promise<ScheduledEmail[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('email_schedule')
      .select('id, user_id, user_email, email_type, scheduled_for, status')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error: any) {
    console.error('[EmailScheduler] Error fetching pending emails:', error);
    return [];
  }
}

/**
 * Check if user is still subscribed to marketing emails
 */
export async function isUserSubscribed(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('marketing_emails_enabled')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return false;
    }

    return data.marketing_emails_enabled === true;
  } catch (error) {
    console.error('[EmailScheduler] Error checking subscription:', error);
    return false;
  }
}

/**
 * Get user's unsubscribe token
 */
export async function getUnsubscribeToken(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('unsubscribe_token')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return data.unsubscribe_token;
  } catch (error) {
    console.error('[EmailScheduler] Error getting unsubscribe token:', error);
    return null;
  }
}

/**
 * Mark an email as sent
 */
export async function markEmailSent(
  scheduleId: string,
  resendEmailId?: string
): Promise<void> {
  try {
    await supabaseAdmin
      .from('email_schedule')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        resend_email_id: resendEmailId || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', scheduleId);
  } catch (error) {
    console.error('[EmailScheduler] Error marking email sent:', error);
  }
}

/**
 * Mark an email as failed
 */
export async function markEmailFailed(
  scheduleId: string,
  errorMessage: string
): Promise<void> {
  try {
    await supabaseAdmin
      .from('email_schedule')
      .update({
        status: 'failed',
        error_message: errorMessage,
        updated_at: new Date().toISOString()
      })
      .eq('id', scheduleId);
  } catch (error) {
    console.error('[EmailScheduler] Error marking email failed:', error);
  }
}

/**
 * Mark an email as skipped (user unsubscribed)
 */
export async function markEmailSkipped(
  scheduleId: string,
  reason: string
): Promise<void> {
  try {
    await supabaseAdmin
      .from('email_schedule')
      .update({
        status: 'skipped',
        error_message: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', scheduleId);
  } catch (error) {
    console.error('[EmailScheduler] Error marking email skipped:', error);
  }
}

/**
 * Log an email send (for analytics)
 */
export async function logEmailSend(
  userId: string | null,
  userEmail: string,
  emailType: string,
  subject: string,
  status: 'sent' | 'failed' | 'bounced' | 'complained',
  resendEmailId?: string,
  errorMessage?: string
): Promise<void> {
  try {
    await supabaseAdmin
      .from('email_log')
      .insert({
        user_id: userId,
        user_email: userEmail,
        email_type: emailType,
        subject: subject,
        status: status,
        resend_email_id: resendEmailId || null,
        error_message: errorMessage || null
      });
  } catch (error) {
    console.error('[EmailScheduler] Error logging email:', error);
  }
}
