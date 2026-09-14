/**
 * Affiliate Program Emails
 *
 * Two sends live here:
 *  1. sendAffiliateApplicationEmails — admin notification + applicant confirmation
 *     when someone applies from /affiliates.
 *  2. sendAffiliateWelcomeEmail — the approved partner's code, link and reward terms.
 *
 * Neither function ever throws. The application row (or the affiliate row) is the
 * source of truth; a Resend outage must not fail the caller's request.
 */

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = 'DCM Grading <admin@dcmgrading.com>'
const ADMIN_EMAIL = 'admin@dcmgrading.com'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function row(label: string, value: string | null | undefined): string {
  return `
    <tr>
      <td style="padding: 8px 12px 8px 0; font-weight: bold; color: #374151; vertical-align: top; white-space: nowrap;">${escapeHtml(label)}</td>
      <td style="padding: 8px 0; color: #1f2937;">${value ? escapeHtml(value) : 'Not provided'}</td>
    </tr>`
}

function shell(inner: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
      ${inner}
      <hr style="margin-top: 30px; border: none; border-top: 1px solid #e5e7eb;" />
      <p style="color: #6b7280; font-size: 12px; margin-top: 15px;">
        DCM Grading, Dynamic Collectibles Management LLC. <a href="https://dcmgrading.com" style="color: #7c3aed;">dcmgrading.com</a>
      </p>
    </div>`
}

export async function sendAffiliateApplicationEmails(app: {
  name: string
  email: string
  channel?: string | null
  channelUrl?: string | null
  audienceSize?: string | null
  promotionPlan?: string | null
}): Promise<void> {
  const { name, email, channel, channelUrl, audienceSize, promotionPlan } = app

  // 1. Admin notification
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: [ADMIN_EMAIL],
      replyTo: email,
      subject: `Affiliate application: ${name}`,
      html: shell(`
        <h2 style="color: #7c3aed; border-bottom: 2px solid #7c3aed; padding-bottom: 10px;">
          New affiliate application
        </h2>
        <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
          ${row('Name:', name)}
          ${row('Email:', email)}
          ${row('Channel:', channel)}
          ${row('Channel URL:', channelUrl)}
          ${row('Audience size:', audienceSize)}
        </table>
        <h3 style="color: #374151; margin-bottom: 10px;">How they plan to promote</h3>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; white-space: pre-wrap;">${promotionPlan ? escapeHtml(promotionPlan) : 'Not provided'}</div>
        <p style="margin-top: 20px;">
          <a href="https://dcmgrading.com/admin/affiliates" style="color: #7c3aed; font-weight: bold;">Review in the admin dashboard</a>
        </p>
      `),
    })
    if (error) {
      console.error('[AffiliateEmails] Admin notification Resend error:', error)
    }
  } catch (err) {
    console.error('[AffiliateEmails] Admin notification threw:', err)
  }

  // 2. Applicant confirmation
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: [email],
      subject: 'We received your DCM Grading affiliate application',
      html: shell(`
        <h2 style="color: #7c3aed;">Thanks for applying, ${escapeHtml(name)}</h2>
        <p style="font-size: 15px; line-height: 1.6;">
          We have your application for the DCM Grading affiliate program and we are reviewing it now.
        </p>
        <div style="background-color: #f5f3ff; border-radius: 12px; padding: 18px; margin: 20px 0;">
          <h3 style="color: #4c1d95; margin: 0 0 10px 0;">How the program works</h3>
          <ul style="margin: 0; padding-left: 20px; line-height: 1.7; color: #1f2937;">
            <li>Your audience gets <strong>15% off their first purchase</strong> with your code or link.</li>
            <li>You earn <strong>20 grading credits</strong> every time a new customer you referred makes their first paid purchase.</li>
            <li>Your referral link is tracked for 30 days, so you still get credit if they buy later.</li>
          </ul>
        </div>
        <p style="font-size: 15px; line-height: 1.6;">
          We reply to every application within a few business days. If you are approved we will send your code and link in that same email.
        </p>
        <p style="font-size: 15px; line-height: 1.6;">
          Questions in the meantime? Just reply to this email.
        </p>
      `),
    })
    if (error) {
      console.error('[AffiliateEmails] Applicant confirmation Resend error:', error)
    }
  } catch (err) {
    console.error('[AffiliateEmails] Applicant confirmation threw:', err)
  }
}

export async function sendAffiliateWelcomeEmail(a: {
  name: string
  email: string
  code: string
  discountPercent: number
  rewardCredits: number
}): Promise<void> {
  const { name, email, code, discountPercent, rewardCredits } = a
  const link = `https://dcmgrading.com/?ref=${code}`

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: [email],
      subject: 'You are in. Your DCM Grading affiliate code is ready',
      html: shell(`
        <h2 style="color: #7c3aed;">Welcome to the program, ${escapeHtml(name)}</h2>
        <p style="font-size: 15px; line-height: 1.6;">
          You are approved as a DCM Grading affiliate. Here is everything you need to start sharing.
        </p>

        <div style="background-color: #f5f3ff; border-radius: 12px; padding: 18px; margin: 20px 0; text-align: center;">
          <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #6d28d9; font-weight: bold;">Your code</div>
          <div style="font-size: 30px; font-weight: bold; color: #4c1d95; font-family: monospace; margin: 8px 0;">${escapeHtml(code)}</div>
          <div style="font-size: 14px; color: #4b5563;">
            Your link: <a href="${escapeHtml(link)}" style="color: #7c3aed;">${escapeHtml(link)}</a>
          </div>
        </div>

        <h3 style="color: #374151;">How the reward works</h3>
        <ul style="line-height: 1.7; padding-left: 20px;">
          <li>Anyone who uses your link or enters your code at checkout gets <strong>${discountPercent}% off their first purchase</strong>.</li>
          <li>When a new customer you referred makes their first paid purchase, <strong>${rewardCredits} grading credits</strong> land in your account.</li>
          <li>Your link is tracked for 30 days, so you still get credit if they come back later to buy.</li>
          <li>Credits are grading credits, not cash. Use them on your own cards or give them away.</li>
        </ul>

        <p style="text-align: center; margin: 28px 0;">
          <a href="https://dcmgrading.com/account" style="display: inline-block; background-color: #7c3aed; color: #ffffff; text-decoration: none; font-weight: bold; padding: 14px 28px; border-radius: 10px;">
            See your referral stats
          </a>
        </p>
        <p style="font-size: 14px; color: #4b5563; line-height: 1.6;">
          Your clicks, referrals and earned credits show on your <a href="https://dcmgrading.com/account" style="color: #7c3aed;">account page</a>. Reply to this email any time you need assets or have a question.
        </p>
      `),
    })
    if (error) {
      console.error('[AffiliateEmails] Welcome Resend error:', error)
    }
  } catch (err) {
    console.error('[AffiliateEmails] Welcome email threw:', err)
  }
}
