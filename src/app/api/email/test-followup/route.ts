/**
 * Test Follow-Up Email API
 * Sends a test version of the 24-hour follow-up email
 *
 * For internal testing only - remove before production
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getFollowUp24hEmailHtml, getFollowUp24hEmailSubject } from '@/lib/emailTemplates';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Use a placeholder unsubscribe URL for testing
    const testUnsubscribeUrl = 'https://www.dcmgrading.com/unsubscribe?token=test-token-12345';

    const subject = getFollowUp24hEmailSubject();
    const html = getFollowUp24hEmailHtml(testUnsubscribeUrl);

    const { data, error } = await resend.emails.send({
      from: 'DCM Grading <noreply@dcmgrading.com>',
      to: [email],
      subject: `[TEST] ${subject}`,
      html: html,
      headers: {
        'List-Unsubscribe': `<${testUnsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });

    if (error) {
      console.error('[Test Email] Resend error:', error);
      return NextResponse.json({ error: 'Failed to send test email', details: error }, { status: 500 });
    }

    console.log('[Test Email] Sent successfully to:', email, 'ID:', data?.id);

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${email}`,
      emailId: data?.id
    });

  } catch (error: any) {
    console.error('[Test Email] Error:', error);
    return NextResponse.json({ error: 'Failed to send test email' }, { status: 500 });
  }
}
