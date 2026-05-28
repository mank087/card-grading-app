/**
 * Post-Grade Email Templates
 *
 * Four-email series triggered when a user grades their first card:
 *  - first_grade_education   (T+24h)  — explains sub-grades using the user's actual card
 *  - first_grade_social_proof (T+72h) — featured cards + DCM toolkit, soft Grade10 push
 *  - first_grade_last_chance (T+7d)   — GRADE20 urgency push with cost-per-grade breakdown
 *  - winback                 (T+14d)  — daily cron driven, pre-grants 1 free credit on send
 *
 * The first three are scheduled at first-grade time via scheduleFirstGradeEmails().
 * Winback is queued by the daily winback cron based on inactivity.
 *
 * Send-time guard: skip if user has purchased (total_purchased > 0) or unsubscribed.
 * Audience filtering happens at SEND time, not schedule time — protects against users
 * who buy between queue and send.
 */

export interface FirstGradeEducationData {
  front_image_url: string;
  card_name: string;
  final_grade: number | string;
  category_slug: string; // route slug like 'sports', 'pokemon', 'onepiece'
  card_id: string;
  centering_score: number | string;
  corners_score: number | string;
  edges_score: number | string;
  surface_score: number | string;
  credits_remaining: number;
  unsubscribe_url: string;
}

export interface SocialProofEmailData {
  unsubscribe_url: string;
}

export interface LastChanceEmailData {
  unsubscribe_url: string;
}

export interface WinbackEmailData {
  front_image_url: string;
  card_name: string;
  final_grade: number | string;
  unsubscribe_url: string;
}

// ============================================================================
// SUBJECTS
// ============================================================================

export function getFirstGradeEducationSubject(): string {
  return "Here's what your grade actually means";
}

export function getSocialProofEmailSubject(): string {
  return "The cards graders are listing this week";
}

export function getLastChanceEmailSubject(): string {
  return "Last chance: your 20% off expires in 48 hours";
}

export function getWinbackEmailSubject(): string {
  return "Your collection is waiting (free credit inside)";
}

// ============================================================================
// EMAIL 2: FIRST-GRADE EDUCATION (T+24h post-first-grade)
// ============================================================================

export function getFirstGradeEducationHtml(data: FirstGradeEducationData): string {
  const creditsPlural = Number(data.credits_remaining) === 1 ? '' : 's';
  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>Your Grade Decoded &middot; DCM Grading</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
    u + #body a { color: inherit; text-decoration: none; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .pad-mobile { padding-left: 20px !important; padding-right: 20px !important; }
      .pad-mobile-sm { padding-left: 15px !important; padding-right: 15px !important; }
      .cta-wrap { width: 100% !important; }
      .cta-wrap td { display: block !important; width: 100% !important; text-align: center !important; }
      .cta-wrap a { display: block !important; width: 100% !important; padding: 16px 10px !important; box-sizing: border-box !important; }
      .nav-td a { font-size: 11px !important; padding: 0 5px !important; }
      .hero-h1 { font-size: 24px !important; }
      .grade-card-col { display: block !important; width: 100% !important; max-width: 320px !important; margin: 0 auto 20px auto !important; }
      .sub-grade-col { display: block !important; width: 100% !important; margin-bottom: 12px !important; }
      .badge-stack { display: block !important; width: 100% !important; text-align: center !important; }
      .badge-stack td { display: inline-block !important; padding: 5px !important; }
    }
  </style>
