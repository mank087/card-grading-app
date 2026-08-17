/**
 * Enterprise lead capture from the public /enterprise page.
 * Writes to enterprise_leads and notifies admin via Resend.
 *
 * Public + unauthenticated, so: per-IP rate limited (3 per 10 min), all
 * interpolated fields HTML-escaped in the admin email, case-insensitive
 * dupe guard on email.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { checkRateLimit, getRateLimitIdentifier, createRateLimitResponse } from '@/lib/rateLimit'
import { Resend } from 'resend'

export const runtime = 'nodejs'

const resend = new Resend(process.env.RESEND_API_KEY)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// 3 submissions per 10 minutes per IP
const LEAD_RATE_LIMIT = { maxRequests: 3, windowSeconds: 600 }

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function POST(request: NextRequest) {
  try {
    // Per-IP rate limit — this endpoint is unauthenticated.
    const rate = checkRateLimit(
      `enterprise-lead:${getRateLimitIdentifier(null, request)}`,
      LEAD_RATE_LIMIT
    )
    if (!rate.allowed) {
      return NextResponse.json(createRateLimitResponse(rate), { status: 429 })
    }

    const body = await request.json()
    const storeName = String(body.storeName || '').trim().slice(0, 200)
    const contactName = String(body.contactName || '').trim().slice(0, 200)
    const email = String(body.email || '').trim().toLowerCase().slice(0, 320)
    const monthlyVolume = String(body.monthlyVolume || '').trim().slice(0, 100)
    const message = String(body.message || '').trim().slice(0, 2000)

    if (!storeName) return NextResponse.json({ error: 'Store name is required' }, { status: 400 })
    if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })

    // Light dupe guard: one open lead per email, case-insensitive
    // (older rows may have mixed case; % and _ escaped for ilike).
    const { data: existing } = await supabaseAdmin
      .from('enterprise_leads')
      .select('id')
      .ilike('email', email.replace(/[\\%_]/g, '\\$&'))
      .eq('status', 'new')
      .limit(1)
    if (existing && existing.length > 0) {
      return NextResponse.json({ success: true, duplicate: true })
    }

    const { error } = await supabaseAdmin.from('enterprise_leads').insert({
      store_name: storeName,
      contact_name: contactName || null,
      email,
      monthly_volume: monthlyVolume || null,
      message: message || null,
    })
    if (error) {
      console.error('[enterprise/lead] insert error:', error)
      return NextResponse.json({ error: 'Failed to submit — please try again' }, { status: 500 })
    }

    // Notify admin (fire-and-forget; the lead row is the source of truth).
    // Every interpolated field is attacker-controlled — escape all of them.
    try {
      await resend.emails.send({
        from: 'DCM Grading <noreply@dcmgrading.com>',
        to: ['admin@dcmgrading.com'],
        replyTo: email,
        subject: `Enterprise inquiry: ${storeName}`,
        html: `
          <h2>New enterprise lead</h2>
          <p><strong>Store:</strong> ${escapeHtml(storeName)}</p>
          <p><strong>Contact:</strong> ${escapeHtml(contactName) || '—'}</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p><strong>Monthly volume:</strong> ${escapeHtml(monthlyVolume) || '—'}</p>
          <p><strong>Message:</strong></p>
          <p>${message ? escapeHtml(message) : '—'}</p>
        `,
      })
    } catch (emailErr) {
      console.error('[enterprise/lead] notification email failed (lead saved):', emailErr)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[enterprise/lead] error:', err)
    return NextResponse.json({ error: 'Failed to submit — please try again' }, { status: 500 })
  }
}
