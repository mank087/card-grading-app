/**
 * Welcome Email API
 * Sends welcome email to new users after successful signup/email confirmation
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name } = body;

    // Validate required fields
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Use first part of email as fallback name
    const displayName = name || email.split('@')[0];

    // Send welcome email via Resend
    const { data, error } = await resend.emails.send({
      from: 'DCM Grading <noreply@dcmgrading.com>',
      to: [email],
      subject: 'Welcome to DCM Grading!',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          <!-- Header with gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); padding: 40px 40px 30px 40px; text-align: center;">
              <img src="https://dcmgrading.com/DCM%20Logo%20white.png" alt="DCM Grading" width="180" style="display: block; margin: 0 auto 20px auto;">
              <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 700;">Welcome to DCM Grading!</h1>
            </td>
          </tr>

          <!-- Main content -->
          <tr>
            <td style="padding: 40px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hi ${displayName},
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Thank you for joining DCM Grading! Your account is now active and ready to use.
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                You've received <strong style="color: #7c3aed;">3 free grading credits</strong> to get started. Upload your first card and experience our AI-powered grading system.
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 10px 0 30px 0;">
                    <a href="https://www.dcmgrading.com/collection" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Start Grading Cards
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Features list -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; border-radius: 8px; padding: 5px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="color: #6b7280; font-size: 14px; font-weight: 600; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 0.5px;">What you can do:</p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 8px 0; color: #374151; font-size: 14px;">
                          <span style="color: #7c3aed; margin-right: 10px;">&#10003;</span>
                          Upload cards for instant AI grading
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #374151; font-size: 14px;">
                          <span style="color: #7c3aed; margin-right: 10px;">&#10003;</span>
                          Get detailed 8-point condition analysis
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #374151; font-size: 14px;">
                          <span style="color: #7c3aed; margin-right: 10px;">&#10003;</span>
                          Grade Pokemon, MTG, Sports, and more
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #374151; font-size: 14px;">
                          <span style="color: #7c3aed; margin-right: 10px;">&#10003;</span>
                          Build and share your collection
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px 40px; border-top: 1px solid #e5e7eb;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">
                      Questions? Contact us at <a href="mailto:support@dcmgrading.com" style="color: #7c3aed; text-decoration: none;">support@dcmgrading.com</a>
                    </p>
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                      &copy; 2025 DCM Grading. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    });

    if (error) {
      console.error('[Welcome Email] Resend error:', error);
      return NextResponse.json(
        { error: 'Failed to send welcome email' },
        { status: 500 }
      );
    }

    console.log('[Welcome Email] Sent successfully to:', email, 'ID:', data?.id);

    return NextResponse.json({
      success: true,
      message: 'Welcome email sent',
    });
  } catch (error: any) {
    console.error('[Welcome Email] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send welcome email' },
      { status: 500 }
    );
  }
}