</head>
<body id="body" style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, Helvetica, sans-serif;">
  <div style="display: none; max-height: 0; overflow: hidden;">A quick breakdown of how DCM analyzed your card and why your sub-grades came out the way they did.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f3f4f6;">
    <tr><td align="center" style="padding: 20px 10px 40px 10px;">
      <!--[if mso]><table role="presentation" align="center" border="0" cellspacing="0" cellpadding="0" width="600"><tr><td width="600"><![endif]-->
      <table role="presentation" class="email-container" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; margin: 0 auto;">
        <tr><td bgcolor="#0a0f1a" style="padding: 0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
            <td width="130" style="padding: 12px 0 12px 20px;" valign="middle">
              <a href="https://dcmgrading.com/?utm_source=email&utm_medium=email&utm_campaign=post_grade_education&utm_content=nav-logo" style="text-decoration: none;"><img src="https://dcmgrading.com/DCM%20Logo%20white.png" alt="DCM Grading" width="110" style="display: block; width: 110px;"></a>
            </td>
            <td align="right" class="nav-td" style="padding: 12px 20px 12px 0;" valign="middle">
              <a href="https://dcmgrading.com/collection?utm_source=email&utm_medium=email&utm_campaign=post_grade_education&utm_content=nav-collection" style="color: #34d399; font-size: 12px; text-decoration: none; padding: 0 8px; font-weight: 700;">My Collection</a>
              <a href="https://dcmgrading.com/featured?utm_source=email&utm_medium=email&utm_campaign=post_grade_education&utm_content=nav-featured" style="color: #d1d5db; font-size: 12px; text-decoration: none; padding: 0 8px;">Featured</a>
              <a href="https://dcmgrading.com/credits?utm_source=email&utm_medium=email&utm_campaign=post_grade_education&utm_content=nav-credits" style="color: #d1d5db; font-size: 12px; text-decoration: none; padding: 0 8px;">Credits</a>
            </td>
          </tr></table>
        </td></tr>
        <tr><td align="center" bgcolor="#0a0f1a" class="pad-mobile" style="padding: 0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
            <td align="center" style="padding: 40px 15px 35px 15px;">
              <p style="color: #34d399; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 10px 0;">&#128269; Your Grade, Explained</p>
              <h1 class="hero-h1" style="color: #ffffff; font-size: 28px; margin: 0 0 12px 0; font-weight: 800; line-height: 1.25;">Here&rsquo;s What Your<br><span style="color: #34d399;">Sub-Grades Mean</span></h1>
              <p style="color: #9ca3af; font-size: 15px; margin: 0 0 8px 0; line-height: 1.6;">A behind-the-scenes look at how DCM Optic&trade;<br>analyzed your card, pass by pass and score by score.</p>
            </td>
          </tr></table>
        </td></tr>
        <tr><td class="pad-mobile" style="padding: 35px 30px 20px 30px;" bgcolor="#ffffff">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
            <td width="40%" align="center" valign="top" class="grade-card-col" style="padding: 0 12px 0 0;">
              <img src="${data.front_image_url}" alt="Your graded card" width="200" style="display: block; width: 100%; max-width: 200px; height: auto; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.15);">
              <p style="color: #6b7280; font-size: 12px; margin: 12px 0 0 0; font-style: italic;">${data.card_name}</p>
            </td>
            <td width="60%" valign="top" class="grade-card-col">
              <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 8px 0; font-weight: 700;">Your Final Grade</p>
              <p style="color: #111827; font-size: 64px; font-weight: 800; margin: 0; line-height: 1; font-family: Arial Black, Arial, sans-serif;">${data.final_grade}</p>
              <p style="color: #4b5563; font-size: 14px; margin: 8px 0 16px 0; line-height: 1.5;">Your final grade is the <strong>lowest</strong> of your four sub-grades. We don&rsquo;t average. One weak sub-grade caps the whole card.</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
                <td bgcolor="#059669" style="border-radius: 6px;"><a href="https://dcmgrading.com/${data.category_slug}/${data.card_id}?utm_source=email&utm_medium=email&utm_campaign=post_grade_education&utm_content=view-report" style="display: inline-block; color: #ffffff; text-decoration: none; padding: 11px 22px; font-weight: 700; font-size: 14px; font-family: Arial, Helvetica, sans-serif;">View Full Report &rarr;</a></td>
              </tr></table>
            </td>
          </tr></table>
        </td></tr>
        <tr><td class="pad-mobile" style="padding: 10px 30px 0 30px;"><hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 0;"></td></tr>
        <tr><td class="pad-mobile" style="padding: 30px 30px 10px 30px;">
          <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 6px 0; font-weight: 700;">Sub-Grade Breakdown</p>
          <h2 style="color: #111827; font-size: 22px; margin: 0 0 6px 0; font-weight: 800;">What each score actually measures</h2>
          <p style="color: #6b7280; font-size: 14px; margin: 0 0 22px 0; line-height: 1.6;">Every grade is built from four independent dimensions. Here&rsquo;s how yours scored and what we look at for each one.</p>
        </td></tr>
        ${renderSubGradeRow('Centering', 'How balanced the borders are, front and back', String(data.centering_score), '#6366f1', '#4338ca', 'DCM Optic&trade; measures the ratio of border width on all four sides. Even a small shift (55/45 or worse) can knock points off.')}
        ${renderSubGradeRow('Corners', 'Sharpness of all eight corners', String(data.corners_score), '#d97706', '#b45309', 'Each corner is examined at high zoom across three passes. Whitening, fraying, blunting, or chipping on a single corner can cap this score.')}
        ${renderSubGradeRow('Edges', 'Clean lines along every edge', String(data.edges_score), '#0891b2', '#0e7490', 'We trace the full perimeter on front and back. Roughness, nicks, factory edge wear, and color loss along the cut all show up here.')}
        ${renderSubGradeRow('Surface', 'Print quality, scratches, scuffs, dings', String(data.surface_score), '#059669', '#047857', 'The biggest sub-grade by detection area. Print lines, roller marks, scratches, scuffs, dimples, and holo wear all show up here.', true)}
        <tr><td class="pad-mobile" style="padding: 10px 30px 0 30px;"><hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 0;"></td></tr>
        <tr><td class="pad-mobile" style="padding: 28px 30px 8px 30px;">
          <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 6px 0; font-weight: 700;">Why You Can Trust This Grade</p>
          <h2 style="color: #111827; font-size: 22px; margin: 0 0 14px 0; font-weight: 800;">Three independent passes. One unbiased result.</h2>
          <p style="color: #4b5563; font-size: 14px; margin: 0 0 16px 0; line-height: 1.7;">DCM Optic&trade; doesn&rsquo;t grade your card once. It grades it <strong>three times</strong>, independently, in a single analysis run. The three scores are reconciled, outliers get flagged, and the consensus becomes your final number.</p>
          <p style="color: #4b5563; font-size: 14px; margin: 0 0 22px 0; line-height: 1.7;">That&rsquo;s why two photos of the same card produce the same grade. No grader having a bad day, no human bias, just consistent analysis built for collectors.</p>
        </td></tr>
        <tr><td class="pad-mobile" style="padding: 0 30px 25px 30px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
            <td width="33%" align="center" valign="top" class="sub-grade-col" style="padding: 0 6px;"><div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 18px 12px;"><p style="color: #059669; font-size: 28px; margin: 0 0 6px 0; font-weight: 800;">1</p><p style="color: #111827; font-size: 13px; font-weight: 700; margin: 0 0 4px 0;">First Pass</p><p style="color: #4b5563; font-size: 12px; margin: 0; line-height: 1.5;">Fresh look. No prior context.</p></div></td>
            <td width="33%" align="center" valign="top" class="sub-grade-col" style="padding: 0 6px;"><div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 18px 12px;"><p style="color: #059669; font-size: 28px; margin: 0 0 6px 0; font-weight: 800;">2</p><p style="color: #111827; font-size: 13px; font-weight: 700; margin: 0 0 4px 0;">Second Pass</p><p style="color: #4b5563; font-size: 12px; margin: 0; line-height: 1.5;">Independent re-analysis.</p></div></td>
            <td width="33%" align="center" valign="top" class="sub-grade-col" style="padding: 0 6px;"><div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 18px 12px;"><p style="color: #059669; font-size: 28px; margin: 0 0 6px 0; font-weight: 800;">3</p><p style="color: #111827; font-size: 13px; font-weight: 700; margin: 0 0 4px 0;">Third Pass</p><p style="color: #4b5563; font-size: 12px; margin: 0; line-height: 1.5;">Final verification &amp; reconcile.</p></div></td>
          </tr></table>
        </td></tr>
        ${renderMobileCallout({
          headline: 'Better photos in your pocket.',
          tagline: 'The DCM app uses your phone&rsquo;s camera with grading-specific framing guides. Sharper photos lead to more accurate grades.',
          utmCampaign: 'post_grade_education',
        })}
        <tr><td class="pad-mobile" style="padding: 10px 30px 0 30px;"><hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 0;"></td></tr>
        <tr><td class="pad-mobile" style="padding: 28px 30px 6px 30px;">
          <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 6px 0; font-weight: 700;">Everything In Your Report</p>
          <h2 style="color: #111827; font-size: 22px; margin: 0 0 16px 0; font-weight: 800;">Your card&rsquo;s full DCM profile</h2>
        </td></tr>
        <tr><td class="pad-mobile" style="padding: 0 30px 8px 30px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            ${renderFeatureRow('&#128202;', 'Defect heatmap on every flaw we found', 'Cropped patches showing exactly what got detected and where. Not just a vague &ldquo;there&rsquo;s damage&rdquo; verdict.')}
            ${renderFeatureRow('&#127991;&#65039;', 'Customizable labels for any slab or holder', 'Design and print labels for slabs, magnetic one-touch holders, and toploaders. Each one includes your card&rsquo;s photo, grade, and serial.')}
            ${renderFeatureRow('&#128176;', 'Market pricing backed by established institutions', 'Real comparable sales pulled from trusted collectibles data sources, so you know what your card is worth at this grade. Not what someone wishes it was.')}
            ${renderFeatureRow('&#128722;', 'Instant eBay listing with optimized titles', 'DCM InstaList builds your eBay listing for you. Titles are pulled from your card&rsquo;s details, and descriptions lead with grade and condition.')}
          </table>
        </td></tr>
        <tr><td class="pad-mobile-sm" style="padding: 12px 30px 30px 30px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0a0f1a" style="border-radius: 10px;"><tr>
            <td align="center" class="pad-mobile" style="padding: 28px 30px;">
              <p style="color: #ffffff; font-size: 20px; margin: 0 0 8px 0; font-weight: 800; line-height: 1.3;">Grade your next card</p>
              <p style="color: #d1d5db; font-size: 14px; margin: 0 0 18px 0; line-height: 1.5;">You still have <strong style="color: #34d399;">${data.credits_remaining}</strong> credit${creditsPlural} left from signup. See how your collection stacks up.</p>
              <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://dcmgrading.com/upload?utm_source=email&utm_medium=email&utm_campaign=post_grade_education&utm_content=primary-cta" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="17%" strokecolor="#34d399" fillcolor="#34d399"><w:anchorlock/><center style="color:#0a0f1a;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">Grade Another Card &rarr;</center></v:roundrect><![endif]-->
              <!--[if !mso]><!-->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="cta-wrap" style="margin: 0 auto;"><tr>
                <td align="center" bgcolor="#34d399" style="border-radius: 8px;"><a href="https://dcmgrading.com/upload?utm_source=email&utm_medium=email&utm_campaign=post_grade_education&utm_content=primary-cta" style="display: inline-block; color: #0a0f1a; text-decoration: none; padding: 14px 36px; font-weight: 800; font-size: 16px; font-family: Arial, Helvetica, sans-serif;">Grade Another Card &rarr;</a></td>
              </tr></table>
              <!--<![endif]-->
            </td>
          </tr></table>
        </td></tr>
        ${renderFooter('You&rsquo;re getting this because you graded a card with DCM. A few short follow-ups over the next two weeks, then we&rsquo;ll stop.', data.unsubscribe_url)}
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`;
}

// ============================================================================
// EMAIL 3: SOCIAL PROOF (T+72h post-first-grade)
// ============================================================================

export function getSocialProofEmailHtml(data: SocialProofEmailData): string {
  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>The Cards Graders Are Listing This Week &middot; DCM Grading</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .pad-mobile { padding-left: 20px !important; padding-right: 20px !important; }
      .pad-mobile-sm { padding-left: 15px !important; padding-right: 15px !important; }
      .cta-wrap { width: 100% !important; }
      .cta-wrap td { display: block !important; width: 100% !important; text-align: center !important; }
      .cta-wrap a { display: block !important; width: 100% !important; padding: 16px 10px !important; box-sizing: border-box !important; }
      .nav-td a { font-size: 11px !important; padding: 0 5px !important; }
      .hero-h1 { font-size: 24px !important; }
      .feat-col { display: block !important; width: 100% !important; margin-bottom: 16px !important; }
      .tool-col { display: block !important; width: 100% !important; margin-bottom: 16px !important; }
      .badge-stack { display: block !important; width: 100% !important; text-align: center !important; }
      .badge-stack td { display: inline-block !important; padding: 5px !important; }
    }
  </style>
</head>
<body id="body" style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, Helvetica, sans-serif;">
  <div style="display: none; max-height: 0; overflow: hidden;">Most graders try 3 to 5 cards before they figure out which ones to slab and sell. Here&rsquo;s what the rest are working on.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f3f4f6;">
    <tr><td align="center" style="padding: 20px 10px 40px 10px;">
      <!--[if mso]><table role="presentation" align="center" border="0" cellspacing="0" cellpadding="0" width="600"><tr><td width="600"><![endif]-->
      <table role="presentation" class="email-container" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; margin: 0 auto;">
        <tr><td bgcolor="#0a0f1a" style="padding: 0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
            <td width="130" style="padding: 12px 0 12px 20px;" valign="middle"><a href="https://dcmgrading.com/?utm_source=email&utm_medium=email&utm_campaign=post_grade_social&utm_content=nav-logo" style="text-decoration: none;"><img src="https://dcmgrading.com/DCM%20Logo%20white.png" alt="DCM Grading" width="110" style="display: block; width: 110px;"></a></td>
            <td align="right" class="nav-td" style="padding: 12px 20px 12px 0;" valign="middle">
              <a href="https://dcmgrading.com/featured?utm_source=email&utm_medium=email&utm_campaign=post_grade_social&utm_content=nav-featured" style="color: #34d399; font-size: 12px; text-decoration: none; padding: 0 8px; font-weight: 700;">Featured</a>
              <a href="https://dcmgrading.com/market-pricing?utm_source=email&utm_medium=email&utm_campaign=post_grade_social&utm_content=nav-market" style="color: #d1d5db; font-size: 12px; text-decoration: none; padding: 0 8px;">Market Pricing</a>
              <a href="https://dcmgrading.com/credits?utm_source=email&utm_medium=email&utm_campaign=post_grade_social&utm_content=nav-credits" style="color: #d1d5db; font-size: 12px; text-decoration: none; padding: 0 8px;">Credits</a>
            </td>
          </tr></table>
        </td></tr>
        <tr><td align="center" bgcolor="#0a0f1a" class="pad-mobile" style="padding: 0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding: 40px 15px 35px 15px;">
            <p style="color: #34d399; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 10px 0;">&#127919; This Week On DCM</p>
            <h1 class="hero-h1" style="color: #ffffff; font-size: 28px; margin: 0 0 12px 0; font-weight: 800; line-height: 1.25;">The Cards Graders<br><span style="color: #34d399;">Are Listing Now</span></h1>
            <p style="color: #9ca3af; font-size: 15px; margin: 0 0 8px 0; line-height: 1.6;">See what&rsquo;s being graded, slabbed, and listed.<br>You might find your next grade in here.</p>
          </td></tr></table>
        </td></tr>
        <tr><td class="pad-mobile" style="padding: 32px 30px 18px 30px;">
          <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 8px 0; font-weight: 700;">A Pattern We&rsquo;ve Noticed</p>
          <h2 style="color: #111827; font-size: 22px; margin: 0 0 12px 0; font-weight: 800;">Most graders try 3 to 5 cards before they commit.</h2>
          <p style="color: #4b5563; font-size: 15px; margin: 0 0 8px 0; line-height: 1.7;">The first card teaches you how your photos affect the score. The second one tells you which cards in your collection are actually worth slabbing. By the third or fourth, you&rsquo;ve got something you want to post.</p>
          <p style="color: #4b5563; font-size: 15px; margin: 0; line-height: 1.7;">If your first grade surprised you in either direction, that&rsquo;s normal. Grade a few more and the pattern usually clicks.</p>
        </td></tr>
        <tr><td class="pad-mobile" style="padding: 22px 30px 6px 30px;">
          <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 6px 0; font-weight: 700;">Trending On DCM Right Now</p>
          <h3 style="color: #111827; font-size: 18px; margin: 0 0 18px 0; font-weight: 800;">Recently graded by the community</h3>
        </td></tr>
        <tr><td class="pad-mobile" style="padding: 0 30px 8px 30px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
            ${renderFeaturedCard('https://dcmgrading.com/onepiece/4239dbe8-0da9-405e-8f23-8724c87c8e20', 'https://dcmgrading.com/why-dcm/one-piece-graded-card.png', 'Monkey.D.Luffy', 'One Piece TCG', '9', 'featured-1')}
            ${renderFeaturedCard('https://dcmgrading.com/pokemon/83abd9b2-c176-4b42-94a7-0a6891438d52', 'https://dcmgrading.com/why-dcm/pokemon-graded-card.png', 'Charizard VMAX', 'Pokemon', '10', 'featured-2')}
            ${renderFeaturedCard('https://dcmgrading.com/sports/2a7caf2c-fe35-48a9-add5-2b130ad8ba70', 'https://dcmgrading.com/why-dcm/football-graded-card.png', 'Jaxson Dart, QB', 'Football', '9', 'featured-3')}
          </tr></table>
          <p align="center" style="margin: 18px 0 0 0;"><a href="https://dcmgrading.com/featured?utm_source=email&utm_medium=email&utm_campaign=post_grade_social&utm_content=see-all" style="color: #059669; font-size: 13px; font-weight: 700; text-decoration: none;">See all featured cards &rarr;</a></p>
        </td></tr>
        <tr><td class="pad-mobile" style="padding: 28px 30px 0 30px;"><hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 0;"></td></tr>
        <tr><td class="pad-mobile" style="padding: 28px 30px 6px 30px;">
          <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 6px 0; font-weight: 700;">Built For Collectors</p>
          <h2 style="color: #111827; font-size: 22px; margin: 0 0 16px 0; font-weight: 800;">DCM is more than the grade.</h2>
          <p style="color: #4b5563; font-size: 14px; margin: 0 0 22px 0; line-height: 1.7;">Every card in your collection comes with the full DCM toolkit. Not just a score, but everything you need to slab it, price it, and sell it.</p>
        </td></tr>
        <tr><td class="pad-mobile" style="padding: 0 30px 8px 30px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              ${renderToolCard('&#127991;&#65039;', 'Customizable Labels', 'Design and print labels for slabs, magnetic one-touch holders, and toploaders. Each one includes your card&rsquo;s photo, grade, and serial.')}
              ${renderToolCard('&#128176;', 'Market Pricing', 'Backed by established collectibles data sources. Know exactly what your card is worth at the grade DCM gave it.')}
            </tr>
            <tr>
              ${renderToolCard('&#128722;', 'DCM InstaList for eBay', 'Titles and descriptions are built automatically from your card&rsquo;s details, leading with condition and grade. Listed in seconds.')}
              ${renderToolCard('&#128218;', 'Collection Reports', 'Track every card&rsquo;s grade, value, and history. Your portfolio in one view, updated as the market moves.')}
            </tr>
          </table>
        </td></tr>
        ${renderMobileCallout({
          headline: 'Grade from anywhere.',
          tagline: 'The DCM app has your full collection, your labels, and your eBay listings. Same account on web, iPhone, and Android.',
          utmCampaign: 'post_grade_social',
        })}
        <tr><td class="pad-mobile-sm" style="padding: 22px 30px 6px 30px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 2px dashed #34d399; border-radius: 12px; overflow: hidden;"><tr>
            <td bgcolor="#f0fdf4" style="padding: 22px 24px;" align="center">
              <p style="color: #059669; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; margin: 0 0 6px 0;">&#127873; Stack Two Offers</p>
              <p style="color: #065f46; font-size: 20px; font-weight: 800; margin: 0 0 8px 0;">10% off + up to 5 bonus credits</p>
              <p style="color: #374151; font-size: 14px; margin: 0 0 14px 0; line-height: 1.5;">Apply <strong>Grade10</strong> at checkout for 10% off any credit pack. First-time buyers also get up to 5 bonus credits added free.</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;"><tr>
                <td bgcolor="#065f46" style="padding: 0; border-radius: 8px;"><a href="https://dcmgrading.com/credits?utm_source=email&utm_medium=email&utm_campaign=post_grade_social&utm_content=promo-code-button" style="display: inline-block; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: 3px; font-family: 'Courier New', Courier, monospace; text-decoration: none; padding: 12px 28px;">Grade10</a></td>
              </tr></table>
            </td>
          </tr></table>
        </td></tr>
        <tr><td class="pad-mobile-sm" style="padding: 18px 30px 30px 30px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0a0f1a" style="border-radius: 10px;"><tr>
            <td align="center" class="pad-mobile" style="padding: 28px 30px;">
              <p style="color: #ffffff; font-size: 20px; margin: 0 0 8px 0; font-weight: 800; line-height: 1.3;">Pick another card to grade</p>
              <p style="color: #d1d5db; font-size: 14px; margin: 0 0 18px 0; line-height: 1.5;">The second grade is usually where it clicks.</p>
              <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://dcmgrading.com/upload?utm_source=email&utm_medium=email&utm_campaign=post_grade_social&utm_content=primary-cta" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="17%" strokecolor="#34d399" fillcolor="#34d399"><w:anchorlock/><center style="color:#0a0f1a;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">Grade My Next Card &rarr;</center></v:roundrect><![endif]-->
              <!--[if !mso]><!-->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="cta-wrap" style="margin: 0 auto;"><tr>
                <td align="center" bgcolor="#34d399" style="border-radius: 8px;"><a href="https://dcmgrading.com/upload?utm_source=email&utm_medium=email&utm_campaign=post_grade_social&utm_content=primary-cta" style="display: inline-block; color: #0a0f1a; text-decoration: none; padding: 14px 36px; font-weight: 800; font-size: 16px; font-family: Arial, Helvetica, sans-serif;">Grade My Next Card &rarr;</a></td>
              </tr></table>
              <!--<![endif]-->
            </td>
          </tr></table>
        </td></tr>
        ${renderFooter('You&rsquo;re getting this because you graded a card with DCM. One or two more emails over the next week, then we&rsquo;ll stop.', data.unsubscribe_url)}
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`;
}

