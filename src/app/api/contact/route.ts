/**
 * Contact Form API
 * Sends contact form submissions via email
 */

import { NextRequest, NextResponse } from 'next/server';

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

    // For now, we'll log the submission and return success
    // In production, you would integrate with an email service like:
    // - SendGrid, Resend, AWS SES, etc.
    console.log('[Contact Form] New submission:', {
      name,
      email,
      subject: subject || 'No subject',
      message,
      timestamp: new Date().toISOString(),
    });

    // TODO: Integrate with email service
    // Example with Resend:
    // await resend.emails.send({
    //   from: 'noreply@dcmgrading.com',
    //   to: 'admin@dcmgrading.com',
    //   subject: `Contact Form: ${subject || 'New Message'}`,
    //   html: `
    //     <h2>New Contact Form Submission</h2>
    //     <p><strong>From:</strong> ${name} (${email})</p>
    //     <p><strong>Subject:</strong> ${subject || 'No subject'}</p>
    //     <p><strong>Message:</strong></p>
    //     <p>${message}</p>
    //   `,
    // });

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
