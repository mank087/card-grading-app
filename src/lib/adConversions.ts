/**
 * Server-side ad conversion reporting (2026-09-11).
 *
 * Purchases are reported to Google Ads and Microsoft Advertising from the
 * server using the first-party click ID captured at landing and saved to
 * profiles.ad_click_ids at signup (src/lib/adClickIds.ts). This recovers the
 * purchases the client-side pixels never see: iOS and Android in-app purchases
 * and any web purchase where the success page did not fire.
 *
 * Consent rules, enforced twice:
 *   - enqueue: only when the profile's stored click-ID record carries
 *     consent = 'granted'. Declines, GPC opt-outs and EU visitors who never
 *     accepted have no record at all (capture is gated client-side) or carry
 *     consent = 'essential'.
 *   - send: the profile is re-read at upload time. If the visitor opted out
 *     between purchase and upload the record is gone (DELETE /api/account/
 *     click-ids) and the row is marked skipped.
 * Payload is minimal: click ID, time, value, currency, order ID. No email, no
 * enhanced conversions.
 *
 * Retention: click IDs older than 90 days (both platforms' attribution
 * window) are pruned from profiles by the same cron.
 *
 * Nothing runs until the platform credentials exist (see
 * docs/AD_CONVERSION_UPLOAD_2026-09-11.md). Missing credentials leave rows
 * pending; they are not lost.
 */

import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type ConversionSource = 'stripe' | 'apple' | 'google_play'
export type ConversionPlatform = 'google' | 'microsoft'

export interface EnqueueInput {
  userId: string
  source: ConversionSource
  /** Stable per-purchase id (Stripe session id, IAP transaction id). Dedupes retries. */
  eventId: string
  value: number
  currency?: string
  occurredAt?: Date
}

interface StoredClickIds {
  gclid?: string
  gbraid?: string
  wbraid?: string
  msclkid?: string
  consent?: string | null
  region?: string | null
  captured_at?: string | null
  recorded_at?: string | null
}

const CLICK_ID_TTL_DAYS = 90

async function readClickIds(userId: string): Promise<StoredClickIds | null> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('ad_click_ids')
    .eq('id', userId)
    .maybeSingle()
  const ids = (data?.ad_click_ids ?? null) as StoredClickIds | null
  return ids && typeof ids === 'object' ? ids : null
}

/**
 * Queue a purchase for upload. Never throws; a failure here must not affect
 * the purchase itself. Returns the number of rows queued (0, 1 or 2).
 */
export async function enqueueAdConversion(input: EnqueueInput): Promise<number> {
  try {
    if (!input.userId || !input.eventId || !(input.value > 0)) return 0
    const ids = await readClickIds(input.userId)
    if (!ids || ids.consent !== 'granted') return 0

    const rows: Array<Record<string, unknown>> = []
    const base = {
      user_id: input.userId,
      source: input.source,
      event_id: input.eventId,
      value: Number(input.value.toFixed(2)),
      currency: (input.currency || 'USD').toUpperCase(),
      occurred_at: (input.occurredAt || new Date()).toISOString(),
      status: 'pending',
    }
    const googleId = ids.gclid || ids.gbraid || ids.wbraid
    if (googleId) {
      rows.push({ ...base, platform: 'google', click_id: googleId, click_id_kind: ids.gclid ? 'gclid' : ids.gbraid ? 'gbraid' : 'wbraid' })
    }
    if (ids.msclkid) {
      rows.push({ ...base, platform: 'microsoft', click_id: ids.msclkid, click_id_kind: 'msclkid' })
    }
    if (!rows.length) return 0

    const { error } = await supabaseAdmin
      .from('ad_conversion_uploads')
      .upsert(rows, { onConflict: 'platform,event_id', ignoreDuplicates: true })
    if (error) {
      console.error('[adConversions] enqueue failed:', error.message)
      return 0
    }
    return rows.length
  } catch (e) {
    console.error('[adConversions] enqueue error:', e)
    return 0
  }
}