// ============================================================================
// EMAIL 4: LAST CHANCE / GRADE20 (T+7d post-first-grade)
// ============================================================================

export function getLastChanceEmailHtml(data: LastChanceEmailData): string {
  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>Last Chance: 20% Off Expires In 48 Hours &middot; DCM Grading</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .pad-mobile { padding-left: 20px !important; padding-right: 20px !important; }
      .pad-mobile-sm { padding-left: 15px !important; padding-right: 15px !important; }
      .cta-wrap { width: 100% !important; }
      .cta-wrap td { display: block !important; width: 100% !important; text-align: center !important; }
      .cta-wrap a { display: block !important; width: 100% !important; padding: 16px 10px !important; box-sizing: border-box !important; }
      .nav-td a { font-size: 11px !important; padding: 0 5px !important; }
      .hero-h1 { font-size: 26px !important; }
      .pack-col { display: block !important; width: 100% !important; margin-bottom: 12px !important; }
      .vip-left { display: block !important; width: 100% !important; padding-bottom: 16px !important; text-align: center !important; }
      .vip-right { display: block !important; width: 100% !important; text-align: center !important; }
      .badge-stack { display: block !important; width: 100% !important; text-align: center !important; }
      .badge-stack td { display: inline-block !important; padding: 5px !important; }
    }
  </style>
