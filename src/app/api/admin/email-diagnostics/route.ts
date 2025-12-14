/**
 * Email System Diagnostics
 * Helps debug email sending issues
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Get email schedule stats
    const { data: scheduleStats, error: scheduleError } = await supabase
      .from('email_schedule')
      .select('status, email_type')
      .eq('email_type', 'follow_up_24h');

    if (scheduleError) {
      return NextResponse.json({ error: 'Failed to fetch email schedule', details: scheduleError }, { status: 500 });
    }

    // Count by status
    const statusCounts: Record<string, number> = {};
    scheduleStats?.forEach(email => {
      statusCounts[email.status] = (statusCounts[email.status] || 0) + 1;
    });

    // Get sample of sent emails with their resend IDs
    const { data: sentEmails, error: sentError } = await supabase
      .from('email_schedule')
      .select('id, user_email, status, sent_at, resend_email_id, created_at')
      .eq('status', 'sent')
      .eq('email_type', 'follow_up_24h')
      .order('sent_at', { ascending: false })
      .limit(10);

    // Get pending emails
    const { data: pendingEmails, error: pendingError } = await supabase
      .from('email_schedule')
      .select('id, user_email, scheduled_for, status')
      .eq('status', 'pending')
      .eq('email_type', 'follow_up_24h')
      .order('scheduled_for', { ascending: true })
      .limit(10);

    // Get failed emails
    const { data: failedEmails, error: failedError } = await supabase
      .from('email_schedule')
      .select('id, user_email, error_message, updated_at')
      .eq('status', 'failed')
      .eq('email_type', 'follow_up_24h')
      .limit(10);

    // Check email log table
    const { data: emailLogs, error: logsError } = await supabase
      .from('email_log')
      .select('id, user_email, email_type, status, resend_email_id, created_at')
      .eq('email_type', 'follow_up_24h')
      .order('created_at', { ascending: false })
      .limit(10);

    // Check environment
    const envCheck = {
      hasResendKey: !!process.env.RESEND_API_KEY,
      resendKeyPrefix: process.env.RESEND_API_KEY?.substring(0, 10) + '...',
      hasCronSecret: !!process.env.CRON_SECRET,
      baseUrl: process.env.NEXT_PUBLIC_BASE_URL,
      nodeEnv: process.env.NODE_ENV,
    };

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: envCheck,
      emailSchedule: {
        total: scheduleStats?.length || 0,
        byStatus: statusCounts,
      },
      recentSentEmails: sentEmails?.map(e => ({
        ...e,
        user_email: e.user_email?.replace(/(.{2}).*@/, '$1***@') // Mask email
      })),
      pendingEmails: pendingEmails?.map(e => ({
        ...e,
        user_email: e.user_email?.replace(/(.{2}).*@/, '$1***@')
      })),
      failedEmails: failedEmails?.map(e => ({
        ...e,
        user_email: e.user_email?.replace(/(.{2}).*@/, '$1***@')
      })),
      emailLogs: emailLogs?.map(e => ({
        ...e,
        user_email: e.user_email?.replace(/(.{2}).*@/, '$1***@')
      })),
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
