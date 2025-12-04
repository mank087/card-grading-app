/**
 * Contact Form API
 * Sends contact form submissions via email using Resend
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Simple in-memory rate limiting (resets on server restart)
// For production, consider using Redis or a database
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 5; // Max 5 requests
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // Per hour

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return false;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return true;
  }

  record.count++;
  return false;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting by IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               'unknown';

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { name, email, subject, message } = body;

    // Validate required fields
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required' },
        { status: 400 }
      );
    }

    // Validate input lengths
    if (name.length > 100) {
      return NextResponse.json(
        { error: 'Name is too long (max 100 characters)' },
        { status: 400 }
      );
    }

    if (email.length > 254) {
      return NextResponse.json(
        { error: 'Email is too long' },
        { status: 400 }
      );
    }

    if (message.length > 10000) {
      return NextResponse.json(
        { error: 'Message is too long (max 10,000 characters)' },
        { status: 400 }
      );
    }

    // Validate email format with stricter regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      );
    }

    // Sanitize inputs to prevent XSS in emails
    const sanitize = (str: string) => str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');

    const safeName = sanitize(name);
    const safeEmail = sanitize(email);
    const safeSubject = subject ? sanitize(subject) : '';
    const safeMessage = sanitize(message);

    const subjectLine = safeSubject ? `Contact Form: ${safeSubject}` : 'Contact Form: New Message';

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: 'DCM Grading <noreply@dcmgrading.com>',
      to: ['admin@dcmgrading.com'],
      replyTo: email, // Use original email for reply-to
      subject: subjectLine,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #7c3aed; border-bottom: 2px solid #7c3aed; padding-bottom: 10px;">
            New Contact Form Submission
          </h2>

          <table style="width: 100%; margin: 20px 0;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">From:</td>
              <td style="padding: 8px 0; color: #1f2937;">${safeName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">Email:</td>
              <td style="padding: 8px 0;">
                <a href="mailto:${safeEmail}" style="color: #7c3aed;">${safeEmail}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">Subject:</td>
              <td style="padding: 8px 0; color: #1f2937;">${safeSubject || 'No subject selected'}</td>
            </tr>
          </table>

          <div style="margin-top: 20px;">
            <h3 style="color: #374151; margin-bottom: 10px;">Message:</h3>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; white-space: pre-wrap; color: #1f2937;">
${safeMessage}
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