</head>
<body id="body" style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, Helvetica, sans-serif;">
  <div style="display: none; max-height: 0; overflow: hidden;">Your one-time 20% intro discount expires in 48 hours. Stack it with bonus credits and lock in the lowest cost-per-grade DCM offers.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f3f4f6;">
    <tr><td align="center" style="padding: 20px 10px 40px 10px;">
      <!--[if mso]><table role="presentation" align="center" border="0" cellspacing="0" cellpadding="0" width="600"><tr><td width="600"><![endif]-->
      <table role="presentation" class="email-container" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; margin: 0 auto;">
        <tr><td bgcolor="#0a0f1a" style="padding: 0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
            <td width="130" style="padding: 12px 0 12px 20px;" valign="middle"><a href="https://dcmgrading.com/?utm_source=email&utm_medium=email&utm_campaign=post_grade_last_chance&utm_content=nav-logo" style="text-decoration: none;"><img src="https://dcmgrading.com/DCM%20Logo%20white.png" alt="DCM Grading" width="110" style="display: block; width: 110px;"></a></td>
            <td align="right" class="nav-td" style="padding: 12px 20px 12px 0;" valign="middle">
              <a href="https://dcmgrading.com/credits?utm_source=email&utm_medium=email&utm_campaign=post_grade_last_chance&utm_content=nav-credits" style="color: #fbbf24; font-size: 12px; text-decoration: none; padding: 0 8px; font-weight: 700;">Credits</a>
              <a href="https://dcmgrading.com/faq?utm_source=email&utm_medium=email&utm_campaign=post_grade_last_chance&utm_content=nav-faq" style="color: #d1d5db; font-size: 12px; text-decoration: none; padding: 0 8px;">FAQ</a>
              <a href="https://dcmgrading.com/collection?utm_source=email&utm_medium=email&utm_campaign=post_grade_last_chance&utm_content=nav-collection" style="color: #d1d5db; font-size: 12px; text-decoration: none; padding: 0 8px;">My Cards</a>
            </td>
          </tr></table>
        </td></tr>
        <tr><td align="center" bgcolor="#7c2d12" class="pad-mobile" style="padding: 0; background: linear-gradient(135deg, #7c2d12 0%, #b91c1c 100%);">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding: 42px 15px 38px 15px;">
            <p style="color: #fbbf24; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 10px 0;">&#9201; 48 Hours Left</p>
            <h1 class="hero-h1" style="color: #ffffff; font-size: 30px; margin: 0 0 12px 0; font-weight: 800; line-height: 1.2;">Your Intro Discount<br><span style="color: #fbbf24;">Expires Soon</span></h1>
            <p style="color: #fecaca; font-size: 15px; margin: 0 0 8px 0; line-height: 1.6;">Lock in <strong style="color: #fbbf24;">20% off</strong> any credit pack, plus up to 5 bonus<br>credits added free on your first purchase.</p>
          </td></tr></table>
        </td></tr>
        <tr><td class="pad-mobile-sm" style="padding: 30px 30px 6px 30px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 3px dashed #fbbf24; border-radius: 14px; overflow: hidden;"><tr>
            <td bgcolor="#fffbeb" style="padding: 26px 20px;" align="center">
              <p style="color: #b45309; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; margin: 0 0 8px 0;">&#127873; One-Time Code &middot; First Purchase Only</p>
              <p style="color: #78350f; font-size: 14px; margin: 0 0 14px 0; line-height: 1.5;">Apply this code at checkout for the biggest discount we offer new graders:</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto 14px auto;"><tr>
                <td bgcolor="#92400e" style="padding: 0; border-radius: 10px;"><a href="https://dcmgrading.com/credits?promo=GRADE20&utm_source=email&utm_medium=email&utm_campaign=post_grade_last_chance&utm_content=promo-code-button" style="display: inline-block; color: #ffffff; font-size: 32px; font-weight: 800; letter-spacing: 4px; font-family: 'Courier New', Courier, monospace; text-decoration: none; padding: 16px 36px;">GRADE20</a></td>
              </tr></table>
              <p style="color: #92400e; font-size: 13px; margin: 0; font-weight: 600;">Single-use &middot; Expires 48 hours from now</p>
            </td>
          </tr></table>
        </td></tr>
        <tr><td class="pad-mobile" style="padding: 28px 30px 6px 30px;">
          <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 6px 0; font-weight: 700;">What You Actually Get</p>
          <h2 style="color: #111827; font-size: 22px; margin: 0 0 18px 0; font-weight: 800;">More than just a grade.</h2>
        </td></tr>
        <tr><td class="pad-mobile" style="padding: 0 30px 8px 30px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            ${renderCheckRow('Detailed grade reports', 'Three-pass consensus grading with sub-grades for centering, corners, edges, and surface. Defect heatmaps included on every flaw we find.')}
            ${renderCheckRow('Customizable labels for any slab or holder', 'Design labels for slabs, magnetic one-touch holders, and toploaders. Print them with your card&rsquo;s photo, grade, and serial.')}
            ${renderCheckRow('Market pricing from real comparable sales', 'Backed by established collectibles institutions. You see what your card is worth at the grade DCM gave it. Not what someone wishes it was.')}
            ${renderCheckRow('DCM InstaList for eBay', 'Titles and descriptions are built automatically from your card&rsquo;s details, leading with condition and grade. One click and it&rsquo;s listed.')}
          </table>
        </td></tr>
        <tr><td class="pad-mobile" style="padding: 14px 30px 0 30px;"><hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 0;"></td></tr>
        <tr><td class="pad-mobile" style="padding: 26px 30px 6px 30px;">
          <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 6px 0; font-weight: 700;">After Your 20% Off</p>
          <h3 style="color: #111827; font-size: 18px; margin: 0 0 14px 0; font-weight: 800;">Cost per grade with GRADE20 applied</h3>
        </td></tr>
        <tr><td class="pad-mobile" style="padding: 0 30px 8px 30px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
            ${renderTierCard('Basic', '$2.39', '2 credits with bonus', '~$1.19 / grade', false, 'tier-basic')}
            ${renderTierCard('Pro &middot; Best Value', '$7.99', '8 credits with bonus', '~$1.00 / grade', true, 'tier-pro')}
            ${renderTierCard('Elite', '$15.99', '25 credits with bonus', '~$0.64 / grade', false, 'tier-elite')}
          </tr></table>
          <p align="center" style="color: #9ca3af; font-size: 11px; margin: 14px 0 0 0;">Prices after GRADE20 discount + first-purchase bonus credits. Credits never expire.</p>
        </td></tr>
        <tr><td class="pad-mobile" style="padding: 18px 30px 6px 30px;">
          <a href="https://dcmgrading.com/credits?promo=GRADE20&utm_source=email&utm_medium=email&utm_campaign=post_grade_last_chance&utm_content=tier-vip" style="text-decoration: none; color: inherit; display: block;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-radius: 12px; overflow: hidden;"><tr>
            <td bgcolor="#1e1b4b" style="padding: 24px 26px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
                <td valign="middle" class="vip-left">
                  <p style="color: #fbbf24; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; margin: 0 0 6px 0;">&#128081; VIP Package &middot; Top Tier</p>
                  <p style="color: #ffffff; font-size: 22px; font-weight: 800; margin: 0 0 6px 0; line-height: 1.25;">150 credits, biggest savings.</p>
                  <p style="color: #c4b5fd; font-size: 13px; margin: 0; line-height: 1.6;">The lowest cost per grade DCM offers. Built for serious collectors and dealers.</p>
                </td>
                <td valign="middle" align="right" width="160" class="vip-right">
                  <p style="color: #c4b5fd; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; margin: 0 0 4px 0;">After GRADE20</p>
                  <p style="color: #ffffff; font-size: 32px; font-weight: 800; margin: 0 0 4px 0; line-height: 1; font-family: Arial Black, Arial, sans-serif;">$79.20</p>
                  <p style="color: #9ca3af; font-size: 12px; margin: 0 0 8px 0; text-decoration: line-through;">$99.00</p>
                  <p style="color: #fbbf24; font-size: 13px; font-weight: 800; margin: 0;">~$0.53 / grade</p>
                </td>
              </tr></table>
            </td>
          </tr></table>
          </a>
          <p align="center" style="color: #9ca3af; font-size: 11px; margin: 12px 0 0 0;">VIP includes 150 credits flat. Credits never expire.</p>
        </td></tr>
        <tr><td class="pad-mobile-sm" style="padding: 22px 30px 30px 30px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#7c2d12" style="border-radius: 10px;"><tr>
            <td align="center" class="pad-mobile" style="padding: 28px 30px;">
              <p style="color: #ffffff; font-size: 20px; margin: 0 0 8px 0; font-weight: 800; line-height: 1.3;">Lock in 20% off</p>
              <p style="color: #fecaca; font-size: 14px; margin: 0 0 6px 0; line-height: 1.5;">Code <strong style="color: #fbbf24;">GRADE20</strong> applies automatically at the link below.</p>
              <p style="color: #fde68a; font-size: 12px; margin: 0 0 18px 0; font-weight: 700;">Single-use &middot; First purchase only &middot; 48 hours to redeem</p>
              <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://dcmgrading.com/credits?promo=GRADE20&utm_source=email&utm_medium=email&utm_campaign=post_grade_last_chance&utm_content=primary-cta" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="17%" strokecolor="#fbbf24" fillcolor="#fbbf24"><w:anchorlock/><center style="color:#7c2d12;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">Redeem 20% Off Now &rarr;</center></v:roundrect><![endif]-->
              <!--[if !mso]><!-->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="cta-wrap" style="margin: 0 auto;"><tr>
                <td align="center" bgcolor="#fbbf24" style="border-radius: 8px;"><a href="https://dcmgrading.com/credits?promo=GRADE20&utm_source=email&utm_medium=email&utm_campaign=post_grade_last_chance&utm_content=primary-cta" style="display: inline-block; color: #7c2d12; text-decoration: none; padding: 14px 36px; font-weight: 800; font-size: 16px; font-family: Arial, Helvetica, sans-serif;">Redeem 20% Off Now &rarr;</a></td>
              </tr></table>
              <!--<![endif]-->
            </td>
          </tr></table>
        </td></tr>
        ${renderMobileCallout({
          headline: 'Buy credits in the app too.',
          tagline: 'GRADE20 works the same way. Same account, same balance, same Label Studio. Pick up where you left off on your phone.',
          utmCampaign: 'post_grade_last_chance',
        })}
        ${renderFooter('After this email you&rsquo;ll hear from us once more in a week, then we&rsquo;ll stop.', data.unsubscribe_url)}
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`;
}

// ============================================================================
// EMAIL 5: WINBACK (T+14d, daily cron, pre-grants 1 credit on send)
// ============================================================================

export function getWinbackEmailHtml(data: WinbackEmailData): string {
  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>Your Collection Is Waiting &middot; DCM Grading</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .pad-mobile { padding-left: 20px !important; padding-right: 20px !important; }
      .pad-mobile-sm { padding-left: 15px !important; padding-right: 15px !important; }
      .cta-wrap { width: 100% !important; }
      .cta-wrap td { display: block !important; width: 100% !important; text-align: center !important; }
      .cta-wrap a { display: block !important; width: 100% !important; padding: 16px 10px !important; box-sizing: border-box !important; }
      .nav-td a { font-size: 11px !important; padding: 0 5px !important; }
      .hero-h1 { font-size: 24px !important; }
      .saved-card-col { display: block !important; width: 100% !important; max-width: 320px !important; margin: 0 auto 20px auto !important; }
      .miss-col { display: block !important; width: 100% !important; margin-bottom: 12px !important; }
      .badge-stack { display: block !important; width: 100% !important; text-align: center !important; }
      .badge-stack td { display: inline-block !important; padding: 5px !important; }
    }
  </style>
</head>
<body id="body" style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, Helvetica, sans-serif;">
  <div style="display: none; max-height: 0; overflow: hidden;">We saved your work. Your free credit is already in your account. Come back and pick up where you left off.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f3f4f6;">
    <tr><td align="center" style="padding: 20px 10px 40px 10px;">
      <!--[if mso]><table role="presentation" align="center" border="0" cellspacing="0" cellpadding="0" width="600"><tr><td width="600"><![endif]-->
      <table role="presentation" class="email-container" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%; background-color: #ffffff; margin: 0 auto;">
        <tr><td bgcolor="#0a0f1a" style="padding: 0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
            <td width="130" style="padding: 12px 0 12px 20px;" valign="middle"><a href="https://dcmgrading.com/?utm_source=email&utm_medium=email&utm_campaign=post_grade_winback&utm_content=nav-logo" style="text-decoration: none;"><img src="https://dcmgrading.com/DCM%20Logo%20white.png" alt="DCM Grading" width="110" style="display: block; width: 110px;"></a></td>
            <td align="right" class="nav-td" style="padding: 12px 20px 12px 0;" valign="middle">
              <a href="https://dcmgrading.com/collection?utm_source=email&utm_medium=email&utm_campaign=post_grade_winback&utm_content=nav-collection" style="color: #34d399; font-size: 12px; text-decoration: none; padding: 0 8px; font-weight: 700;">My Collection</a>
              <a href="https://dcmgrading.com/credits?utm_source=email&utm_medium=email&utm_campaign=post_grade_winback&utm_content=nav-credits" style="color: #d1d5db; font-size: 12px; text-decoration: none; padding: 0 8px;">Credits</a>
            </td>
          </tr></table>
        </td></tr>
        <tr><td align="center" bgcolor="#0a0f1a" class="pad-mobile" style="padding: 0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding: 40px 15px 35px 15px;">
            <p style="color: #34d399; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 10px 0;">&#128173; We Saved Your Spot</p>
            <h1 class="hero-h1" style="color: #ffffff; font-size: 28px; margin: 0 0 12px 0; font-weight: 800; line-height: 1.25;">Your Collection<br><span style="color: #34d399;">Is Still Here</span></h1>
            <p style="color: #9ca3af; font-size: 15px; margin: 0 0 8px 0; line-height: 1.6;">It&rsquo;s been a couple of weeks. Your graded card<br>is still in your collection, right where you left it.</p>
          </td></tr></table>
        </td></tr>
        <tr><td class="pad-mobile" style="padding: 35px 30px 20px 30px;" bgcolor="#ffffff">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
            <td width="45%" align="center" valign="top" class="saved-card-col" style="padding: 0 12px 0 0;">
              <div style="position: relative;"><img src="${data.front_image_url}" alt="Your graded card" width="220" style="display: block; width: 100%; max-width: 220px; height: auto; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.15);"></div>
              <p style="color: #6b7280; font-size: 12px; margin: 12px 0 0 0; font-style: italic;">${data.card_name}</p>
              <p style="color: #059669; font-size: 14px; font-weight: 700; margin: 4px 0 0 0;">Grade ${data.final_grade}</p>
            </td>
            <td width="55%" valign="middle" class="saved-card-col">
              <p style="color: #111827; font-size: 18px; font-weight: 800; margin: 0 0 10px 0; line-height: 1.4;">Pick up where you left off.</p>
              <p style="color: #4b5563; font-size: 14px; margin: 0 0 14px 0; line-height: 1.7;">You already have a graded card, which means your label is ready to design, the market price is being tracked, and your eBay listing is one click away.</p>
              <p style="color: #4b5563; font-size: 14px; margin: 0; line-height: 1.7;">A lot of graders don&rsquo;t come back until they realize what they can do with the cards they&rsquo;ve already graded. So here&rsquo;s a nudge.</p>
            </td>
          </tr></table>
        </td></tr>
        <tr><td bgcolor="#059669" style="padding: 0;">
          <a href="https://dcmgrading.com/upload?utm_source=email&utm_medium=email&utm_campaign=post_grade_winback&utm_content=free-credit-banner" style="display: block; text-decoration: none; padding: 20px 24px;">
            <p style="color: #ffffff; font-size: 17px; font-weight: 800; margin: 0 0 4px 0; text-align: center;">&#127873; 1 FREE credit added to your account</p>
            <p style="color: #d1fae5; font-size: 13px; margin: 0; text-align: center;">Grade another card on us. No purchase required.</p>
          </a>
        </td></tr>
        ${renderMobileCallout({
          headline: 'Want to make coming back easy?',
          tagline: 'The DCM app remembers everything. Open it, snap a card, get your grade in minutes.',
          utmCampaign: 'post_grade_winback',
        })}
        <tr><td class="pad-mobile" style="padding: 30px 30px 6px 30px;">
          <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 6px 0; font-weight: 700;">Things You Haven&rsquo;t Tried Yet</p>
          <h2 style="color: #111827; font-size: 22px; margin: 0 0 16px 0; font-weight: 800;">What&rsquo;s waiting in your collection</h2>
        </td></tr>
        <tr><td class="pad-mobile" style="padding: 0 30px 8px 30px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
            ${renderMissCard('&#127991;&#65039;', 'Design Your Label', 'Custom labels for slabs, magnetic holders, and toploaders.')}
            ${renderMissCard('&#128176;', 'Check The Price', 'Market value from real comparable sales, updated daily.')}
            ${renderMissCard('&#128722;', 'List On eBay', 'DCM InstaList builds your listing in seconds.')}
          </tr></table>
        </td></tr>
        <tr><td class="pad-mobile-sm" style="padding: 26px 30px 22px 30px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0a0f1a" style="border-radius: 10px;"><tr>
            <td align="center" class="pad-mobile" style="padding: 28px 30px;">
              <p style="color: #ffffff; font-size: 20px; margin: 0 0 8px 0; font-weight: 800; line-height: 1.3;">Use your free credit</p>
              <p style="color: #d1d5db; font-size: 14px; margin: 0 0 18px 0; line-height: 1.5;">No payment details, no commitment. Just grade and see what comes back.</p>
              <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="https://dcmgrading.com/upload?utm_source=email&utm_medium=email&utm_campaign=post_grade_winback&utm_content=primary-cta" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="17%" strokecolor="#34d399" fillcolor="#34d399"><w:anchorlock/><center style="color:#0a0f1a;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">Grade A Card Free &rarr;</center></v:roundrect><![endif]-->
              <!--[if !mso]><!-->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="cta-wrap" style="margin: 0 auto;"><tr>
                <td align="center" bgcolor="#34d399" style="border-radius: 8px;"><a href="https://dcmgrading.com/upload?utm_source=email&utm_medium=email&utm_campaign=post_grade_winback&utm_content=primary-cta" style="display: inline-block; color: #0a0f1a; text-decoration: none; padding: 14px 36px; font-weight: 800; font-size: 16px; font-family: Arial, Helvetica, sans-serif;">Grade A Card Free &rarr;</a></td>
              </tr></table>
              <!--<![endif]-->
            </td>
          </tr></table>
        </td></tr>
        <tr><td class="pad-mobile" style="padding: 0 30px 30px 30px;" align="center">
          <p style="color: #6b7280; font-size: 13px; margin: 0;">Just want to see your card? <a href="https://dcmgrading.com/collection?utm_source=email&utm_medium=email&utm_campaign=post_grade_winback&utm_content=view-collection" style="color: #059669; text-decoration: underline; font-weight: 700;">Open your collection &rarr;</a></p>
        </td></tr>
        ${renderFooter('This is the last email in this series. We won&rsquo;t bother you again unless you grade another card.', data.unsubscribe_url)}
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`;
}

