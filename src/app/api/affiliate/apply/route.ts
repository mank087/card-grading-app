/**
 * Public affiliate application intake from /affiliates.
 *
 * Unauthenticated, so: honeypot field, per-IP rate limit, field length caps.
 * The affiliate_applications row is the source of truth. If the notification
 * emails fail we still return ok:true because the application is saved.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendAffiliateApplicationEmails } from '@/lib/affiliateEmails'

export const runtime = 'nodejs'

// Simple in-memory rate limiting (resets on server restart)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_MAX = 5 // Max 5 requests
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // Per hour

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return false
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return true
  }

  record.count++
  return false
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown'

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Honeypot: real people never fill this in.
    if (String(body.website || '').trim() !== '') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const name = String(body.name || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const channel = String(body.channel || '').trim().slice(0, 100)
    const channelUrl = String(body.channelUrl || '').trim().slice(0, 500)
    const audienceSize = String(body.audienceSize || '').trim().slice(0, 100)
    const promotionPlan = String(body.promotionPlan || '').trim()

    if (name.length < 2 || name.length > 80) {
      return NextResponse.json(
        { error: 'Please enter your name (2 to 80 characters)' },
        { status: 400 }
      )
    }

    if (email.length > 254 || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      )
    }

    if (promotionPlan.length > 2000) {
      return NextResponse.json(
        { error: 'Please keep your promotion plan under 2,000 characters' },
        { status: 400 }
      )
    }

    const { error: insertError } = await supabaseAdmin
      .from('affiliate_applications')
      .insert({
        name,
        email,
        channel: channel || null,
        channel_url: channelUrl || null,
        audience_size: audienceSize || null,
        promotion_plan: promotionPlan || null,
        status: 'new',
      })

    if (insertError) {
      console.error('[affiliate/apply] insert error:', insertError)
      return NextResponse.json(
        { error: 'Could not submit your application. Please try again.' },
        { status: 500 }
      )
    }

    // Emails never throw, but keep the row authoritative regardless.
    await sendAffiliateApplicationEmails({
      name,
      email,
      channel: channel || null,
      channelUrl: channelUrl || null,
      audienceSize: audienceSize || null,
      promotionPlan: promotionPlan || null,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[affiliate/apply] error:', err)
    return NextResponse.json(
      { error: 'Could not submit your application. Please try again.' },
      { status: 500 }
    )
  }
}
