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
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          <!-- Header with gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); padding: 40px 40px 30px 40px; text-align: center;">
              <img src="https://www.dcmgrading.com/DCM%20Logo%20white.png" alt="DCM Grading" width="180" style="display: block; margin: 0 auto 20px auto;">
              <h1 style="color: #ffffff; font-size: 26px; margin: 0; font-weight: 700;">Welcome to DCM!</h1>
              <p style="color: rgba(255,255,255,0.95); font-size: 16px; margin: 10px 0 0 0;">Grade Cards in Seconds</p>
              <p style="color: rgba(255,255,255,0.85); font-size: 14px; margin: 5px 0 0 0;">Powered by DCM Optic™</p>
            </td>
          </tr>

          <!-- Pricing Section -->
          <tr>
            <td style="padding: 30px 30px 20px 30px; background-color: #faf5ff;">
              <h2 style="color: #7c3aed; font-size: 18px; margin: 0 0 20px 0; text-align: center; font-weight: 600;">Simple, Affordable Pricing</h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <!-- Basic -->
                  <td width="33%" align="center" style="padding: 8px;">
                    <a href="https://www.dcmgrading.com/credits" style="text-decoration: none; display: block;">
                      <div style="background: #ffffff; border-radius: 8px; padding: 15px 10px; border: 1px solid #e5e7eb;">
                        <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Basic</div>
                        <div style="font-size: 24px; font-weight: 700; color: #3b82f6; margin: 5px 0;">$2.99</div>
                        <div style="font-size: 11px; color: #374151;">2 Credits</div>
                      </div>
                    </a>
                  </td>
                  <!-- Pro -->
                  <td width="33%" align="center" style="padding: 8px;">
                    <a href="https://www.dcmgrading.com/credits" style="text-decoration: none; display: block;">
                      <div style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); border-radius: 8px; padding: 15px 10px; position: relative;">
                        <div style="position: absolute; top: -8px; left: 50%; transform: translateX(-50%); background: #fbbf24; color: #1f2937; font-size: 9px; font-weight: 700; padding: 2px 8px; border-radius: 10px; text-transform: uppercase;">Popular</div>
                        <div style="font-size: 12px; color: rgba(255,255,255,0.9); text-transform: uppercase; letter-spacing: 0.5px;">Pro</div>
                        <div style="font-size: 24px; font-weight: 700; color: #ffffff; margin: 5px 0;">$9.99</div>
                        <div style="font-size: 11px; color: rgba(255,255,255,0.9);">7 Credits</div>
                      </div>
                    </a>
                  </td>
                  <!-- Elite -->
                  <td width="33%" align="center" style="padding: 8px;">
                    <a href="https://www.dcmgrading.com/credits" style="text-decoration: none; display: block;">
                      <div style="background: #ffffff; border-radius: 8px; padding: 15px 10px; border: 1px solid #e5e7eb;">
                        <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Elite</div>
                        <div style="font-size: 24px; font-weight: 700; color: #f59e0b; margin: 5px 0;">$19.99</div>
                        <div style="font-size: 11px; color: #374151;">25 Credits</div>
                      </div>
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
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 10px 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="30" valign="top" style="padding-right: 12px;">
                          <div style="width: 24px; height: 24px; background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); border-radius: 50%; text-align: center; line-height: 24px; color: white; font-size: 12px;">&#10003;</div>
                        </td>
                        <td>
                          <div style="font-weight: 600; color: #1f2937; font-size: 14px; margin-bottom: 2px;">Machine Learning</div>
                          <div style="color: #6b7280; font-size: 13px; line-height: 1.4;">Advanced AI technology delivers consistent, detailed, and reliable condition assessments.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="30" valign="top" style="padding-right: 12px;">
                          <div style="width: 24px; height: 24px; background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); border-radius: 50%; text-align: center; line-height: 24px; color: white; font-size: 12px;">&#10003;</div>
                        </td>
                        <td>
                          <div style="font-weight: 600; color: #1f2937; font-size: 14px; margin-bottom: 2px;">Detailed Card Condition</div>
                          <div style="color: #6b7280; font-size: 13px; line-height: 1.4;">Comprehensive 30-point inspection across centering, corners, edges, and surface.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="30" valign="top" style="padding-right: 12px;">
                          <div style="width: 24px; height: 24px; background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); border-radius: 50%; text-align: center; line-height: 24px; color: white; font-size: 12px;">&#10003;</div>
                        </td>
                        <td>
                          <div style="font-weight: 600; color: #1f2937; font-size: 14px; margin-bottom: 2px;">Build Your Collection</div>
                          <div style="color: #6b7280; font-size: 13px; line-height: 1.4;">Manage your collection with your actual card images—not stock photos.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="30" valign="top" style="padding-right: 12px;">
                          <div style="width: 24px; height: 24px; background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); border-radius: 50%; text-align: center; line-height: 24px; color: white; font-size: 12px;">&#10003;</div>
                        </td>
                        <td>
                          <div style="font-weight: 600; color: #1f2937; font-size: 14px; margin-bottom: 2px;">Accurate Market Pricing</div>
                          <div style="color: #6b7280; font-size: 13px; line-height: 1.4;">Direct links to eBay and TCGPlayer for real-time, up-to-date market pricing.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="30" valign="top" style="padding-right: 12px;">
                          <div style="width: 24px; height: 24px; background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); border-radius: 50%; text-align: center; line-height: 24px; color: white; font-size: 12px;">&#10003;</div>
                        </td>
                        <td>
                          <div style="font-weight: 600; color: #1f2937; font-size: 14px; margin-bottom: 2px;">Labels & Reports</div>
                          <div style="color: #6b7280; font-size: 13px; line-height: 1.4;">Download professional grading labels and analysis reports for display or sales.</div>
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
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <!-- Card 1: Lorcana -->
                  <td width="33%" align="center" style="padding: 5px;">
                    <a href="https://www.dcmgrading.com/lorcana/22b4cab3-dda1-4f02-98ed-8d53b272e6a8" style="text-decoration: none; display: block;">
                      <div style="background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <img src="https://www.dcmgrading.com/DCM-Card-Rapunzel---High-Climber-710817-front.jpg" alt="Rapunzel Lorcana Card - Grade 9" width="100%" style="display: block;">
                      </div>
                    </a>
                  </td>

                  <!-- Card 2: Sports -->
                  <td width="33%" align="center" style="padding: 5px;">
                    <a href="https://www.dcmgrading.com/sports/81eb08af-17f5-4237-957e-4d4a3ac50e60" style="text-decoration: none; display: block;">
                      <div style="background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <img src="https://www.dcmgrading.com/DCM-Card-Shohei-Ohtani-496896-front.jpg" alt="Shohei Ohtani Card - Grade 10" width="100%" style="display: block;">
                      </div>
                    </a>
                  </td>

                  <!-- Card 3: Pokemon -->
                  <td width="33%" align="center" style="padding: 5px;">
                    <a href="https://www.dcmgrading.com/pokemon/4c55d0ff-0932-47f4-a212-b1bd92016e15" style="text-decoration: none; display: block;">
                      <div style="background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <img src="https://www.dcmgrading.com/DCM-Card-Mega-Lucario-EX-930288-front.jpg" alt="Mega Lucario EX Card - Grade 10" width="100%" style="display: block;">
                      </div>
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
              <a href="https://www.dcmgrading.com/credits" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Start Grading Your Cards
              </a>
            </td>
          </tr>

          <!-- Social Media Section -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="text-align: center; color: #6b7280; font-size: 14px; margin: 0 0 15px 0; font-weight: 600;">Follow Us</p>
              <table role="presentation" align="center" cellspacing="0" cellpadding="0">
                <tr>
                  <!-- Facebook -->
                  <td align="center" style="padding: 0 12px;">
                    <a href="https://www.facebook.com/dcmgrading" style="text-decoration: none;">
                      <div style="width: 40px; height: 40px; background-color: #e5e7eb; border-radius: 50%; display: inline-block; line-height: 40px; text-align: center;">
                        <img src="https://cdn-icons-png.flaticon.com/512/124/124010.png" alt="Facebook" width="20" style="vertical-align: middle;">
                      </div>
                    </a>
                  </td>
                  <!-- Instagram -->
                  <td align="center" style="padding: 0 12px;">
                    <a href="https://www.instagram.com/dcm_grading/" style="text-decoration: none;">
                      <div style="width: 40px; height: 40px; background-color: #e5e7eb; border-radius: 50%; display: inline-block; line-height: 40px; text-align: center;">
                        <img src="https://cdn-icons-png.flaticon.com/512/174/174855.png" alt="Instagram" width="20" style="vertical-align: middle;">
                      </div>
                    </a>
                  </td>
                  <!-- X (Twitter) -->
                  <td align="center" style="padding: 0 12px;">
                    <a href="https://x.com/DCM_Grading" style="text-decoration: none;">
                      <div style="width: 40px; height: 40px; background-color: #e5e7eb; border-radius: 50%; display: inline-block; line-height: 40px; text-align: center;">
                        <img src="https://cdn-icons-png.flaticon.com/512/5969/5969020.png" alt="X" width="20" style="vertical-align: middle;">
                      </div>
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f3f4f6; padding: 25px 40px; border-top: 1px solid #e5e7eb;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
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
