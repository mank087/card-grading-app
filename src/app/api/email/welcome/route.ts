/**
 * Welcome Email API
 * Sends welcome email to new users after successful signup/email confirmation
 *
 * NOTE: Email HTML must use basic styling for Outlook/Gmail compatibility:
 * - No CSS gradients (use solid bgcolor)
 * - No divs (use tables)
 * - No border-radius on containers
 * - Use bgcolor attribute, not background-color style
 * - Use HTML entities for checkmarks
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

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

    // Send welcome email via Resend
    // Using email-safe HTML (no gradients, no divs, table-based layout)
    const { data, error } = await resend.emails.send({
      from: 'DCM Grading <noreply@dcmgrading.com>',
      to: [email],
      subject: 'Welcome to DCM!',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff;">

          <!-- Header with solid purple background -->
          <tr>
            <td align="center" bgcolor="#7c3aed" style="padding: 40px 40px 30px 40px;">
              <img src="https://www.dcmgrading.com/DCM%20Logo%20white.png" alt="DCM Grading" width="180" style="display: block; margin: 0 auto 20px auto;">
              <h1 style="color: #ffffff; font-size: 26px; margin: 0; font-weight: 700;">Welcome to DCM!</h1>
              <p style="color: #ffffff; font-size: 16px; margin: 10px 0 0 0;">Grade Cards in Seconds</p>
              <p style="color: #e9d5ff; font-size: 14px; margin: 5px 0 0 0;">Powered by DCM Optic&trade;</p>
            </td>
          </tr>

          <!-- Pricing Section -->
          <tr>
            <td bgcolor="#faf5ff" style="padding: 30px 20px 20px 20px;">
              <h2 style="color: #7c3aed; font-size: 18px; margin: 0 0 20px 0; text-align: center; font-weight: 600;">Simple, Affordable Pricing</h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <!-- Basic -->
                  <td width="33%" align="center" valign="top" style="padding: 8px;">
                    <a href="https://www.dcmgrading.com/credits" style="text-decoration: none; display: block;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #e5e7eb; background-color: #ffffff;">
                        <tr>
                          <td align="center" style="padding: 15px 10px;">
                            <p style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin: 0;">Basic</p>
                            <p style="font-size: 24px; font-weight: 700; color: #3b82f6; margin: 5px 0;">$2.99</p>
                            <p style="font-size: 11px; color: #374151; margin: 0;">2 Credits</p>
                          </td>
                        </tr>
                      </table>
                    </a>
                  </td>
                  <!-- Pro (Popular) -->
                  <td width="33%" align="center" valign="top" style="padding: 8px;">
                    <a href="https://www.dcmgrading.com/credits" style="text-decoration: none; display: block;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#7c3aed" style="background-color: #7c3aed;">
                        <tr>
                          <td align="center" style="padding: 5px 10px 2px 10px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" bgcolor="#fbbf24" style="background-color: #fbbf24;">
                              <tr>
                                <td style="padding: 2px 8px; font-size: 9px; font-weight: 700; color: #1f2937; text-transform: uppercase;">Popular</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding: 5px 10px 15px 10px;">
                            <p style="font-size: 12px; color: #e9d5ff; text-transform: uppercase; letter-spacing: 0.5px; margin: 0;">Pro</p>
                            <p style="font-size: 24px; font-weight: 700; color: #ffffff; margin: 5px 0;">$9.99</p>
                            <p style="font-size: 11px; color: #e9d5ff; margin: 0;">7 Credits</p>
                          </td>
                        </tr>
                      </table>
                    </a>
                  </td>
                  <!-- Elite -->
                  <td width="33%" align="center" valign="top" style="padding: 8px;">
                    <a href="https://www.dcmgrading.com/credits" style="text-decoration: none; display: block;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #e5e7eb; background-color: #ffffff;">
                        <tr>
                          <td align="center" style="padding: 15px 10px;">
                            <p style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin: 0;">Elite</p>
                            <p style="font-size: 24px; font-weight: 700; color: #f59e0b; margin: 5px 0;">$19.99</p>
                            <p style="font-size: 11px; color: #374151; margin: 0;">25 Credits</p>
                          </td>
                        </tr>
                      </table>
                    </a>
                  </td>
                </tr>
              </table>
              <p style="text-align: center; color: #059669; font-size: 14px; margin: 15px 0 0 0; font-weight: 600;">
                You have FREE credits to get started!
              </p>
            </td>
          </tr>

          <!-- Benefits Section -->
          <tr>
            <td style="padding: 30px 40px 20px 40px;">
              <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 20px 0; text-align: center; font-weight: 600;">Why Choose DCM?</h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <!-- Benefit 1 -->
                <tr>
                  <td style="padding: 10px 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td width="30" valign="top" style="padding-right: 12px;">
                          <span style="color: #7c3aed; font-size: 16px; font-weight: bold;">&#10004;</span>
                        </td>
                        <td>
                          <p style="font-weight: 600; color: #1f2937; font-size: 14px; margin: 0 0 2px 0;">Machine Learning</p>
                          <p style="color: #6b7280; font-size: 13px; line-height: 1.4; margin: 0;">Advanced AI technology delivers consistent, detailed, and reliable condition assessments.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Benefit 2 -->
                <tr>
                  <td style="padding: 10px 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td width="30" valign="top" style="padding-right: 12px;">
                          <span style="color: #7c3aed; font-size: 16px; font-weight: bold;">&#10004;</span>
                        </td>
                        <td>
                          <p style="font-weight: 600; color: #1f2937; font-size: 14px; margin: 0 0 2px 0;">Detailed Card Condition</p>
                          <p style="color: #6b7280; font-size: 13px; line-height: 1.4; margin: 0;">Comprehensive 30-point inspection across centering, corners, edges, and surface.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Benefit 3 -->
                <tr>
                  <td style="padding: 10px 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td width="30" valign="top" style="padding-right: 12px;">
                          <span style="color: #7c3aed; font-size: 16px; font-weight: bold;">&#10004;</span>
                        </td>
                        <td>
                          <p style="font-weight: 600; color: #1f2937; font-size: 14px; margin: 0 0 2px 0;">Build Your Collection</p>
                          <p style="color: #6b7280; font-size: 13px; line-height: 1.4; margin: 0;">Manage your collection with your actual card images—not stock photos.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Benefit 4 -->
                <tr>
                  <td style="padding: 10px 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td width="30" valign="top" style="padding-right: 12px;">
                          <span style="color: #7c3aed; font-size: 16px; font-weight: bold;">&#10004;</span>
                        </td>
                        <td>
                          <p style="font-weight: 600; color: #1f2937; font-size: 14px; margin: 0 0 2px 0;">Accurate Market Pricing</p>
                          <p style="color: #6b7280; font-size: 13px; line-height: 1.4; margin: 0;">Direct links to eBay and TCGPlayer for real-time, up-to-date market pricing.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Benefit 5 -->
                <tr>
                  <td style="padding: 10px 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td width="30" valign="top" style="padding-right: 12px;">
                          <span style="color: #7c3aed; font-size: 16px; font-weight: bold;">&#10004;</span>
                        </td>
                        <td>
                          <p style="font-weight: 600; color: #1f2937; font-size: 14px; margin: 0 0 2px 0;">Labels &amp; Reports</p>
                          <p style="color: #6b7280; font-size: 13px; line-height: 1.4; margin: 0;">Download professional grading labels and analysis reports for display or sales.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card Examples Section -->
          <tr>
            <td style="padding: 20px 20px 30px 20px;">
              <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 15px 0; text-align: center; font-weight: 600;">See It In Action</h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <!-- Card 1: Lorcana -->
                  <td width="33%" align="center" valign="top" style="padding: 5px;">
                    <a href="https://www.dcmgrading.com/lorcana/22b4cab3-dda1-4f02-98ed-8d53b272e6a8" style="text-decoration: none;">
                      <img src="https://www.dcmgrading.com/DCM-Card-Rapunzel---High-Climber-710817-front.jpg" alt="Rapunzel Lorcana Card - Grade 9" width="170" style="display: block; border: 1px solid #e5e7eb;">
                    </a>
                  </td>
                  <!-- Card 2: Sports -->
                  <td width="33%" align="center" valign="top" style="padding: 5px;">
                    <a href="https://www.dcmgrading.com/sports/81eb08af-17f5-4237-957e-4d4a3ac50e60" style="text-decoration: none;">
                      <img src="https://www.dcmgrading.com/DCM-Card-Shohei-Ohtani-496896-front.jpg" alt="Shohei Ohtani Card - Grade 10" width="170" style="display: block; border: 1px solid #e5e7eb;">
                    </a>
                  </td>
                  <!-- Card 3: Pokemon -->
                  <td width="33%" align="center" valign="top" style="padding: 5px;">
                    <a href="https://www.dcmgrading.com/pokemon/4c55d0ff-0932-47f4-a212-b1bd92016e15" style="text-decoration: none;">
                      <img src="https://www.dcmgrading.com/DCM-Card-Mega-Lucario-EX-930288-front.jpg" alt="Mega Lucario EX Card - Grade 10" width="170" style="display: block; border: 1px solid #e5e7eb;">
                    </a>
                  </td>
                </tr>
              </table>
              <p style="text-align: center; color: #6b7280; font-size: 12px; margin: 10px 0 0 0;">
                Click any card to see the full grading report
              </p>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 10px 40px 30px 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" bgcolor="#7c3aed" style="background-color: #7c3aed;">
                    <a href="https://www.dcmgrading.com/credits" style="display: inline-block; color: #ffffff; text-decoration: none; padding: 14px 32px; font-weight: 600; font-size: 16px;">
                      Start Grading Your Cards
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Social Media Section -->
          <tr>
            <td bgcolor="#f9fafb" style="padding: 20px 40px; border-top: 1px solid #e5e7eb;">
              <p style="text-align: center; color: #6b7280; font-size: 14px; margin: 0 0 15px 0; font-weight: 600;">Follow Us</p>
              <table role="presentation" align="center" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <!-- Facebook -->
                  <td align="center" style="padding: 0 12px;">
                    <a href="https://www.facebook.com/dcmgrading" style="text-decoration: none;">
                      <img src="https://cdn-icons-png.flaticon.com/512/124/124010.png" alt="Facebook" width="32" height="32" style="display: block;">
                    </a>
                  </td>
                  <!-- Instagram -->
                  <td align="center" style="padding: 0 12px;">
                    <a href="https://www.instagram.com/dcm_grading/" style="text-decoration: none;">
                      <img src="https://cdn-icons-png.flaticon.com/512/174/174855.png" alt="Instagram" width="32" height="32" style="display: block;">
                    </a>
                  </td>
                  <!-- X (Twitter) -->
                  <td align="center" style="padding: 0 12px;">
                    <a href="https://x.com/DCM_Grading" style="text-decoration: none;">
                      <img src="https://cdn-icons-png.flaticon.com/512/5969/5969020.png" alt="X" width="32" height="32" style="display: block;">
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td bgcolor="#f3f4f6" style="padding: 25px 40px; border-top: 1px solid #e5e7eb;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <p style="color: #6b7280; font-size: 13px; margin: 0 0 8px 0;">
                      Questions? <a href="mailto:admin@dcmgrading.com" style="color: #7c3aed; text-decoration: none;">admin@dcmgrading.com</a>
                    </p>
                    <p style="color: #9ca3af; font-size: 11px; margin: 0;">
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