// ============================================================================
// SHARED RENDERERS (kept inside the module — only used by templates above)
// ============================================================================

function renderSubGradeRow(label: string, summary: string, score: string, borderColor: string, labelColor: string, description: string, last: boolean = false): string {
  const bottomPad = last ? '22px' : '14px';
  return `<tr><td class="pad-mobile" style="padding: 0 30px ${bottomPad} 30px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f9fafb" style="border-radius: 10px; border-left: 4px solid ${borderColor};"><tr>
      <td style="padding: 18px 22px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
          <td>
            <p style="color: ${labelColor}; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; margin: 0 0 2px 0;">${label}</p>
            <p style="color: #111827; font-size: 16px; font-weight: 700; margin: 0;">${summary}</p>
          </td>
          <td align="right" valign="top" width="80">
            <p style="color: #111827; font-size: 32px; font-weight: 800; margin: 0; line-height: 1; font-family: Arial Black, Arial, sans-serif;">${score}</p>
          </td>
        </tr></table>
        <p style="color: #4b5563; font-size: 13px; line-height: 1.6; margin: 10px 0 0 0;">${description}</p>
      </td>
    </tr></table>
  </td></tr>`;
}

function renderFeatureRow(emoji: string, title: string, body: string): string {
  return `<tr>
    <td width="60" valign="top" style="padding: 4px 14px 0 0;">
      <div style="background-color: #ecfdf5; border-radius: 50%; width: 44px; height: 44px; line-height: 44px; text-align: center; color: #059669; font-size: 22px; font-weight: 800;">${emoji}</div>
    </td>
    <td valign="top" style="padding: 2px 0 16px 0;">
      <p style="color: #111827; font-size: 15px; font-weight: 700; margin: 0 0 4px 0;">${title}</p>
      <p style="color: #6b7280; font-size: 13px; margin: 0; line-height: 1.6;">${body}</p>
    </td>
  </tr>`;
}