// ---------------------------------------------------------------------------
// Google Ads: uploadClickConversions (REST)
// ---------------------------------------------------------------------------

interface GoogleCreds {
  developerToken: string
  clientId: string
  clientSecret: string
  refreshToken: string
  customerId: string
  loginCustomerId?: string
  conversionActionId: string
}

function googleCreds(): GoogleCreds | null {
  const e = process.env
  const c = {
    developerToken: e.GOOGLE_ADS_DEVELOPER_TOKEN || '',
    clientId: e.GOOGLE_ADS_OAUTH_CLIENT_ID || '',
    clientSecret: e.GOOGLE_ADS_OAUTH_CLIENT_SECRET || '',
    refreshToken: e.GOOGLE_ADS_OAUTH_REFRESH_TOKEN || '',
    customerId: (e.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, ''),
    loginCustomerId: (e.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '').replace(/-/g, '') || undefined,
    conversionActionId: e.GOOGLE_ADS_CONVERSION_ACTION_ID || '',
  }
  if (!c.developerToken || !c.clientId || !c.clientSecret || !c.refreshToken || !c.customerId || !c.conversionActionId) return null
  return c
}

async function googleAccessToken(c: GoogleCreds): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      refresh_token: c.refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const json = await res.json()
  if (!res.ok || !json.access_token) throw new Error('Google OAuth refresh failed: ' + JSON.stringify(json).slice(0, 300))
  return json.access_token as string
}

/** Google wants "yyyy-mm-dd hh:mm:ss+|-hh:mm". */
function googleDateTime(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}+00:00`
}

async function uploadGoogle(rows: UploadRow[]): Promise<Map<string, string | null>> {
  const c = googleCreds()
  const out = new Map<string, string | null>()
  if (!c) { rows.forEach(r => out.set(r.id, 'credentials not configured')); return out }
  const token = await googleAccessToken(c)
  const conversions = rows.map(r => ({
    ...(r.click_id_kind === 'gclid' ? { gclid: r.click_id } : r.click_id_kind === 'gbraid' ? { gbraid: r.click_id } : { wbraid: r.click_id }),
    conversionAction: `customers/${c.customerId}/conversionActions/${c.conversionActionId}`,
    conversionDateTime: googleDateTime(r.occurred_at),
    conversionValue: r.value,
    currencyCode: r.currency,
    orderId: r.event_id,
  }))
  const res = await fetch(`https://googleads.googleapis.com/v21/customers/${c.customerId}:uploadClickConversions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'developer-token': c.developerToken,
      ...(c.loginCustomerId ? { 'login-customer-id': c.loginCustomerId } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ conversions, partialFailure: true, validateOnly: false }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = 'Google upload HTTP ' + res.status + ': ' + JSON.stringify(json).slice(0, 400)
    rows.forEach(r => out.set(r.id, msg))
    return out
  }
  // partialFailureError carries per-index errors; anything not named succeeded.
  const failedIdx = new Map<number, string>()
  const details = json?.partialFailureError?.details || []
  for (const d of details) {
    for (const err of d?.errors || []) {
      const idx = err?.location?.fieldPathElements?.find((f: any) => f.fieldName === 'conversions')?.index
      if (typeof idx === 'number') failedIdx.set(idx, err?.message || JSON.stringify(err).slice(0, 200))
    }
  }
  rows.forEach((r, i) => out.set(r.id, failedIdx.get(i) ?? null))
  return out
}

// ---------------------------------------------------------------------------
// Microsoft Advertising: ApplyOfflineConversions (SOAP, Campaign Management v13)
// ---------------------------------------------------------------------------

interface MicrosoftCreds {
  developerToken: string
  clientId: string
  clientSecret?: string
  refreshToken: string
  customerId: string
  accountId: string
  conversionName: string
}

