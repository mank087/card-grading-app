import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * Server-side consent audit log (2026-07-18).
 *
 * Records every cookie-consent decision (banner choice or automatic GPC
 * opt-out) in consent_logs so we have a durable, timestamped record that
 * marketing scripts were blocked until the visitor consented. IP + user agent
 * are kept as the identification evidence an audit record needs; the table is
 * RLS-locked to the service role (see migration 20260718_add_consent_logs.sql).
 *
 * This endpoint must never break the consent UX — the client fires and
 * forgets, and any failure here still returns 200.
 */
function truncateIp(raw: string | null): string | null {
  if (!raw) return null
  if (raw.includes('.')) {
    const parts = raw.split('.')
    return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.0` : raw.slice(0, 64)
  }
  if (raw.includes(':')) {
    return raw.split(':').slice(0, 3).join(':') + '::'
  }
  return raw.slice(0, 64)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const choice = body?.choice
    if (choice !== 'granted' && choice !== 'essential') {
      return NextResponse.json({ error: 'invalid choice' }, { status: 400 })
    }
    const source = body?.source === 'gpc' ? 'gpc' : 'banner'
    const gpc = body?.gpc === true
    // Truncate the IP before storage (IPv4: zero the last octet; IPv6: keep
    // the /48 prefix). Enough to corroborate a consent record's rough origin
    // without the audit log itself becoming a full-PII store.
    const rawIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
    const ip = truncateIp(rawIp)
    const userAgent = req.headers.get('user-agent')?.slice(0, 512) || null

    const { error } = await supabaseAdmin
      .from('consent_logs')
      .insert({ choice, source, gpc, ip, user_agent: userAgent })
    if (error) console.error('[consent-log] insert failed:', error.message)

    return NextResponse.json({ ok: !error })
  } catch (e) {
    console.error('[consent-log] unexpected error:', e)
    return NextResponse.json({ ok: false })
  }
}
