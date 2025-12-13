/**
 * Email Templates
 * HTML templates for marketing emails
 *
 * NOTE: Email HTML optimized for Outlook/Gmail compatibility:
 * - No CSS gradients (use solid bgcolor)
 * - No divs (use tables for layout)
 * - No border-radius on containers
 * - Use bgcolor attribute AND background-color style (for different clients)
 * - Use HTML entities for special characters
 * - Inline all styles (no <style> blocks)
 * - Use role="presentation" on layout tables
 * - Use align/valign attributes for positioning
 * - Specify width in pixels, not percentages where possible
 * - Include MSO conditionals for Outlook-specific rendering
 */

/**
 * 24-Hour Follow-Up Email Subject
 */
export function getFollowUp24hEmailSubject(): string {
  return "Professional card grading, made simple";
}

/**
 * 24-Hour Follow-Up Email HTML
 * Sent 24 hours after account creation
 *
 * @param unsubscribeUrl - URL for one-click unsubscribe
 */
export function getFollowUp24hEmailHtml(unsubscribeUrl: string): string {
  return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>DCM Grading</title>
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
    @media screen and (max-width: 600px) {
      .mobile-hide { display: none !important; }
      .mobile-center { text-align: center !important; }
      .mobile-stack { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, Helvetica, sans-serif; -webkit-font-smoothing: antialiased;">
  <!-- Preview text -->
  <div style="display: none; max-height: 0; overflow: hidden;">
    Get a professional-level card evaluation in just minutes with DCM Grading.
  </div>
  <!-- Spacing hack for preview text -->
  <div style="display: none; max-height: 0; overflow: hidden;">
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f3f4f6" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <!--[if mso]>
        <table role="presentation" align="center" border="0" cellspacing="0" cellpadding="0" width="600">
        <tr>
        <td>
        <![endif]-->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="max-width: 600px; background-color: #ffffff; border-collapse: collapse;">

          <!-- Header -->
          <tr>
            <td align="center" bgcolor="#7c3aed" style="background-color: #7c3aed; padding: 35px 40px 30px 40px;">
              <a href="https://www.dcmgrading.com" style="text-decoration: none;">
                <img src="https://www.dcmgrading.com/DCM%20Logo%20white.png" alt="DCM Grading" width="180" height="auto" style="display: block; margin: 0 auto 15px auto; max-width: 180px;">
              </a>
              <h1 style="color: #ffffff; font-size: 26px; margin: 0; font-weight: 700; font-family: Arial, Helvetica, sans-serif;">Grade Your Cards Your Way</h1>
            </td>
          </tr>

          <!-- Main Content with Card Image -->
          <tr>
            <td style="padding: 35px 30px 25px 30px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <!-- Left: Copy -->
                  <td width="320" valign="top" class="mobile-stack" style="padding-right: 20px;">
                    <p style="color: #374151; font-size: 15px; line-height: 1.65; margin: 0 0 18px 0; font-family: Arial, Helvetica, sans-serif;">
                      <strong style="color: #7c3aed;">DCM</strong> makes it easy to get a professional-level card evaluation in just minutes. No forms, no guesswork&mdash;just clear photos and expert-grade analysis powered by <strong>DCM Optic&trade;</strong>.
                    </p>
                    <p style="color: #374151; font-size: 15px; line-height: 1.65; margin: 0 0 18px 0; font-family: Arial, Helvetica, sans-serif;">
                      Upload images of the front and back of your card and receive a detailed condition report designed to support resale decisions, collection management, or prep before submitting to major grading companies.
                    </p>
                    <p style="color: #374151; font-size: 15px; line-height: 1.65; margin: 0; font-family: Arial, Helvetica, sans-serif;">
                      Sign in and grade a card whenever you are ready&mdash;first time graders receive <a href="https://www.dcmgrading.com/credits" style="color: #7c3aed; text-decoration: none; font-weight: 600;">Bonus Credits</a>!
                    </p>
                  </td>
                  <!-- Right: Card Image -->
                  <td width="200" valign="top" align="center" class="mobile-stack mobile-center" style="padding-top: 10px;">
                    <a href="https://www.dcmgrading.com" style="text-decoration: none;">
                      <img src="https://www.dcmgrading.com/DCM-Card-Mega-Charizard-X-EX-261763-front.jpg" alt="Mega Charizard X EX - Grade 10 Gem Mint" width="180" height="auto" style="display: block; max-width: 180px; border: 1px solid #e5e7eb;">
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 5px 40px 35px 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" bgcolor="#7c3aed" style="background-color: #7c3aed;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://www.dcmgrading.com/upload" style="height:50px;v-text-anchor:middle;width:260px;" arcsize="0%" strokecolor="#7c3aed" fillcolor="#7c3aed">
                    <w:anchorlock/>
                    <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">Grade Your First Card</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="https://www.dcmgrading.com/upload" style="display: inline-block; color: #ffffff; text-decoration: none; padding: 16px 45px; font-weight: 600; font-size: 16px; font-family: Arial, Helvetica, sans-serif;">
                      Grade Your First Card
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Pricing Section -->
          <tr>
            <td bgcolor="#faf5ff" style="background-color: #faf5ff; padding: 30px 20px; border-top: 1px solid #e5e7eb;">
              <h2 style="color: #7c3aed; font-size: 18px; margin: 0 0 20px 0; text-align: center; font-weight: 600; font-family: Arial, Helvetica, sans-serif;">Credit Packages</h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <!-- Basic -->
                  <td width="33%" align="center" valign="top" style="padding: 0 6px;">
                    <a href="https://www.dcmgrading.com/credits" style="text-decoration: none; display: block;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="background-color: #ffffff; border: 1px solid #e5e7eb;">
                        <tr>
                          <td align="center" style="padding: 18px 8px;">
                            <p style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin: 0; font-family: Arial, Helvetica, sans-serif;">Basic</p>
                            <p style="font-size: 26px; font-weight: 700; color: #3b82f6; margin: 6px 0; font-family: Arial, Helvetica, sans-serif;">$2.99</p>
                            <p style="font-size: 12px; color: #374151; margin: 0; font-family: Arial, Helvetica, sans-serif;">2 Credits</p>
                          </td>
                        </tr>
                      </table>
                    </a>
                  </td>
                  <!-- Pro (Popular) -->
                  <td width="33%" align="center" valign="top" style="padding: 0 6px;">
                    <a href="https://www.dcmgrading.com/credits" style="text-decoration: none; display: block;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#7c3aed" style="background-color: #7c3aed;">
                        <tr>
                          <td align="center" style="padding: 5px 8px 3px 8px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" bgcolor="#fbbf24" style="background-color: #fbbf24;">
                              <tr>
                                <td style="padding: 2px 8px; font-size: 9px; font-weight: 700; color: #1f2937; text-transform: uppercase; font-family: Arial, Helvetica, sans-serif;">Popular</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding: 3px 8px 18px 8px;">
                            <p style="font-size: 11px; color: #e9d5ff; text-transform: uppercase; letter-spacing: 0.5px; margin: 0; font-family: Arial, Helvetica, sans-serif;">Pro</p>
                            <p style="font-size: 26px; font-weight: 700; color: #ffffff; margin: 6px 0; font-family: Arial, Helvetica, sans-serif;">$9.99</p>
                            <p style="font-size: 12px; color: #e9d5ff; margin: 0; font-family: Arial, Helvetica, sans-serif;">7 Credits</p>
                          </td>
                        </tr>
                      </table>
                    </a>
                  </td>
                  <!-- Elite -->
                  <td width="33%" align="center" valign="top" style="padding: 0 6px;">
                    <a href="https://www.dcmgrading.com/credits" style="text-decoration: none; display: block;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="background-color: #ffffff; border: 1px solid #e5e7eb;">
                        <tr>
                          <td align="center" style="padding: 18px 8px;">
                            <p style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin: 0; font-family: Arial, Helvetica, sans-serif;">Elite</p>
                            <p style="font-size: 26px; font-weight: 700; color: #f59e0b; margin: 6px 0; font-family: Arial, Helvetica, sans-serif;">$19.99</p>
                            <p style="font-size: 12px; color: #374151; margin: 0; font-family: Arial, Helvetica, sans-serif;">25 Credits</p>
                          </td>
                        </tr>
                      </table>
                    </a>
                  </td>
                </tr>
              </table>
              <p style="text-align: center; margin: 18px 0 0 0;">
                <a href="https://www.dcmgrading.com/credits" style="color: #7c3aed; text-decoration: none; font-weight: 600; font-size: 14px; font-family: Arial, Helvetica, sans-serif;">View All Packages &rarr;</a>
              </p>
            </td>
          </tr>

          <!-- What You'll Get Section -->
          <tr>
            <td style="padding: 30px 40px;">
              <h2 style="color: #1f2937; font-size: 18px; margin: 0 0 20px 0; text-align: center; font-weight: 600; font-family: Arial, Helvetica, sans-serif;">What You'll Get</h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding: 8px 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td width="30" valign="top" style="padding-right: 12px;">
                          <span style="color: #059669; font-size: 16px; font-weight: bold;">&#10004;</span>
                        </td>
                        <td>
                          <p style="color: #374151; font-size: 14px; margin: 0; font-family: Arial, Helvetica, sans-serif;"><strong>Detailed Condition Report</strong> - 30-point inspection of your card</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td width="30" valign="top" style="padding-right: 12px;">
                          <span style="color: #059669; font-size: 16px; font-weight: bold;">&#10004;</span>
                        </td>
                        <td>
                          <p style="color: #374151; font-size: 14px; margin: 0; font-family: Arial, Helvetica, sans-serif;"><strong>Professional Labels</strong> - Download and print for display or sales</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td width="30" valign="top" style="padding-right: 12px;">
                          <span style="color: #059669; font-size: 16px; font-weight: bold;">&#10004;</span>
                        </td>
                        <td>
                          <p style="color: #374151; font-size: 14px; margin: 0; font-family: Arial, Helvetica, sans-serif;"><strong>Collection Management</strong> - Track all your cards with your actual images</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td width="30" valign="top" style="padding-right: 12px;">
                          <span style="color: #059669; font-size: 16px; font-weight: bold;">&#10004;</span>
                        </td>
                        <td>
                          <p style="color: #374151; font-size: 14px; margin: 0; font-family: Arial, Helvetica, sans-serif;"><strong>Market Pricing Links</strong> - eBay and TCGPlayer pricing for your exact card</p>
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
            <td bgcolor="#f3f4f6" style="background-color: #f3f4f6; padding: 25px 40px; border-top: 1px solid #e5e7eb;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <p style="color: #6b7280; font-size: 13px; margin: 0 0 8px 0; font-family: Arial, Helvetica, sans-serif;">
                      Questions? <a href="mailto:admin@dcmgrading.com" style="color: #7c3aed; text-decoration: none;">admin@dcmgrading.com</a>
                    </p>
                    <p style="color: #9ca3af; font-size: 11px; margin: 0 0 12px 0; font-family: Arial, Helvetica, sans-serif;">
                      &copy; 2025 DCM Grading. All rights reserved.
                    </p>
                    <p style="color: #9ca3af; font-size: 11px; margin: 0; font-family: Arial, Helvetica, sans-serif;">
                      <a href="${unsubscribeUrl}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a> from marketing emails
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!--[if mso]>
        </td>
        </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
