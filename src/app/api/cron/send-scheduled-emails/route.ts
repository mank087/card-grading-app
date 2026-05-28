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
  hasPurchased,
  ScheduledEmail
} from '@/lib/emailScheduler';
import { getFollowUp24hEmailHtml, getFollowUp24hEmailSubject } from '@/lib/emailTemplates';
import {
  getFirstGradeEducationHtml,
  getFirstGradeEducationSubject,
  getSocialProofEmailHtml,
  getSocialProofEmailSubject,
  getLastChanceEmailHtml,
  getLastChanceEmailSubject,
  getWinbackEmailHtml,
  getWinbackEmailSubject,
  categoryToRouteSlug,
} from '@/lib/postGradeEmailTemplates';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://dcmgrading.com';
  const unsubscribeUrl = `${baseUrl}/api/unsubscribe/${unsubscribeToken}`;

  // Audience filter for post-grade series: skip if user has already purchased.
  // Cheaper to check once here than to send an email the user doesn't need.
  const isPostGradeType = email.email_type.startsWith('first_grade_') || email.email_type === 'winback';
  if (isPostGradeType) {
    const purchased = await hasPurchased(email.user_id);
    if (purchased) {
      console.log(`[Cron] Skipping ${email.email_type} for ${email.user_email} (already purchased)`);
      await markEmailSkipped(email.id, 'User already purchased');
      return 'skipped';
    }
  }

  // Get email content based on type
  let subject: string;
  let html: string;

  switch (email.email_type) {
    case 'follow_up_24h':
      subject = getFollowUp24hEmailSubject();
      html = getFollowUp24hEmailHtml(unsubscribeUrl);
      break;
    case 'first_grade_education': {
      const cardData = await fetchUserFirstGradedCard(email.user_id);
      if (!cardData) {
        console.warn(`[Cron] No graded card found for ${email.user_email} — skipping education email`);
        await markEmailSkipped(email.id, 'No graded card found');
        return 'skipped';
      }
      const balance = await fetchUserCreditBalance(email.user_id);
      subject = getFirstGradeEducationSubject();
      html = getFirstGradeEducationHtml({
        front_image_url: cardData.front_image_url,
        card_name: cardData.card_name,
        final_grade: cardData.final_grade,
        category_slug: categoryToRouteSlug(cardData.category),
        card_id: cardData.card_id,
        centering_score: cardData.centering,
        corners_score: cardData.corners,
        edges_score: cardData.edges,
        surface_score: cardData.surface,
        credits_remaining: balance,
        unsubscribe_url: unsubscribeUrl,
      });
      break;
    }
    case 'first_grade_social_proof':
      subject = getSocialProofEmailSubject();
      html = getSocialProofEmailHtml({ unsubscribe_url: unsubscribeUrl });
      break;
    case 'first_grade_last_chance':
      subject = getLastChanceEmailSubject();
      html = getLastChanceEmailHtml({ unsubscribe_url: unsubscribeUrl });
      break;
    case 'winback': {
      const cardData = await fetchUserFirstGradedCard(email.user_id);
      if (!cardData) {
        console.warn(`[Cron] No graded card found for ${email.user_email} — skipping winback`);
        await markEmailSkipped(email.id, 'No graded card found');
        return 'skipped';
      }
      subject = getWinbackEmailSubject();
      html = getWinbackEmailHtml({
        front_image_url: cardData.front_image_url,
        card_name: cardData.card_name,
        final_grade: cardData.final_grade,
        unsubscribe_url: unsubscribeUrl,
      });
      break;
    }
    default:
      console.error(`[Cron] Unknown email type: ${email.email_type}`);
      await markEmailFailed(email.id, `Unknown email type: ${email.email_type}`);
      return 'failed';
  }

  // Send email via Resend
  const { data, error } = await resend.emails.send({
    from: 'DCM Grading <admin@dcmgrading.com>',
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

// ============================================================================
// PERSONALIZATION HELPERS
// Used by post-grade email types to fetch the user's first graded card and
// generate a signed Supabase Storage URL for the card image in the email.
// ============================================================================

interface FirstGradedCard {
  card_id: string;
  card_name: string;
  category: string;
  front_image_url: string;
  final_grade: number | string;
  centering: number | string;
  corners: number | string;
  edges: number | string;
  surface: number | string;
}

async function fetchUserFirstGradedCard(userId: string): Promise<FirstGradedCard | null> {
  try {
    const { data: card, error } = await supabaseAdmin
      .from('cards')
      .select('id, card_name, category, front_path, conversational_whole_grade, conversational_sub_scores')
      .eq('user_id', userId)
      .not('conversational_whole_grade', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !card) {
      console.warn('[Cron] fetchUserFirstGradedCard found nothing for', userId, error?.message);
      return null;
    }

    // Generate a 7-day signed URL for the front image so it's loadable
    // when the user opens the email (Gmail/Apple Mail proxy + cache too).
    let frontImageUrl = '';
    if (card.front_path) {
      const { data: signed } = await supabaseAdmin.storage
        .from('cards')
        .createSignedUrl(card.front_path, 60 * 60 * 24 * 7);
      frontImageUrl = signed?.signedUrl || '';
    }
    if (!frontImageUrl) {
      console.warn('[Cron] No signed URL for card', card.id);
      return null;
    }

    const subs = (card.conversational_sub_scores ?? {}) as Record<string, { weighted?: number }>;
    return {
      card_id: card.id,
      card_name: card.card_name || 'Your card',
      category: card.category || 'Other',
      front_image_url: frontImageUrl,
      final_grade: card.conversational_whole_grade ?? '?',
      centering: subs.centering?.weighted ?? '?',
      corners: subs.corners?.weighted ?? '?',
      edges: subs.edges?.weighted ?? '?',
      surface: subs.surface?.weighted ?? '?',
    };
  } catch (err) {
    console.error('[Cron] fetchUserFirstGradedCard error:', err);
    return null;
  }
}

async function fetchUserCreditBalance(userId: string): Promise<number> {
  try {
    const { data } = await supabaseAdmin
      .from('user_credits')
      .select('balance')
      .eq('user_id', userId)
      .single();
    return data?.balance ?? 0;
  } catch {
    return 0;
  }
}