function microsoftCreds(): MicrosoftCreds | null {
  const e = process.env
  const c = {
    developerToken: e.MS_ADS_DEVELOPER_TOKEN || '',
    clientId: e.MS_ADS_OAUTH_CLIENT_ID || '',
    clientSecret: e.MS_ADS_OAUTH_CLIENT_SECRET || undefined,
    refreshToken: e.MS_ADS_OAUTH_REFRESH_TOKEN || '',
    customerId: e.MS_ADS_CUSTOMER_ID || '',
    accountId: e.MS_ADS_ACCOUNT_ID || '',
    conversionName: e.MS_ADS_OFFLINE_CONVERSION_NAME || '',
  }
  if (!c.developerToken || !c.clientId || !c.refreshToken || !c.customerId || !c.accountId || !c.conversionName) return null
  return c
}

async function microsoftAccessToken(c: MicrosoftCreds): Promise<string> {
  const body = new URLSearchParams({
    client_id: c.clientId,
    refresh_token: c.refreshToken,
    grant_type: 'refresh_token',
    scope: 'https://ads.microsoft.com/msads.manage offline_access',
  })
  if (c.clientSecret) body.set('client_secret', c.clientSecret)
  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = await res.json()
  if (!res.ok || !json.access_token) throw new Error('Microsoft OAuth refresh failed: ' + JSON.stringify(json).slice(0, 300))
  return json.access_token as string
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

async function uploadMicrosoft(rows: UploadRow[]): Promise<Map<string, string | null>> {
  const c = microsoftCreds()
  const out = new Map<string, string | null>()
  if (!c) { rows.forEach(r => out.set(r.id, 'credentials not configured')); return out }
  const token = await microsoftAccessToken(c)
  const items = rows.map(r => `
        <OfflineConversion>
          <ConversionCurrencyCode>${xmlEscape(r.currency)}</ConversionCurrencyCode>
          <ConversionName>${xmlEscape(c.conversionName)}</ConversionName>
          <ConversionTime>${new Date(r.occurred_at).toISOString()}</ConversionTime>
          <ConversionValue>${r.value}</ConversionValue>
          <MicrosoftClickId>${xmlEscape(r.click_id)}</MicrosoftClickId>
        </OfflineConversion>`).join('')
  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:i="http://www.w3.org/2001/XMLSchema-instance" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Header xmlns="https://bingads.microsoft.com/CampaignManagement/v13">
    <Action mustUnderstand="1">ApplyOfflineConversions</Action>
    <AuthenticationToken i:nil="false">${xmlEscape(token)}</AuthenticationToken>
    <CustomerAccountId i:nil="false">${xmlEscape(c.accountId)}</CustomerAccountId>
    <CustomerId i:nil="false">${xmlEscape(c.customerId)}</CustomerId>
    <DeveloperToken i:nil="false">${xmlEscape(c.developerToken)}</DeveloperToken>
  </s:Header>
  <s:Body>
    <ApplyOfflineConversionsRequest xmlns="https://bingads.microsoft.com/CampaignManagement/v13">
      <OfflineConversions i:nil="false">${items}
      </OfflineConversions>
    </ApplyOfflineConversionsRequest>
  </s:Body>
</s:Envelope>`
  const res = await fetch('https://campaign.api.bingads.microsoft.com/Api/Advertiser/CampaignManagement/v13/CampaignManagementService.svc', {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: 'ApplyOfflineConversions' },
    body: envelope,
  })
  const text = await res.text()
  if (!res.ok || /<s:Fault>|<Fault>/.test(text)) {
    const msg = 'Microsoft upload HTTP ' + res.status + ': ' + text.replace(/\s+/g, ' ').slice(0, 400)
    rows.forEach(r => out.set(r.id, msg))
    return out
  }
  // PartialErrors: <BatchError><Index>n</Index>...<Message>..</Message>
  const failedIdx = new Map<number, string>()
  const re = /<BatchError>[\s\S]*?<Index>(\d+)<\/Index>[\s\S]*?<Message>([\s\S]*?)<\/Message>[\s\S]*?<\/BatchError>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) failedIdx.set(Number(m[1]), m[2].slice(0, 200))
  rows.forEach((r, i) => out.set(r.id, failedIdx.get(i) ?? null))
  return out
}

// ---------------------------------------------------------------------------
// Cron driver
// ---------------------------------------------------------------------------

interface UploadRow {
  id: string
  user_id: string
  platform: ConversionPlatform
  click_id: string
  click_id_kind: string
  event_id: string
  value: number
  currency: string
  occurred_at: string
  attempts: number
}

export interface SendSummary {
  sent: number
  skipped: number
  failed: number
  pending: number
  pruned: number
  configured: { google: boolean; microsoft: boolean }
}

export async function sendPendingConversions(limit = 200): Promise<SendSummary> {
  const summary: SendSummary = {
    sent: 0, skipped: 0, failed: 0, pending: 0, pruned: 0,
    configured: { google: !!googleCreds(), microsoft: !!microsoftCreds() },
  }

  const { data: rows, error } = await supabaseAdmin
    .from('ad_conversion_uploads')
    .select('id, user_id, platform, click_id, click_id_kind, event_id, value, currency, occurred_at, attempts')
    .eq('status', 'pending')
    .lt('attempts', 5)
    .order('occurred_at', { ascending: true })
    .limit(limit)
  if (error) throw new Error('read pending failed: ' + error.message)
  const pending = (rows || []) as UploadRow[]

  // Re-check consent per user right before sending.
  const userIds = [...new Set(pending.map(r => r.user_id))]
  const consented = new Set<string>()
  if (userIds.length) {
    const { data: profs } = await supabaseAdmin.from('profiles').select('id, ad_click_ids').in('id', userIds)
    for (const p of profs || []) {
      const ids = p.ad_click_ids as StoredClickIds | null
      if (ids && ids.consent === 'granted') consented.add(p.id)
    }
  }
  const skippedRows = pending.filter(r => !consented.has(r.user_id))
  if (skippedRows.length) {
    await supabaseAdmin.from('ad_conversion_uploads')
      .update({ status: 'skipped', error: 'consent withdrawn before upload', updated_at: new Date().toISOString() })
      .in('id', skippedRows.map(r => r.id))
    summary.skipped = skippedRows.length
  }
  const sendable = pending.filter(r => consented.has(r.user_id))

  for (const platform of ['google', 'microsoft'] as const) {
    const batch = sendable.filter(r => r.platform === platform)
    if (!batch.length) continue
    if (!summary.configured[platform]) { summary.pending += batch.length; continue }
    let results: Map<string, string | null>
    try {
      results = platform === 'google' ? await uploadGoogle(batch) : await uploadMicrosoft(batch)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      results = new Map(batch.map(r => [r.id, msg]))
    }
    const now = new Date().toISOString()
    for (const r of batch) {
      const err = results.get(r.id) ?? null
      if (err === null) {
        await supabaseAdmin.from('ad_conversion_uploads').update({ status: 'sent', sent_at: now, error: null, attempts: r.attempts + 1, updated_at: now }).eq('id', r.id)
        summary.sent++
      } else {
        const final = r.attempts + 1 >= 5
        await supabaseAdmin.from('ad_conversion_uploads').update({ status: final ? 'failed' : 'pending', error: err.slice(0, 500), attempts: r.attempts + 1, updated_at: now }).eq('id', r.id)
        if (final) summary.failed++; else summary.pending++
      }
    }
  }

  // Retention: drop click IDs past the attribution window.
  const cutoff = new Date(Date.now() - CLICK_ID_TTL_DAYS * 864e5).toISOString()
  const { data: stale } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .not('ad_click_ids', 'is', null)
    .lt('ad_click_captured_at', cutoff)
    .limit(500)
  if (stale?.length) {
    await supabaseAdmin.from('profiles')
      .update({ ad_click_ids: null, ad_click_captured_at: null })
      .in('id', stale.map(s => s.id))
    summary.pruned = stale.length
  }

  return summary
}