function renderFeaturedCard(url: string, image: string, name: string, subtitle: string, grade: string, utmContent: string): string {
  return `<td width="33%" align="center" valign="top" class="feat-col" style="padding: 0 6px;">
    <a href="${url}?utm_source=email&utm_medium=email&utm_campaign=post_grade_social&utm_content=${utmContent}" style="text-decoration: none; color: inherit;">
      <img src="${image}" alt="${name} graded card" width="170" style="display: block; width: 100%; max-width: 170px; height: auto; border-radius: 8px;">
      <p style="color: #111827; font-size: 13px; font-weight: 700; margin: 10px 0 2px 0;">${name}</p>
      <p style="color: #6b7280; font-size: 11px; margin: 2px 0 0 0;">${subtitle}</p>
      <p style="color: #059669; font-size: 13px; font-weight: 700; margin: 4px 0 0 0;">Grade ${grade}</p>
    </a>
  </td>`;
}

function renderToolCard(emoji: string, title: string, body: string): string {
  return `<td width="50%" valign="top" class="tool-col" style="padding: 0 6px 12px 6px;">
    <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 18px 18px;">
      <p style="color: #059669; font-size: 22px; margin: 0 0 6px 0;">${emoji}</p>
      <p style="color: #111827; font-size: 15px; font-weight: 700; margin: 0 0 4px 0;">${title}</p>
      <p style="color: #6b7280; font-size: 13px; margin: 0; line-height: 1.6;">${body}</p>
    </div>
  </td>`;
}

