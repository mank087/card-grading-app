/**
 * Store first-party ad click IDs on the signed-in user's profile.
 * POST { gclid?, gbraid?, wbraid?, msclkid?, landing?, captured_at?, consent?, region? }
 *
 * The IDs are captured client-side from the landing URL (src/lib/adClickIds.ts)
 * and only ever sent for a user who is signed in. They exist so purchases can
 * later be reported to Google Ads and Microsoft Advertising server-side, which
 * catches iOS / Android purchases and any web purchase where the success page
 * never fired a pixel. The consent value stored alongside is what the future
 * upload job must check before sending anything to an ad platform.
 *
 * Requires migration 20260911_profiles_ad_click_ids.sql.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const ID_KEYS = ['gclid', 'gbraid', 'wbraid', 'msclkid'] as const
const ID_RE = /^[A-Za-z0-9_.-]{1,200}$/

/**
 * Opt-out: forget the stored click IDs. Called by the consent banner when a
 * signed-in visitor declines or opts out, so the server-side upload job can
 * no longer attribute anything for them (it re-reads the profile at send time).
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ ad_click_ids: null, ad_click_captured_at: null })
      .eq('id', authResult.user.id)
    if (error) {
      console.error('[click-ids] clear failed:', error.message)
      return NextResponse.json({ error: 'Failed to clear click IDs' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[click-ids] unexpected error:', error)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request)
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const ids: Record<string, string> = {}
    for (const k of ID_KEYS) {
      const v = body?.[k]
      if (typeof v === 'string' && ID_RE.test(v)) ids[k] = v
    }
    if (!Object.keys(ids).length) {
      return NextResponse.json({ error: 'No click IDs supplied' }, { status: 400 })
    }

    const record = {
      ...ids,
      landing: typeof body?.landing === 'string' ? body.landing.slice(0, 200) : null,
      captured_at: typeof body?.captured_at === 'string' ? body.captured_at.slice(0, 40) : null,
      consent: body?.consent === 'granted' || body?.consent === 'essential' ? body.consent : null,
      region: typeof body?.region === 'string' ? body.region.slice(0, 16) : null,
      recorded_at: new Date().toISOString(),
    }

    // Merge with anything already stored so a second campaign click does not
    // erase the first; newest wins per key.
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('ad_click_ids')
      .eq('id', authResult.user.id)
      .maybeSingle()
    const merged = { ...((existing?.ad_click_ids as Record<string, unknown> | null) || {}), ...record }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ ad_click_ids: merged, ad_click_captured_at: record.recorded_at })
      .eq('id', authResult.user.id)

    if (error) {
      console.error('[click-ids] profile update failed:', error.message)
      return NextResponse.json({ error: 'Failed to store click IDs' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[click-ids] unexpected error:', error)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
