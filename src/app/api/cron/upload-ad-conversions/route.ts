/**
 * Daily server-side conversion upload (2026-09-11).
 *
 * Sends queued purchases (ad_conversion_uploads) to Google Ads and Microsoft
 * Advertising with the buyer's first-party click ID, re-checking consent per
 * user first, then prunes click IDs older than the 90-day attribution
 * window. Safe to run with no credentials: rows stay pending and the summary
 * says which platform is unconfigured.
 *
 * See docs/AD_CONVERSION_UPLOAD_2026-09-11.md for setup.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireCron } from '@/lib/cronAuth'
import { sendPendingConversions } from '@/lib/adConversions'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const auth = requireCron(request, 'upload-ad-conversions')
  if (!auth.ok) return auth.response
  try {
    const summary = await sendPendingConversions()
    console.log('[upload-ad-conversions]', JSON.stringify(summary))
    return NextResponse.json({ ok: true, ...summary })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[upload-ad-conversions] failed:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