function renderCheckRow(title: string, body: string): string {
  return `<tr>
    <td width="50" valign="top" style="padding: 4px 12px 0 0;">
      <div style="background-color: #fef3c7; border-radius: 50%; width: 38px; height: 38px; line-height: 38px; text-align: center; color: #b45309; font-size: 20px; font-weight: 800;">&#10003;</div>
    </td>
    <td valign="top" style="padding: 4px 0 14px 0;">
      <p style="color: #111827; font-size: 15px; font-weight: 700; margin: 0 0 2px 0;">${title}</p>
      <p style="color: #6b7280; font-size: 13px; margin: 0; line-height: 1.6;">${body}</p>
    </td>
  </tr>`;
}

function renderTierCard(label: string, price: string, credits: string, perGrade: string, highlighted: boolean, utmContent: string): string {
  const bg = highlighted ? '#fffbeb' : '#f9fafb';
  const border = highlighted ? '2px solid #fbbf24' : '1px solid #e5e7eb';
  const labelColor = highlighted ? '#b45309' : '#6b7280';
  return `<td width="33%" valign="top" class="pack-col" style="padding: 0 6px;">
    <a href="https://dcmgrading.com/credits?promo=GRADE20&utm_source=email&utm_medium=email&utm_campaign=post_grade_last_chance&utm_content=${utmContent}" style="text-decoration: none; color: inherit; display: block;">
      <div style="background-color: ${bg}; border: ${border}; border-radius: 10px; padding: 18px 14px; text-align: center;">
        <p style="color: ${labelColor}; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; margin: 0 0 6px 0;">${label}</p>
        <p style="color: #111827; font-size: 22px; font-weight: 800; margin: 0 0 4px 0;">${price}</p>
        <p style="color: #6b7280; font-size: 12px; margin: 0 0 8px 0;">${credits}</p>
        <p style="color: #059669; font-size: 12px; font-weight: 700; margin: 0;">${perGrade}</p>
      </div>
    </a>
  </td>`;
}

