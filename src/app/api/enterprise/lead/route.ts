/**
 * Enterprise lead capture from the public /enterprise page.
 * Writes to enterprise_leads and notifies admin via Resend.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { Resend } from 'resend'

export const runtime = 'nodejs'

const resend = new Resend(process.env.RESEND_API_KEY)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const storeName = String(body.storeName || '').trim().slice(0, 200)
    const contactName = String(body.contactName || '').trim().slice(0, 200)
    const email = String(body.email || '').trim().toLowerCase().slice(0, 320)
    const monthlyVolume = String(body.monthlyVolume || '').trim().slice(0, 100)
    const message = String(body.message || '').trim().slice(0, 2000)

    if (!storeName) return NextResponse.json({ error: 'Store name is required' }, { status: 400 })
    if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })

    // Light dupe guard: one open lead per email
    const { data: existing } = await supabaseAdmin
      .from('enterprise_leads')
      .select('id')
      .eq('email', email)
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

    // Notify admin (fire-and-forget; the lead row is the source of truth)
    try {
      await resend.emails.send({
        from: 'DCM Grading <noreply@dcmgrading.com>',
        to: ['admin@dcmgrading.com'],
        replyTo: email,
        subject: `Enterprise inquiry: ${storeName}`,
        html: `
          <h2>New enterprise lead</h2>
          <p><strong>Store:</strong> ${storeName}</p>
          <p><strong>Contact:</strong> ${contactName || '—'}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Monthly volume:</strong> ${monthlyVolume || '—'}</p>
          <p><strong>Message:</strong></p>
          <p>${message ? message.replace(/</g, '&lt;') : '—'}</p>
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
