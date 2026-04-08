/**
 * Welcome Email API
 * Sends welcome email to new users after successful signup/email confirmation
 * Also schedules 24-hour follow-up email
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
import { scheduleFollowUpEmail } from '@/lib/emailScheduler';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, userId } = body;

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
      from: 'DCM Grading <admin@dcmgrading.com>',
      to: [email],
      subject: 'Welcome to DCM Grading!',
      html: `
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>Welcome to DCM Grading</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
    u + #body a { color: inherit; text-decoration: none; font-size: inherit; font-family: inherit; font-weight: inherit; line-height: inherit; }

    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .pad-mobile { padding-left: 20px !important; padding-right: 20px !important; }
      .pad-mobile-sm { padding-left: 15px !important; padding-right: 15px !important; }
      .card-img-col { display: block !important; width: 100% !important; max-width: 200px !important; margin: 0 auto 10px auto !important; text-align: center !important; }
      .hero-cards-col { display: none !important; width: 0 !important; max-height: 0 !important; overflow: hidden !important; }
      .cta-wrap { width: 100% !important; }
      .cta-wrap td { display: block !important; width: 100% !important; text-align: center !important; }
      .cta-wrap a { display: block !important; width: 100% !important; padding: 16px 10px !important; box-sizing: border-box !important; }
      .cmp-cell { padding: 8px 6px !important; font-size: 12px !important; }
      .nav-td a { font-size: 11px !important; padding: 0 5px !important; }
      .hero-h1 { font-size: 26px !important; }
      .feature-col { display: block !important; width: 100% !important; max-width: 100% !important; margin-bottom: 16px !important; }
      .step-col { display: block !important; width: 100% !important; text-align: center !important; margin-bottom: 20px !important; }
      .blog-card-wrap { display: block !important; width: 100% !important; max-width: 100% !important; margin-bottom: 12px !important; }
      .blog-img { width: 100% !important; max-width: 100% !important; }
    }
  </style>
</head>
<body id="body" style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, Helvetica, sans-serif;">

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 20px 10px 40px 10px;">
        <!--[if mso]>
        <table role="presentation" align="center" border="0" cellspacing="0" cellpadding="0" width="600"><tr><td width="600">
        <![endif]-->
        <table role="presentation" class="email-container" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; margin: 0 auto;">

          <!-- ============================================ -->
          <!-- TOP NAV                                      -->
          <!-- ============================================ -->
          <tr>
            <td bgcolor="#0a0f1a" style="padding: 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td width="130" style="padding: 12px 0 12px 20px;" valign="middle">
                    <a href="https://www.dcmgrading.com/?utm_source=email&utm_medium=email&utm_campaign=welcome&utm_content=nav-logo" style="text-decoration: none;">
                      <img src="https://www.dcmgrading.com/DCM%20Logo%20white.png" alt="DCM Grading" width="110" style="display: block; width: 110px;">
                    </a>
                  </td>
                  <td align="right" class="nav-td" style="padding: 12px 20px 12px 0;" valign="middle">
                    <a href="https://www.dcmgrading.com/credits?utm_source=email&utm_medium=email&utm_campaign=welcome&utm_content=nav-credits" style="color: #34d399; font-size: 12px; text-decoration: none; padding: 0 8px; font-weight: 700;">Pricing</a>
                    <a href="https://www.dcmgrading.com/faq?utm_source=email&utm_medium=email&utm_campaign=welcome&utm_content=nav-faq" style="color: #d1d5db; font-size: 12px; text-decoration: none; padding: 0 8px;">FAQ</a>
                    <a href="https://www.dcmgrading.com/blog?utm_source=email&utm_medium=email&utm_campaign=welcome&utm_content=nav-blog" style="color: #d1d5db; font-size: 12px; text-decoration: none; padding: 0 8px;">Blog</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ============================================ -->
          <!-- HERO                                         -->
          <!-- ============================================ -->
          <tr>
            <td align="center" bgcolor="#0a0f1a" class="pad-mobile" style="padding: 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <!-- Left cards (hidden on mobile) -->
                  <td width="90" align="center" valign="middle" class="hero-cards-col" style="padding: 20px 0 20px 8px;">
                    <img src="https://www.dcmgrading.com/why-dcm/pikachu-graded-card.png" alt="" width="70" style="display: block; width: 70px; height: auto; opacity: 0.35; border-radius: 4px; transform: rotate(-6deg);">
                    <img src="https://www.dcmgrading.com/why-dcm/lorcana-graded-card.png" alt="" width="65" style="display: block; width: 65px; height: auto; opacity: 0.25; border-radius: 4px; margin-top: 8px; transform: rotate(4deg);">
                  </td>
                  <!-- Center hero content -->
                  <td align="center" style="padding: 40px 15px 35px 15px;">
                    <h1 class="hero-h1" style="color: #ffffff; font-size: 30px; margin: 0 0 12px 0; font-weight: 800; line-height: 1.25;">Welcome to<br><span style="color: #34d399;">DCM Grading!</span></h1>
                    <p style="color: #9ca3af; font-size: 15px; margin: 0 0 8px 0; line-height: 1.6;">Grade your cards from home in minutes &mdash; not weeks.<br>No mailing. No waiting. No risk.</p>
                    <p style="color: #6b7280; font-size: 13px; margin: 0 0 24px 0;">DCM Optic&trade; multi-pass grading &bull; Detailed reports &bull; Market pricing &bull; Custom labels</p>

              <!-- Hero CTA -->
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://www.dcmgrading.com/credits?utm_source=email&utm_medium=email&utm_campaign=welcome&utm_content=hero-cta" style="height:52px;v-text-anchor:middle;width:280px;" arcsize="15%" strokecolor="#059669" fillcolor="#059669">
              <w:anchorlock/>
              <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:17px;font-weight:bold;">Start Grading Now &rarr;</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="cta-wrap" style="margin: 0 auto;">
                <tr>
                  <td align="center" bgcolor="#059669" style="border-radius: 8px;">
                    <a href="https://www.dcmgrading.com/credits?utm_source=email&utm_medium=email&utm_campaign=welcome&utm_content=hero-cta" style="display: inline-block; color: #ffffff; text-decoration: none; padding: 15px 40px; font-weight: 700; font-size: 17px; font-family: Arial, Helvetica, sans-serif;">
                      Start Grading Now &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <!--<![endif]-->
              <p style="color: #4b5563; font-size: 12px; margin: 12px 0 0 0;">Your first grade is free &bull; No credit card required</p>
                  </td>
                  <!-- Right cards (hidden on mobile) -->
                  <td width="90" align="center" valign="middle" class="hero-cards-col" style="padding: 20px 8px 20px 0;">
                    <img src="https://www.dcmgrading.com/why-dcm/drake-maye-graded-card.png" alt="" width="70" style="display: block; width: 70px; height: auto; opacity: 0.35; border-radius: 4px; transform: rotate(5deg);">
                    <img src="https://www.dcmgrading.com/why-dcm/monkey-luffy-graded-card.png" alt="" width="65" style="display: block; width: 65px; height: auto; opacity: 0.25; border-radius: 4px; margin-top: 8px; transform: rotate(-3deg);">
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ============================================ -->
          <!-- FREE CREDIT BANNER                           -->
          <!-- ============================================ -->
          <tr>
            <td bgcolor="#059669" style="padding: 0;">
              <a href="https://www.dcmgrading.com/credits?utm_source=email&utm_medium=email&utm_campaign=welcome&utm_content=free-credits-banner" style="display: block; text-decoration: none; padding: 14px 20px;">
                <p style="color: #ffffff; font-size: 15px; font-weight: 700; margin: 0; text-align: center;">&#127881; You have a FREE credit waiting &mdash; grade your first card on us!</p>
              </a>
            </td>
          </tr>

          <!-- ============================================ -->
          <!-- PROMO CODE BANNER                            -->
          <!-- ============================================ -->
          <tr>
            <td class="pad-mobile-sm" style="padding: 25px 30px 5px 30px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 2px dashed #34d399; border-radius: 12px; overflow: hidden;">
                <tr>
                  <td bgcolor="#f0fdf4" style="padding: 22px 24px;" align="center">
                    <p style="color: #059669; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; margin: 0 0 6px 0;">&#127873; Welcome Gift &#127873;</p>
                    <p style="color: #065f46; font-size: 22px; font-weight: 800; margin: 0 0 8px 0;">Save 10% on Your First Purchase</p>
                    <p style="color: #374151; font-size: 14px; margin: 0 0 14px 0; line-height: 1.5;">Apply code below at checkout for <strong>10% off any credit pack</strong> or Card Lovers subscription.</p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                      <tr>
                        <td bgcolor="#065f46" style="padding: 0; border-radius: 8px;">
                          <a href="https://www.dcmgrading.com/credits?utm_source=email&utm_medium=email&utm_campaign=welcome&utm_content=promo-code-button" style="display: inline-block; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: 3px; font-family: 'Courier New', Courier, monospace; text-decoration: none; padding: 12px 28px;">Grade10</a>
                        </td>
                      </tr>
                    </table>
                    <p style="color: #6b7280; font-size: 12px; margin: 12px 0 0 0;">Plus, first-time graders get up to <strong style="color: #059669;">5 bonus credits FREE</strong> on their first purchase!</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ============================================ -->
          <!-- TRUST STRIP                                  -->
          <!-- ============================================ -->
          <tr>
            <td bgcolor="#065f46" style="padding: 12px 20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <p style="color: #d1fae5; font-size: 13px; margin: 0; font-weight: 600; letter-spacing: 0.3px;">
                      &#10003; 10-Point Scale &nbsp;&nbsp;&bull;&nbsp;&nbsp; &#10003; Instant Results &nbsp;&nbsp;&bull;&nbsp;&nbsp; &#10003; From $0.50/Card &nbsp;&nbsp;&bull;&nbsp;&nbsp; &#10003; Keep Your Cards
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ============================================ -->
          <!-- HOW IT WORKS                                 -->
          <!-- ============================================ -->
          <tr>
            <td class="pad-mobile" style="padding: 35px 30px 10px 30px;">
              <h2 style="color: #1f2937; font-size: 20px; margin: 0 0 6px 0; text-align: center; font-weight: 700;">How It Works</h2>
              <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0 0 22px 0;">From photo to professional grade in minutes</p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td class="step-col" width="25%" align="center" valign="top" style="padding: 0 6px 15px 6px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                      <tr><td align="center" bgcolor="#d1fae5" style="width: 44px; height: 44px; border-radius: 12px; font-size: 20px; line-height: 44px;">&#128247;</td></tr>
                    </table>
                    <p style="color: #059669; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 10px 0 4px 0;">Step 1</p>
                    <p style="color: #1f2937; font-size: 14px; font-weight: 700; margin: 0 0 3px 0;">Upload</p>
                    <p style="color: #6b7280; font-size: 12px; margin: 0; line-height: 1.4;">Snap a photo of your card&rsquo;s front and back</p>
                  </td>
                  <td class="step-col" width="25%" align="center" valign="top" style="padding: 0 6px 15px 6px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                      <tr><td align="center" bgcolor="#d1fae5" style="width: 44px; height: 44px; border-radius: 12px; font-size: 20px; line-height: 44px;">&#128161;</td></tr>
                    </table>
                    <p style="color: #059669; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 10px 0 4px 0;">Step 2</p>
                    <p style="color: #1f2937; font-size: 14px; font-weight: 700; margin: 0 0 3px 0;">DCM Optic&trade; Grades</p>
                    <p style="color: #6b7280; font-size: 12px; margin: 0; line-height: 1.4;">Multi-pass analysis of centering, corners, edges &amp; surface</p>
                  </td>
                  <td class="step-col" width="25%" align="center" valign="top" style="padding: 0 6px 15px 6px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                      <tr><td align="center" bgcolor="#d1fae5" style="width: 44px; height: 44px; border-radius: 12px; font-size: 20px; line-height: 44px;">&#128196;</td></tr>
                    </table>
                    <p style="color: #059669; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 10px 0 4px 0;">Step 3</p>
                    <p style="color: #1f2937; font-size: 14px; font-weight: 700; margin: 0 0 3px 0;">Get Results</p>
                    <p style="color: #6b7280; font-size: 12px; margin: 0; line-height: 1.4;">Detailed grade report with sub-scores and market pricing</p>
                  </td>
                  <td class="step-col" width="25%" align="center" valign="top" style="padding: 0 6px 15px 6px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                      <tr><td align="center" bgcolor="#d1fae5" style="width: 44px; height: 44px; border-radius: 12px; font-size: 20px; line-height: 44px;">&#9889;</td></tr>
                    </table>
                    <p style="color: #059669; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 10px 0 4px 0;">Step 4</p>
                    <p style="color: #1f2937; font-size: 14px; font-weight: 700; margin: 0 0 3px 0;">Share &amp; Sell</p>
                    <p style="color: #6b7280; font-size: 12px; margin: 0; line-height: 1.4;">Print labels, list to eBay, track your portfolio</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ============================================ -->
          <!-- DCM OPTIC                                    -->
          <!-- ============================================ -->
          <tr>
            <td class="pad-mobile-sm" style="padding: 15px 30px 25px 30px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0a0f1a" style="border-radius: 12px; overflow: hidden;">
                <tr>
                  <td class="pad-mobile-sm" style="padding: 28px 28px;">
                    <h2 style="color: #34d399; font-size: 18px; margin: 0 0 6px 0; text-align: center; font-weight: 700;">The DCM Optic&trade; Approach</h2>
                    <p style="color: #9ca3af; font-size: 13px; text-align: center; margin: 0 0 22px 0;">A structured, repeatable grading methodology you can trust</p>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <!-- Multi-Pass -->
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #1f2937;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td width="36" valign="top" style="padding-right: 12px;">
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                  <tr><td align="center" bgcolor="#065f46" style="width: 32px; height: 32px; border-radius: 8px; color: #34d399; font-size: 14px; font-weight: 800; line-height: 32px; font-family: Arial, sans-serif;">3x</td></tr>
                                </table>
                              </td>
                              <td valign="top">
                                <p style="color: #ffffff; font-size: 14px; font-weight: 700; margin: 0 0 3px 0;">Multi-Pass Consensus Grading</p>
                                <p style="color: #9ca3af; font-size: 12px; margin: 0; line-height: 1.5;">Every card is evaluated three independent times. Results are averaged and verified server-side to eliminate variance.</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <!-- Sub-Grades -->
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #1f2937;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td width="36" valign="top" style="padding-right: 12px;">
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                  <tr><td align="center" bgcolor="#065f46" style="width: 32px; height: 32px; border-radius: 8px; font-size: 16px; line-height: 32px;">&#128202;</td></tr>
                                </table>
                              </td>
                              <td valign="top">
                                <p style="color: #ffffff; font-size: 14px; font-weight: 700; margin: 0 0 3px 0;">Four Sub-Grade Categories</p>
                                <p style="color: #9ca3af; font-size: 12px; margin: 0; line-height: 1.5;">Centering, corners, edges, and surface &mdash; each scored for front and back. Final grade = weakest category.</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <!-- Server Verified -->
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #1f2937;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td width="36" valign="top" style="padding-right: 12px;">
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                  <tr><td align="center" bgcolor="#065f46" style="width: 32px; height: 32px; border-radius: 8px; font-size: 16px; line-height: 32px;">&#128274;</td></tr>
                                </table>
                              </td>
                              <td valign="top">
                                <p style="color: #ffffff; font-size: 14px; font-weight: 700; margin: 0 0 3px 0;">Server-Verified Results</p>
                                <p style="color: #9ca3af; font-size: 12px; margin: 0; line-height: 1.5;">Every grade is recalculated server-side with consensus boosting and standard rounding for accuracy.</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <!-- No Mailing -->
                      <tr>
                        <td style="padding: 10px 0;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td width="36" valign="top" style="padding-right: 12px;">
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                  <tr><td align="center" bgcolor="#065f46" style="width: 32px; height: 32px; border-radius: 8px; font-size: 16px; line-height: 32px;">&#128230;</td></tr>
                                </table>
                              </td>
                              <td valign="top">
                                <p style="color: #ffffff; font-size: 14px; font-weight: 700; margin: 0 0 3px 0;">No More Mailing &amp; Waiting</p>
                                <p style="color: #9ca3af; font-size: 12px; margin: 0; line-height: 1.5;">Mail-away grading costs $20&ndash;$150+ and takes weeks. DCM delivers results in minutes from $0.50/card.</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ============================================ -->
          <!-- FEATURES                                     -->
          <!-- ============================================ -->
          <tr>
            <td class="pad-mobile-sm" style="padding: 10px 30px 25px 30px;">
              <h2 style="color: #1f2937; font-size: 20px; margin: 0 0 6px 0; text-align: center; font-weight: 700;">Everything You Need</h2>
              <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0 0 22px 0;">A complete toolkit for grading, displaying, and selling your cards</p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td class="feature-col" width="50%" valign="top" style="padding: 0 6px 15px 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #e5e7eb; border-radius: 10px;">
                      <tr>
                        <td style="padding: 18px 16px;">
                          <p style="font-size: 24px; margin: 0 0 8px 0; line-height: 1;">&#128200;</p>
                          <p style="color: #1f2937; font-size: 14px; font-weight: 700; margin: 0 0 4px 0;">Market Pricing</p>
                          <p style="color: #6b7280; font-size: 12px; margin: 0; line-height: 1.5;">Real-time pricing from PriceCharting, SportsCardsPro, eBay, and Scryfall. See how your grade affects value.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td class="feature-col" width="50%" valign="top" style="padding: 0 0 15px 6px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #e5e7eb; border-radius: 10px;">
                      <tr>
                        <td style="padding: 18px 16px;">
                          <p style="font-size: 24px; margin: 0 0 8px 0; line-height: 1;">&#127912;</p>
                          <p style="color: #1f2937; font-size: 14px; font-weight: 700; margin: 0 0 4px 0;">Label Studio</p>
                          <p style="color: #6b7280; font-size: 12px; margin: 0; line-height: 1.5;">Design custom labels for slabs, one-touch holders, and toploaders. 8 color themes, custom gradients, and more.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td class="feature-col" width="50%" valign="top" style="padding: 0 6px 15px 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #e5e7eb; border-radius: 10px;">
                      <tr>
                        <td style="padding: 18px 16px;">
                          <p style="font-size: 24px; margin: 0 0 8px 0; line-height: 1;">&#128722;</p>
                          <p style="color: #1f2937; font-size: 14px; font-weight: 700; margin: 0 0 4px 0;">eBay InstaList</p>
                          <p style="color: #6b7280; font-size: 12px; margin: 0; line-height: 1.5;">Create professional eBay listings with one click. 5 images auto-generated, HTML descriptions, shipping calculator.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td class="feature-col" width="50%" valign="top" style="padding: 0 0 15px 6px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #e5e7eb; border-radius: 10px;">
                      <tr>
                        <td style="padding: 18px 16px;">
                          <p style="font-size: 24px; margin: 0 0 8px 0; line-height: 1;">&#128451;</p>
                          <p style="color: #1f2937; font-size: 14px; font-weight: 700; margin: 0 0 4px 0;">Card Databases</p>
                          <p style="color: #6b7280; font-size: 12px; margin: 0; line-height: 1.5;">Pok&eacute;mon, MTG, Sports, Lorcana, One Piece, Yu-Gi-Oh, Star Wars &amp; more. Accurate identification built in.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ============================================ -->
          <!-- GRADED CARD EXAMPLES                         -->
          <!-- ============================================ -->
          <tr>
            <td class="pad-mobile" style="padding: 5px 20px 20px 20px;">
              <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 5px 0; text-align: center; font-weight: 600;">Real Grades, Real Cards</h2>
              <p style="color: #6b7280; font-size: 13px; text-align: center; margin: 0 0 15px 0;">See what DCM graded cards look like</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td class="card-img-col" width="25%" align="center" valign="top" style="padding: 4px;">
                    <a href="https://www.dcmgrading.com/credits?utm_source=email&utm_medium=email&utm_campaign=welcome&utm_content=card-pikachu" style="text-decoration: none;">
                      <img src="https://www.dcmgrading.com/why-dcm/pikachu-graded-card.png" alt="Pikachu Graded Card" width="130" style="display: block; width: 100%; max-width: 130px; height: auto; border-radius: 6px;">
                    </a>
                  </td>
                  <td class="card-img-col" width="25%" align="center" valign="top" style="padding: 4px;">
                    <a href="https://www.dcmgrading.com/credits?utm_source=email&utm_medium=email&utm_campaign=welcome&utm_content=card-drake" style="text-decoration: none;">
                      <img src="https://www.dcmgrading.com/why-dcm/drake-maye-graded-card.png" alt="Drake Maye Graded Card" width="130" style="display: block; width: 100%; max-width: 130px; height: auto; border-radius: 6px;">
                    </a>
                  </td>
                  <td class="card-img-col" width="25%" align="center" valign="top" style="padding: 4px;">
                    <a href="https://www.dcmgrading.com/credits?utm_source=email&utm_medium=email&utm_campaign=welcome&utm_content=card-luffy" style="text-decoration: none;">
                      <img src="https://www.dcmgrading.com/why-dcm/monkey-luffy-graded-card.png" alt="Monkey D. Luffy Graded Card" width="130" style="display: block; width: 100%; max-width: 130px; height: auto; border-radius: 6px;">
                    </a>
                  </td>
                  <td class="card-img-col" width="25%" align="center" valign="top" style="padding: 4px;">
                    <a href="https://www.dcmgrading.com/credits?utm_source=email&utm_medium=email&utm_campaign=welcome&utm_content=card-mtg" style="text-decoration: none;">
                      <img src="https://www.dcmgrading.com/why-dcm/magic-the-gathering-graded-card.png" alt="MTG Graded Card" width="130" style="display: block; width: 100%; max-width: 130px; height: auto; border-radius: 6px;">
                    </a>
                  </td>
                </tr>
              </table>
              <p style="text-align: center; color: #9ca3af; font-size: 12px; margin: 10px 0 0 0;">
                Pokemon &bull; Sports &bull; Lorcana &bull; MTG &bull; One Piece &bull; Yu-Gi-Oh &bull; Star Wars &amp; more
              </p>
            </td>
          </tr>

          <!-- ============================================ -->
          <!-- TESTIMONIALS                                 -->
          <!-- ============================================ -->
          <tr>
            <td class="pad-mobile-sm" style="padding: 10px 30px 25px 30px;">
              <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 18px 0; text-align: center; font-weight: 600;">What Collectors Are Saying</h2>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 10px;">
                <tr>
                  <td style="padding: 16px 18px;">
                    <p style="color: #f59e0b; font-size: 14px; margin: 0 0 6px 0; letter-spacing: 1px;">&#9733;&#9733;&#9733;&#9733;&#9733;</p>
                    <p style="color: #374151; font-size: 13px; margin: 0 0 8px 0; line-height: 1.6; font-style: italic;">&ldquo;DCM has completely changed how I manage my collection. I can grade a card, see what it&rsquo;s worth, and organize everything in one place.&rdquo;</p>
                    <p style="color: #6b7280; font-size: 12px; margin: 0; font-weight: 700;">Mike R. <span style="font-weight: 400;">&mdash; Pokemon &amp; Sports Collector</span></p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 10px;">
                <tr>
                  <td style="padding: 16px 18px;">
                    <p style="color: #f59e0b; font-size: 14px; margin: 0 0 6px 0; letter-spacing: 1px;">&#9733;&#9733;&#9733;&#9733;&#9733;</p>
                    <p style="color: #374151; font-size: 13px; margin: 0 0 8px 0; line-height: 1.6; font-style: italic;">&ldquo;I used to send cards off and wait 6&ndash;8 weeks just to find out a grade. Now I get results in minutes and my cards never leave my desk.&rdquo;</p>
                    <p style="color: #6b7280; font-size: 12px; margin: 0; font-weight: 700;">Anthony M. <span style="font-weight: 400;">&mdash; Sports Card Enthusiast</span></p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #e5e7eb; border-radius: 8px;">
                <tr>
                  <td style="padding: 16px 18px;">
                    <p style="color: #f59e0b; font-size: 14px; margin: 0 0 6px 0; letter-spacing: 1px;">&#9733;&#9733;&#9733;&#9733;&#9733;</p>
                    <p style="color: #374151; font-size: 13px; margin: 0 0 8px 0; line-height: 1.6; font-style: italic;">&ldquo;The label studio is my favorite feature. I love customizing the colors of my slab labels to match the card inside. My display case has never looked this good.&rdquo;</p>
                    <p style="color: #6b7280; font-size: 12px; margin: 0; font-weight: 700;">Paul S. <span style="font-weight: 400;">&mdash; TCG Hobbyist</span></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ============================================ -->
          <!-- PRICING TABLE                                -->
          <!-- ============================================ -->
          <tr>
            <td class="pad-mobile-sm" style="padding: 10px 30px 25px 30px;">
              <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 6px 0; text-align: center; font-weight: 600;">Simple, Affordable Pricing</h2>
              <p style="color: #6b7280; font-size: 13px; text-align: center; margin: 0 0 18px 0;">Credits never expire. Buy what you need, grade when you&rsquo;re ready.</p>

              <a href="https://www.dcmgrading.com/credits?utm_source=email&utm_medium=email&utm_campaign=welcome&utm_content=pricing-table" style="text-decoration: none;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td width="25%" bgcolor="#f9fafb" class="cmp-cell" style="padding: 10px 8px; border-bottom: 2px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 11px; font-weight: 700; text-transform: uppercase; margin: 0;">Package</p>
                  </td>
                  <td width="25%" align="center" bgcolor="#f9fafb" class="cmp-cell" style="padding: 10px 6px; border-bottom: 2px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 11px; font-weight: 700; text-transform: uppercase; margin: 0;">Credits</p>
                  </td>
                  <td width="25%" align="center" bgcolor="#f9fafb" class="cmp-cell" style="padding: 10px 6px; border-bottom: 2px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 11px; font-weight: 700; text-transform: uppercase; margin: 0;">Price</p>
                  </td>
                  <td width="25%" align="center" bgcolor="#f9fafb" class="cmp-cell" style="padding: 10px 6px; border-bottom: 2px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 11px; font-weight: 700; text-transform: uppercase; margin: 0;">Per Grade</p>
                  </td>
                </tr>
                <tr>
                  <td class="cmp-cell" style="padding: 9px 8px; border-bottom: 1px solid #e5e7eb;"><p style="color: #374151; font-size: 13px; margin: 0;">Basic</p></td>
                  <td align="center" class="cmp-cell" style="padding: 9px 6px; border-bottom: 1px solid #e5e7eb;"><p style="color: #6b7280; font-size: 13px; margin: 0;">1</p></td>
                  <td align="center" class="cmp-cell" style="padding: 9px 6px; border-bottom: 1px solid #e5e7eb;"><p style="color: #6b7280; font-size: 13px; margin: 0;">$2.99</p></td>
                  <td align="center" class="cmp-cell" style="padding: 9px 6px; border-bottom: 1px solid #e5e7eb;"><p style="color: #6b7280; font-size: 13px; margin: 0;">$2.99</p></td>
                </tr>
                <tr>
                  <td class="cmp-cell" style="padding: 9px 8px; border-bottom: 1px solid #e5e7eb;"><p style="color: #374151; font-size: 13px; margin: 0;">Pro</p></td>
                  <td align="center" class="cmp-cell" style="padding: 9px 6px; border-bottom: 1px solid #e5e7eb;"><p style="color: #6b7280; font-size: 13px; margin: 0;">5</p></td>
                  <td align="center" class="cmp-cell" style="padding: 9px 6px; border-bottom: 1px solid #e5e7eb;"><p style="color: #6b7280; font-size: 13px; margin: 0;">$9.99</p></td>
                  <td align="center" class="cmp-cell" style="padding: 9px 6px; border-bottom: 1px solid #e5e7eb;"><p style="color: #6b7280; font-size: 13px; margin: 0;">$2.00</p></td>
                </tr>
                <tr>
                  <td class="cmp-cell" style="padding: 9px 8px; border-bottom: 1px solid #e5e7eb;"><p style="color: #374151; font-size: 13px; margin: 0;">Elite</p></td>
                  <td align="center" class="cmp-cell" style="padding: 9px 6px; border-bottom: 1px solid #e5e7eb;"><p style="color: #6b7280; font-size: 13px; margin: 0;">20</p></td>
                  <td align="center" class="cmp-cell" style="padding: 9px 6px; border-bottom: 1px solid #e5e7eb;"><p style="color: #6b7280; font-size: 13px; margin: 0;">$19.99</p></td>
                  <td align="center" class="cmp-cell" style="padding: 9px 6px; border-bottom: 1px solid #e5e7eb;"><p style="color: #6b7280; font-size: 13px; margin: 0;">$1.00</p></td>
                </tr>
                <tr>
                  <td bgcolor="#f0fdf4" class="cmp-cell" style="padding: 9px 8px;"><p style="color: #059669; font-size: 13px; margin: 0; font-weight: 700;">&#11088; VIP</p></td>
                  <td align="center" bgcolor="#f0fdf4" class="cmp-cell" style="padding: 9px 6px;"><p style="color: #059669; font-size: 13px; margin: 0; font-weight: 700;">150</p></td>
                  <td align="center" bgcolor="#f0fdf4" class="cmp-cell" style="padding: 9px 6px;"><p style="color: #059669; font-size: 13px; margin: 0; font-weight: 700;">$99</p></td>
                  <td align="center" bgcolor="#f0fdf4" class="cmp-cell" style="padding: 9px 6px;"><p style="color: #059669; font-size: 13px; margin: 0; font-weight: 800;">$0.66</p></td>
                </tr>
              </table>
              </a>
              <p style="text-align: center; color: #059669; font-size: 12px; margin: 10px 0 0 0; font-weight: 600;">VIP = Most Popular! 150 credits + VIP badge on all labels</p>
              <p style="text-align: center; margin: 4px 0 0 0;">
                <a href="https://www.dcmgrading.com/card-lovers?utm_source=email&utm_medium=email&utm_campaign=welcome&utm_content=card-lovers-link" style="color: #be185d; font-size: 12px; text-decoration: underline; font-family: Arial, Helvetica, sans-serif;">Looking for more? Check out Card Lovers &hearts; &mdash; 900 credits/yr at $0.50/grade</a>
              </p>
            </td>
          </tr>

          <!-- ============================================ -->
          <!-- MID CTA                                      -->
          <!-- ============================================ -->
          <tr>
            <td class="pad-mobile-sm" style="padding: 0 30px 25px 30px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0a0f1a" style="border-radius: 10px;">
                <tr>
                  <td align="center" class="pad-mobile" style="padding: 28px 30px;">
                    <p style="color: #34d399; font-size: 24px; margin: 0 0 8px 0; font-weight: 800; line-height: 1.3;">Ready to Grade Your First Card?</p>
                    <p style="color: #9ca3af; font-size: 14px; margin: 0 0 20px 0; line-height: 1.5;">
                      Upload a photo, get your grade in minutes.<br>Your first credit is on us &mdash; no card required.
                    </p>
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://www.dcmgrading.com/credits?utm_source=email&utm_medium=email&utm_campaign=welcome&utm_content=mid-cta" style="height:52px;v-text-anchor:middle;width:280px;" arcsize="15%" strokecolor="#059669" fillcolor="#059669">
                    <w:anchorlock/>
                    <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:17px;font-weight:bold;">Get Credits &amp; Start Grading &rarr;</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <table role="presentation" align="center" cellspacing="0" cellpadding="0" border="0" class="cta-wrap" style="margin: 0 auto;">
                      <tr>
                        <td align="center" bgcolor="#059669" style="border-radius: 8px;">
                          <a href="https://www.dcmgrading.com/credits?utm_source=email&utm_medium=email&utm_campaign=welcome&utm_content=mid-cta" style="display: inline-block; color: #ffffff; text-decoration: none; padding: 15px 44px; font-weight: 700; font-size: 17px; font-family: Arial, Helvetica, sans-serif;">
                            Get Credits &amp; Start Grading &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>
                    <!--<![endif]-->
                    <p style="color: #4b5563; font-size: 12px; margin: 14px 0 0 0;">
                      No mailing &bull; Instant results &bull; Keep your cards safe
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ============================================ -->
          <!-- BOTTOM CTA                                   -->
          <!-- ============================================ -->
          <tr>
            <td class="pad-mobile-sm" style="padding: 5px 30px 30px 30px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#065f46" style="border-radius: 10px;">
                <tr>
                  <td align="center" class="pad-mobile" style="padding: 28px 30px;">
                    <p style="color: #ffffff; font-size: 20px; margin: 0 0 8px 0; font-weight: 700; line-height: 1.3;">Don&rsquo;t Mail Your Cards.<br>Grade Them Now.</p>
                    <p style="color: #d1fae5; font-size: 14px; margin: 0 0 20px 0; line-height: 1.5;">
                      Detailed reports &bull; Custom labels &bull; Market pricing<br>All from $0.50 per grade. First grade free.
                    </p>
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://www.dcmgrading.com/credits?utm_source=email&utm_medium=email&utm_campaign=welcome&utm_content=bottom-cta" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="17%" strokecolor="#ffffff" fillcolor="#ffffff">
                    <w:anchorlock/>
                    <center style="color:#065f46;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">Browse Credit Packages &rarr;</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <table role="presentation" align="center" cellspacing="0" cellpadding="0" border="0" class="cta-wrap" style="margin: 0 auto;">
                      <tr>
                        <td align="center" bgcolor="#ffffff" style="border-radius: 8px;">
                          <a href="https://www.dcmgrading.com/credits?utm_source=email&utm_medium=email&utm_campaign=welcome&utm_content=bottom-cta" style="display: inline-block; color: #065f46; text-decoration: none; padding: 14px 36px; font-weight: 700; font-size: 16px; font-family: Arial, Helvetica, sans-serif;">
                            Browse Credit Packages &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ============================================ -->
          <!-- SOCIAL                                       -->
          <!-- ============================================ -->
          <tr>
            <td bgcolor="#f9fafb" style="padding: 20px 40px; border-top: 1px solid #e5e7eb;">
              <p style="text-align: center; color: #6b7280; font-size: 14px; margin: 0 0 12px 0; font-weight: 600;">Follow Us</p>
              <p style="text-align: center; margin: 0;">
                <a href="https://www.facebook.com/dcmgrading" style="color: #059669; font-size: 13px; text-decoration: none; font-weight: 600; padding: 0 10px;">Facebook</a>
                <span style="color: #d1d5db;">&bull;</span>
                <a href="https://www.instagram.com/dcm_grading/" style="color: #059669; font-size: 13px; text-decoration: none; font-weight: 600; padding: 0 10px;">Instagram</a>
                <span style="color: #d1d5db;">&bull;</span>
                <a href="https://x.com/DCM_Grading" style="color: #059669; font-size: 13px; text-decoration: none; font-weight: 600; padding: 0 10px;">X / Twitter</a>
              </p>
            </td>
          </tr>

          <!-- ============================================ -->
          <!-- FOOTER                                       -->
          <!-- ============================================ -->
          <tr>
            <td bgcolor="#f3f4f6" style="padding: 25px 40px; border-top: 1px solid #e5e7eb;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <p style="color: #6b7280; font-size: 13px; margin: 0 0 8px 0;">Questions? <a href="mailto:admin@dcmgrading.com" style="color: #059669; text-decoration: none;">admin@dcmgrading.com</a></p>
                    <p style="color: #9ca3af; font-size: 11px; margin: 0 0 10px 0;">&copy; 2026 DCM Grading. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!--[if mso]>
        </td></tr></table>
        <![endif]-->
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

    // Schedule 24-hour follow-up email if userId is provided
    if (userId) {
      const scheduleResult = await scheduleFollowUpEmail(userId, email, 24);
      if (scheduleResult.success) {
        console.log('[Welcome Email] Follow-up email scheduled for:', email);
      } else {
        console.warn('[Welcome Email] Failed to schedule follow-up:', scheduleResult.error);
      }
    } else {
      console.warn('[Welcome Email] No userId provided, skipping follow-up scheduling');
    }

    return NextResponse.json({
      success: true,
      message: 'Welcome email sent',
      followUpScheduled: !!userId,
    });
  } catch (error: any) {
    console.error('[Welcome Email] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send welcome email' },
      { status: 500 }
    );
  }
}
