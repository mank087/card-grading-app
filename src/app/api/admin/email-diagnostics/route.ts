/**
 * Email System Diagnostics
 * Helps debug email sending issues
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminSession } from '@/lib/admin/adminAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Verify admin session
    const token = request.cookies.get('admin_token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await verifyAdminSession(token)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get email schedule stats with exact head counts (a plain select is
    // capped at 1000 rows, which under-reported the totals).
    const KNOWN_STATUSES = ['pending', 'sent', 'cancelled', 'failed', 'skipped'];
    const scheduleHead = () => supabase
      .from('email_schedule')
      .select('id', { count: 'exact', head: true })
      .eq('email_type', 'follow_up_24h');
    const [totalResult, ...statusResults] = await Promise.all([
      scheduleHead(),
      ...KNOWN_STATUSES.map(status => scheduleHead().eq('status', status)),
    ]);

    const scheduleError = totalResult.error || statusResults.find(r => r.error)?.error;
    if (scheduleError) {
      return NextResponse.json({ error: 'Failed to fetch email schedule', details: scheduleError }, { status: 500 });
    }

    // Count by status
    const scheduleTotal = totalResult.count || 0;
    const statusCounts: Record<string, number> = {};
    KNOWN_STATUSES.forEach((status, i) => {
      const c = statusResults[i].count || 0;
      if (c > 0) statusCounts[status] = c;
    });
    const otherCount = scheduleTotal - Object.values(statusCounts).reduce((a, b) => a + b, 0);
    if (otherCount > 0) statusCounts.other = otherCount;

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
      // Never return any part of the key itself.
      hasResendKey: !!process.env.RESEND_API_KEY,
      hasCronSecret: !!process.env.CRON_SECRET,
      baseUrl: process.env.NEXT_PUBLIC_BASE_URL,
      nodeEnv: process.env.NODE_ENV,
    };

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: envCheck,
      emailSchedule: {
        total: scheduleTotal,
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
