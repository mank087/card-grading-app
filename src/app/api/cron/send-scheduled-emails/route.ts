/**
 * Scheduled Email Cron Job
 * Runs every hour to send pending marketing emails
 *
 * Vercel Cron: Configured in vercel.json
 * Security: Validates CRON_SECRET header
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import {
  getPendingEmails,
  isUserSubscribed,
  getUnsubscribeToken,
  markEmailSent,
  markEmailFailed,
  markEmailSkipped,
  logEmailSend,
  ScheduledEmail
} from '@/lib/emailScheduler';
import { getFollowUp24hEmailHtml, getFollowUp24hEmailSubject } from '@/lib/emailTemplates';

const resend = new Resend(process.env.RESEND_API_KEY);

// Cron secret for security (set in Vercel environment variables)
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/send-scheduled-emails
 * Called by Vercel Cron every hour
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (Vercel sends this in Authorization header)
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      console.warn('[Cron] Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Cron] Starting scheduled email job...');

    // Get pending emails that are due
    const pendingEmails = await getPendingEmails(50);

    if (pendingEmails.length === 0) {
      console.log('[Cron] No pending emails to send');
      return NextResponse.json({
        success: true,
        message: 'No pending emails',
        processed: 0
      });
    }

    console.log(`[Cron] Found ${pendingEmails.length} pending emails`);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    // Process each pending email with rate limiting (Resend allows 2 req/sec)
    for (let i = 0; i < pendingEmails.length; i++) {
      const email = pendingEmails[i];
      try {
        const result = await processScheduledEmail(email);
        if (result === 'sent') sent++;
        else if (result === 'skipped') skipped++;
        else failed++;
      } catch (error: any) {
        console.error(`[Cron] Error processing email ${email.id}:`, error);
        await markEmailFailed(email.id, error.message);
        failed++;
      }

      // Rate limit: wait 600ms between sends to stay under 2 req/sec
      if (i < pendingEmails.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    }

    console.log(`[Cron] Job complete: ${sent} sent, ${skipped} skipped, ${failed} failed`);

    return NextResponse.json({
      success: true,
      processed: pendingEmails.length,
      sent,
      skipped,
      failed
    });

  } catch (error: any) {
    console.error('[Cron] Job failed:', error);
    return NextResponse.json(
      { error: 'Cron job failed', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * Process a single scheduled email
 */
async function processScheduledEmail(
  email: ScheduledEmail
): Promise<'sent' | 'skipped' | 'failed'> {
  // Check if user is still subscribed
  const isSubscribed = await isUserSubscribed(email.user_id);
  if (!isSubscribed) {
    console.log(`[Cron] User unsubscribed, skipping: ${email.user_email}`);
    await markEmailSkipped(email.id, 'User unsubscribed');
    return 'skipped';
  }

  // Get unsubscribe token for email footer
  const unsubscribeToken = await getUnsubscribeToken(email.user_id);
  if (!unsubscribeToken) {
    console.error(`[Cron] No unsubscribe token for: ${email.user_email}`);
    await markEmailFailed(email.id, 'Missing unsubscribe token');
    return 'failed';
  }

  // Build unsubscribe URL
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.dcmgrading.com';
  const unsubscribeUrl = `${baseUrl}/api/unsubscribe/${unsubscribeToken}`;

  // Get email content based on type
  let subject: string;
  let html: string;

  switch (email.email_type) {
    case 'follow_up_24h':
      subject = getFollowUp24hEmailSubject();
      html = getFollowUp24hEmailHtml(unsubscribeUrl);
      break;
    default:
      console.error(`[Cron] Unknown email type: ${email.email_type}`);
      await markEmailFailed(email.id, `Unknown email type: ${email.email_type}`);
      return 'failed';
  }

  // Send email via Resend
  const { data, error } = await resend.emails.send({
    from: 'DCM Grading <noreply@dcmgrading.com>',
    to: [email.user_email],
    subject: subject,
    html: html,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });

  if (error) {
    console.error(`[Cron] Resend error for ${email.user_email}:`, error);
    await markEmailFailed(email.id, error.message);
    await logEmailSend(
      email.user_id,
      email.user_email,
      email.email_type,
      subject,
      'failed',
      undefined,
      error.message
    );
    return 'failed';
  }

  console.log(`[Cron] Email sent to ${email.user_email}, ID: ${data?.id}`);
  await markEmailSent(email.id, data?.id);
  await logEmailSend(
    email.user_id,
    email.user_email,
    email.email_type,
    subject,
    'sent',
    data?.id
  );

  return 'sent';
}

// Also support POST for manual triggers (admin use)
export async function POST(request: NextRequest) {
  return GET(request);
}
