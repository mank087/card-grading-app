/**
 * Owner self-service org settings — the API behind /store/settings
 * ("Enterprise Brand Setup").
 *
 * GET    — everything editable + signed logo/photo URLs + derived defaults.
 * PATCH  — JSON updates: identity (name, serialPrefix, brandColors), the full
 *          storefront content (mirrors the admin storefront contract), the
 *          slab design (label style, pattern, colors), how-it-works/FAQ, and
 *          the brand-setup completion flag. Slug is NOT editable (public URLs
 *          and subdomains hang off it).
 * POST   — multipart uploads: field "logo" (re-derives white/black variants)
 *          or field "photo" (storefront photo, max 8).
 * DELETE — ?path= removes a storefront photo.
 *
 * The admin storefront route stays the admin-side contract; this mirrors its
 * validation so the two write the same shapes.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getOrgForUser, getOrgBranding, orgSerialPrefix } from '@/lib/organizations'
import { processAndStoreOrgLogo } from '@/lib/orgLogo'
import { BAND_PATTERNS } from '@/lib/labelLab/bandGeometry'
import sharp from 'sharp'

export const runtime = 'nodejs'

const HEX_RE = /^#[0-9a-fA-F]{6}$/
const URL_RE = /^https?:\/\//
const SOCIAL_KEYS = ['instagram', 'facebook', 'tiktok', 'youtube', 'x'] as const
const PHOTO_MAX_BYTES = 8 * 1024 * 1024
const PHOTO_MAX_COUNT = 8

async function requireOwner(request: NextRequest) {
  const authResult = await verifyAuth(request)
  if (!authResult.authenticated || !authResult.user) return { error: 'Authentication required', status: 401 as const }
  const membership = await getOrgForUser(authResult.user.id)
  if (!membership) return { error: 'No organization', status: 403 as const }
  if (membership.role !== 'owner') return { error: 'Only the account owner can edit settings', status: 403 as const }
  return { membership }
}

export async function GET(request: NextRequest) {
  const auth = await requireOwner(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { org } = auth.membership

  const branding = await getOrgBranding(org)
  const storefront = ((org as any).storefront || {}) as Record<string, any>
  const application = ((org as any).application || {}) as Record<string, any>

  // Signed URLs for storefront photos (1h)
  const photoPaths: string[] = Array.isArray(storefront.photos) ? storefront.photos : []
  const photos = await Promise.all(
    photoPaths.map(async (path: string) => {
      const { data } = await supabaseAdmin.storage.from('org-assets').createSignedUrl(path, 3600)
      return { path, url: data?.signedUrl ?? null }
    })
  )

  return NextResponse.json({
    settings: {
      name: org.name,
      slug: org.slug,
      status: org.status,
      brandColors: org.brand_colors?.length ? org.brand_colors : org.brand_color ? [org.brand_color] : [],
      serialPrefix: org.serial_prefix || '',
      /** What the prefix falls back to when blank — prefill + example text. */
      derivedPrefix: orgSerialPrefix({ name: org.name, serial_prefix: null }),
      tagline: storefront.tagline || '',
      description: storefront.description || '',
      aboutTitle: storefront.about_title || '',
      /** null = shared defaults; [] = hidden; else custom. */
      aboutBullets: storefront.about_bullets ?? null,
      address: storefront.address || '',
      hours: storefront.hours || '',
      publicEmail: storefront.public_email || '',
      legalName: storefront.legal_name || '',
      heroLogo: storefront.hero_logo || 'color',
      photoDisplay: storefront.photo_display || 'crop',
      showRecentCards: Boolean(storefront.show_recent_cards),
      socials: SOCIAL_KEYS.reduce((acc, k) => ({ ...acc, [k]: storefront.socials?.[k] || '' }), {} as Record<string, string>),
      photos,
      slab: {
        labelStyle: storefront.slab?.label_style === 'modern' ? 'modern' : 'heritage',
        pattern: storefront.slab?.pattern || 'diamond',
        colors: Array.isArray(storefront.slab?.colors) ? storefront.slab.colors : [],
        colorSource: storefront.slab?.color_source === 'card' ? 'card' : 'brand',
      },
      storefrontEnabled: Boolean((org as any).storefront_enabled),
      // null = section uses the shared defaults; [] = hidden; else custom.
      howItWorks: storefront.how_it_works ?? null,
      faqs: storefront.faqs ?? null,
      phone: application.phone || '',
      website: application.website || '',
      setupDone: Boolean(application.brand_setup_done),
      logos: branding
        ? { color: branding.logoUrl, white: branding.logoWhiteUrl, black: branding.logoBlackUrl }
        : { color: null, white: null, black: null },
    },
  })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireOwner(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { org } = auth.membership

  const body = await request.json()
  const updates: Record<string, unknown> = {}
  const storefrontPatch: Record<string, unknown> = {}

  if (typeof body.name === 'string') {
    const name = body.name.trim().slice(0, 120)
    if (name.length < 2) return NextResponse.json({ error: 'Brand or business name is too short' }, { status: 400 })
    updates.name = name
  }

  if (body.brandColors !== undefined) {
    if (
      !Array.isArray(body.brandColors) ||
      body.brandColors.length < 1 ||
      body.brandColors.length > 5 ||
      body.brandColors.some((c: unknown) => typeof c !== 'string' || !HEX_RE.test(c))
    ) {
      return NextResponse.json({ error: 'Brand colors must be 1–5 hex colors' }, { status: 400 })
    }
    updates.brand_colors = body.brandColors
    updates.brand_color = body.brandColors[0]
  }

  if (body.serialPrefix !== undefined) {
    const normalized = String(body.serialPrefix || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (normalized === '') {
      updates.serial_prefix = null
    } else if (/^[A-Z0-9]{2,6}$/.test(normalized)) {
      updates.serial_prefix = normalized
    } else {
      return NextResponse.json({ error: 'Serial prefix must be 2–6 characters (A–Z, 0–9)' }, { status: 400 })
    }
  }

  // ---- Storefront text fields (mirror the admin route's validation) ----
  const textField = (key: string, jsonKey: string, max: number) => {
    if (body[key] !== undefined) {
      storefrontPatch[jsonKey] = String(body[key]).trim().slice(0, max) || undefined
    }
  }
  textField('tagline', 'tagline', 140)
  textField('description', 'description', 1000)
  textField('address', 'address', 400)
  textField('hours', 'hours', 400)
  textField('legalName', 'legal_name', 120)
  textField('aboutTitle', 'about_title', 120)

  if (body.aboutBullets !== undefined) {
    if (body.aboutBullets === null) {
      storefrontPatch.about_bullets = null
    } else if (
      Array.isArray(body.aboutBullets) &&
      body.aboutBullets.length <= 5 &&
      body.aboutBullets.every((b: unknown) => typeof b === 'string')
    ) {
      storefrontPatch.about_bullets = body.aboutBullets
        .map((b: string) => b.trim().slice(0, 140))
        .filter(Boolean)
    } else {
      return NextResponse.json({ error: 'aboutBullets must be up to 5 short lines' }, { status: 400 })
    }
  }

  if (body.publicEmail !== undefined) {
    const email = String(body.publicEmail).trim().slice(0, 320)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Public email is not a valid email address' }, { status: 400 })
    }
    storefrontPatch.public_email = email || undefined
  }
  if (body.storefrontWebsite !== undefined) {
    const site = String(body.storefrontWebsite).trim().slice(0, 200)
    if (site && !URL_RE.test(site)) {
      return NextResponse.json({ error: 'Website must start with http:// or https://' }, { status: 400 })
    }
    storefrontPatch.website = site || undefined
  }
  if (body.heroLogo !== undefined) {
    if (!['color', 'white', 'none'].includes(body.heroLogo)) {
      return NextResponse.json({ error: 'Invalid hero logo option' }, { status: 400 })
    }
    storefrontPatch.hero_logo = body.heroLogo
  }
  if (body.photoDisplay !== undefined) {
    if (!['crop', 'fit'].includes(body.photoDisplay)) {
      return NextResponse.json({ error: 'Invalid photo display option' }, { status: 400 })
    }
    storefrontPatch.photo_display = body.photoDisplay
  }
  if (body.showRecentCards !== undefined) {
    storefrontPatch.show_recent_cards = Boolean(body.showRecentCards)
  }
  if (body.socials !== undefined) {
    if (typeof body.socials !== 'object' || body.socials === null) {
      return NextResponse.json({ error: 'Invalid socials' }, { status: 400 })
    }
    const socials: Record<string, string> = {}
    for (const k of SOCIAL_KEYS) {
      const v = String(body.socials[k] || '').trim().slice(0, 300)
      if (v && !URL_RE.test(v)) {
        return NextResponse.json({ error: `${k} link must be a full URL (https://...)` }, { status: 400 })
      }
      if (v) socials[k] = v
    }
    storefrontPatch.socials = socials
  }

  // ---- Slab design (replaced wholesale, same as the admin route) ----
  if (body.slab !== undefined) {
    const slab = body.slab || {}
    const labelStyle = slab.labelStyle === 'modern' ? 'modern' : 'heritage'
    const pattern = BAND_PATTERNS.some(p => p.id === slab.pattern) ? slab.pattern : 'diamond'
    const colors = Array.isArray(slab.colors)
      ? slab.colors.filter((c: unknown) => typeof c === 'string' && HEX_RE.test(c)).slice(0, 5)
      : []
    const colorSource = slab.colorSource === 'card' ? 'card' : 'brand'
    storefrontPatch.slab = { label_style: labelStyle, pattern, colors, color_source: colorSource }
  }

  // ---- How it works / FAQ (null = defaults, [] = hidden) ----
  if (body.howItWorks !== undefined) {
    if (body.howItWorks === null) {
      storefrontPatch.how_it_works = null
    } else if (
      Array.isArray(body.howItWorks) &&
      body.howItWorks.length <= 6 &&
      body.howItWorks.every((s: unknown) => s && typeof (s as any).title === 'string' && typeof (s as any).body === 'string')
    ) {
      storefrontPatch.how_it_works = body.howItWorks
        .map((s: { title: string; body: string }) => ({ title: s.title.trim().slice(0, 80), body: s.body.trim().slice(0, 400) }))
        .filter((s: { title: string; body: string }) => s.title || s.body)
    } else {
      return NextResponse.json({ error: 'howItWorks must be up to 6 steps with title and body' }, { status: 400 })
    }
  }
  if (body.faqs !== undefined) {
    if (body.faqs === null) {
      storefrontPatch.faqs = null
    } else if (
      Array.isArray(body.faqs) &&
      body.faqs.length <= 10 &&
      body.faqs.every((f: unknown) => f && typeof (f as any).q === 'string' && typeof (f as any).a === 'string')
    ) {
      storefrontPatch.faqs = body.faqs
        .map((f: { q: string; a: string }) => ({ q: f.q.trim().slice(0, 160), a: f.a.trim().slice(0, 1000) }))
        .filter((f: { q: string; a: string }) => f.q || f.a)
    } else {
      return NextResponse.json({ error: 'faqs must be up to 10 entries with q and a' }, { status: 400 })
    }
  }

  // ---- Contact details + setup flag (application jsonb) ----
  const applicationPatch: Record<string, unknown> = {}
  if (body.phone !== undefined) applicationPatch.phone = String(body.phone).trim().slice(0, 40) || null
  if (body.website !== undefined) applicationPatch.website = String(body.website).trim().slice(0, 200) || null
  if (body.setupDone === true) applicationPatch.brand_setup_done = true

  if (Object.keys(storefrontPatch).length > 0) {
    const current = ((org as any).storefront || {}) as Record<string, unknown>
    const merged = { ...current, ...storefrontPatch }
    // null markers mean "delete the key" (fall back to shared defaults)
    for (const key of ['how_it_works', 'faqs', 'about_bullets']) {
      if (merged[key] === null) delete merged[key]
    }
    updates.storefront = merged
  }
  if (Object.keys(applicationPatch).length > 0) {
    const current = ((org as any).application || {}) as Record<string, unknown>
    updates.application = { ...current, ...applicationPatch }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: true, unchanged: true })
  }

  updates.updated_at = new Date().toISOString()
  const { error } = await supabaseAdmin.from('organizations').update(updates).eq('id', org.id)
  if (error) {
    console.error('[org/settings] update error:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

export async function POST(request: NextRequest) {
  const auth = await requireOwner(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { org } = auth.membership

  const formData = await request.formData()

  const logo = formData.get('logo')
  if (logo instanceof File) {
    const result = await processAndStoreOrgLogo(org.id, logo, org.brand_colors)
    if (!result.success) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ success: true, previews: result.previews })
  }

  const photo = formData.get('photo')
  if (photo instanceof File) {
    if (photo.size > PHOTO_MAX_BYTES) {
      return NextResponse.json({ error: 'Photo must be under 8MB' }, { status: 400 })
    }
    const storefront = ((org as any).storefront || {}) as Record<string, any>
    const photos: string[] = Array.isArray(storefront.photos) ? storefront.photos : []
    if (photos.length >= PHOTO_MAX_COUNT) {
      return NextResponse.json({ error: `Maximum ${PHOTO_MAX_COUNT} photos` }, { status: 400 })
    }
    let processed: Buffer
    try {
      processed = await sharp(Buffer.from(await photo.arrayBuffer()))
        .rotate()
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer()
    } catch {
      return NextResponse.json({ error: 'File is not a readable image' }, { status: 400 })
    }
    const path = `${org.id}/store/${Date.now()}.webp`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('org-assets')
      .upload(path, processed, { contentType: 'image/webp' })
    if (uploadError) {
      console.error('[org/settings] photo upload failed:', uploadError)
      return NextResponse.json({ error: 'Failed to store photo' }, { status: 500 })
    }
    const { error: saveError } = await supabaseAdmin
      .from('organizations')
      .update({ storefront: { ...storefront, photos: [...photos, path] }, updated_at: new Date().toISOString() })
      .eq('id', org.id)
    if (saveError) {
      console.error('[org/settings] photo record failed:', saveError)
      return NextResponse.json({ error: 'Failed to save photo' }, { status: 500 })
    }
    const { data: signed } = await supabaseAdmin.storage.from('org-assets').createSignedUrl(path, 3600)
    return NextResponse.json({ success: true, path, url: signed?.signedUrl ?? null })
  }

  return NextResponse.json({ error: 'Send a "logo" or "photo" file' }, { status: 400 })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireOwner(request)
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { org } = auth.membership

  const path = request.nextUrl.searchParams.get('path') || ''
  if (!path.startsWith(`${org.id}/store/`)) {
    return NextResponse.json({ error: 'Invalid photo path' }, { status: 400 })
  }
  await supabaseAdmin.storage.from('org-assets').remove([path])
  const storefront = ((org as any).storefront || {}) as Record<string, any>
  const photos: string[] = (Array.isArray(storefront.photos) ? storefront.photos : []).filter((p: string) => p !== path)
  const { error } = await supabaseAdmin
    .from('organizations')
    .update({ storefront: { ...storefront, photos }, updated_at: new Date().toISOString() })
    .eq('id', org.id)
  if (error) {
    console.error('[org/settings] photo delete record failed:', error)
    return NextResponse.json({ error: 'Failed to remove photo' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