function renderMissCard(emoji: string, title: string, body: string): string {
  return `<td width="33%" align="center" valign="top" class="miss-col" style="padding: 0 6px;">
    <div style="background-color: #f9fafb; border-radius: 10px; padding: 22px 14px;">
      <p style="color: #059669; font-size: 28px; margin: 0 0 8px 0;">${emoji}</p>
      <p style="color: #111827; font-size: 14px; font-weight: 700; margin: 0 0 4px 0;">${title}</p>
      <p style="color: #6b7280; font-size: 12px; margin: 0; line-height: 1.6;">${body}</p>
    </div>
  </td>`;
}

/**
 * Cross-platform mobile callout. Renders a soft-gray section with
 * Web · iPhone · Android positioning, Apple + Google badge images
 * (already hosted in /public/app-store-badge), and a text fallback row
 * for clients that block images. Used by every email in the series.
 */
function renderMobileCallout(opts: {
  headline: string;
  tagline: string;
  utmCampaign: string;
}): string {
  const apple = `https://apps.apple.com/us/app/dcm-grading/id6768663163`;
  const google = `https://play.google.com/store/apps/details?id=com.dcmgrading.app`;
  const utm = (c: string) => `utm_source=email&utm_medium=email&utm_campaign=${opts.utmCampaign}&utm_content=${c}`;
  return `<tr><td class="pad-mobile" style="padding: 26px 30px 26px 30px; background-color: #f9fafb;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
      <td align="center">
        <p style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; margin: 0 0 6px 0;">&#128241; Web &middot; iPhone &middot; Android</p>
        <p style="color: #111827; font-size: 17px; font-weight: 800; margin: 0 0 6px 0; line-height: 1.3;">${opts.headline}</p>
        <p style="color: #6b7280; font-size: 13px; margin: 0 0 16px 0; line-height: 1.6;">${opts.tagline}</p>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="badge-stack" style="margin: 0 auto 10px auto;"><tr>
          <td align="center" valign="middle" style="padding: 0 6px;">
            <a href="${apple}?${utm('mobile-badge-apple')}" style="text-decoration: none;"><img src="https://dcmgrading.com/app-store-badge/Download_on_the_App_Store_Badge_US-UK_RGB_blk.png" alt="Download on the App Store" width="160" height="54" style="display: block; width: 160px; height: 54px;"></a>
          </td>
          <td align="center" valign="middle" style="padding: 0 6px;">
            <a href="${google}&${utm('mobile-badge-google')}" style="text-decoration: none;"><img src="https://dcmgrading.com/app-store-badge/GetItOnGooglePlay_Badge_Web_color_English.png" alt="Get it on Google Play" width="160" height="48" style="display: block; width: 160px; height: 48px;"></a>
          </td>
        </tr></table>
        <p style="color: #9ca3af; font-size: 11px; margin: 0; line-height: 1.5;">Already in your browser? <a href="https://dcmgrading.com/upload?${utm('mobile-web-link')}" style="color: #059669; text-decoration: underline; font-weight: 700;">Use DCM on the web</a> &middot; <a href="${apple}?${utm('mobile-text-apple')}" style="color: #6b7280; text-decoration: underline;">App Store</a> &middot; <a href="${google}&${utm('mobile-text-google')}" style="color: #6b7280; text-decoration: underline;">Google Play</a></p>
      </td>
    </tr></table>
  </td></tr>`;
}

function renderFooter(intro: string, unsubscribeUrl: string): string {
  return `<tr><td bgcolor="#f9fafb" style="padding: 28px 30px; border-top: 1px solid #e5e7eb;">
    <p style="color: #6b7280; font-size: 12px; line-height: 1.6; margin: 0 0 12px 0; text-align: center;">${intro}</p>
    <p style="color: #9ca3af; font-size: 11px; line-height: 1.6; margin: 0; text-align: center;">DCM Grading &middot; <a href="https://dcmgrading.com" style="color: #9ca3af; text-decoration: underline;">dcmgrading.com</a> &middot; <a href="${unsubscribeUrl}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a></p>
  </td></tr>`;
}

// ============================================================================
// CATEGORY → ROUTE SLUG MAPPING
// Used by the cron handler to build the View Full Report link in Email 2.
// Mirrors the upload page's CARD_TYPES route values.
// ============================================================================

export function categoryToRouteSlug(category: string | null | undefined): string {
  if (!category) return 'other';
  const c = category.toLowerCase();
  if (c === 'pokemon') return 'pokemon';
  if (c === 'mtg' || c === 'magic') return 'mtg';
  if (c === 'lorcana') return 'lorcana';
  if (c === 'one piece' || c === 'onepiece') return 'onepiece';
  if (c === 'yu-gi-oh' || c === 'yugioh') return 'yugioh';
  if (c === 'star wars' || c === 'starwars') return 'starwars';
  // Sports sub-categories all route to /sports
  if (['sports', 'football', 'baseball', 'basketball', 'hockey', 'soccer'].includes(c)) return 'sports';
  return 'other';
}
