/**
 * Contact Form API
 * Sends contact form submissions via email using Resend
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, subject, message } = body;

    // Validate required fields
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      );
    }

    const subjectLine = subject ? `Contact Form: ${subject}` : 'Contact Form: New Message';

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: 'DCM Grading <noreply@dcmgrading.com>',
      to: ['admin@dcmgrading.com'],
      replyTo: email,
      subject: subjectLine,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #7c3aed; border-bottom: 2px solid #7c3aed; padding-bottom: 10px;">
            New Contact Form Submission
          </h2>

          <table style="width: 100%; margin: 20px 0;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">From:</td>
              <td style="padding: 8px 0; color: #1f2937;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">Email:</td>
              <td style="padding: 8px 0;">
                <a href="mailto:${email}" style="color: #7c3aed;">${email}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">Subject:</td>
              <td style="padding: 8px 0; color: #1f2937;">${subject || 'No subject selected'}</td>
            </tr>
          </table>

          <div style="margin-top: 20px;">
            <h3 style="color: #374151; margin-bottom: 10px;">Message:</h3>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; white-space: pre-wrap; color: #1f2937;">
${message}
            </div>
          </div>

          <hr style="margin-top: 30px; border: none; border-top: 1px solid #e5e7eb;" />
          <p style="color: #6b7280; font-size: 12px; margin-top: 15px;">
            This message was sent from the contact form on dcmgrading.com
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('[Contact Form] Resend error:', error);
      return NextResponse.json(
        { error: 'Failed to send message. Please try again.' },
        { status: 500 }
      );
    }

    console.log('[Contact Form] Email sent successfully:', data?.id);

    return NextResponse.json({
      success: true,
      message: 'Thank you for your message! We will get back to you soon.',
    });
  } catch (error: any) {
    console.error('[Contact Form] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send message. Please try again.' },
      { status: 500 }
    );
  }
}
