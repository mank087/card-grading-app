/**
 * Org storefront management: PATCH merges content edits + the enabled flag,
 * POST uploads a store photo (webp-normalized), DELETE removes one. The
 * public Enterprise Page at /enterprise/[slug] reads the same jsonb blob.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isUuid } from '@/lib/uuid'
import { BAND_PATTERNS } from '@/lib/labelLab/bandGeometry'
import type { StorefrontContent } from '@/app/enterprise/[slug]/data'
import sharp from 'sharp'

export const runtime = 'nodejs'

const MAX_PHOTO_BYTES = 8 * 1024 * 1024
const MAX_PHOTOS = 8
const SIGN_TTL = 3600

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value
  if (!token) return null
  return await verifyAdminSession(token)
}

async function loadStorefront(orgId: string): Promise<{ enabled: boolean; content: StorefrontContent } | null> {
  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, storefront_enabled, storefront')
    .eq('id', orgId)
    .maybeSingle()
  if (!org) return null
  return {
    enabled: Boolean((org as any).storefront_enabled),
    content: (((org as any).storefront as StorefrontContent) || {}),
  }
}

async function saveStorefront(orgId: string, updates: { storefront_enabled?: boolean; storefront?: StorefrontContent }) {
  const { error } = await supabaseAdmin
    .from('organizations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', orgId)
  return error
}

const isHttpUrl = (v: string) => /^https?:\/\//i.test(v)
const isHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v)
const SOCIAL_KEYS = ['instagram', 'facebook', 'tiktok', 'youtube', 'x'] as const

/** Validate an incoming partial StorefrontContent; returns an error string or the cleaned object. */
function validateContent(orgId: string, raw: unknown): { error: string } | { content: StorefrontContent } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { error: 'storefront must be an object' }
  }
  const body = raw as Record<string, unknown>
  const content: StorefrontContent = {}

  for (const key of ['tagline', 'description', 'address', 'phone', 'public_email', 'website', 'hours', 'legal_name', 'about_title'] as const) {
    if (body[key] === undefined) continue
    if (typeof body[key] !== 'string') return { error: `${key} must be a string` }
    content[key] = (body[key] as string).trim()
  }
  if (content.website && !isHttpUrl(content.website)) {
    return { error: 'website must start with https:// (or http://)' }
  }
  if (content.legal_name && content.legal_name.length > 120) {
    return { error: 'legal_name is capped at 120 characters' }
  }

  if (body.about_bullets !== undefined) {
    if (
      !Array.isArray(body.about_bullets) ||
      body.about_bullets.length > 5 ||
      body.about_bullets.some(b => typeof b !== 'string')
    ) {
      return { error: 'about_bullets must be up to 5 strings' }
    }
    content.about_bullets = (body.about_bullets as string[]).map(b => b.trim().slice(0, 140)).filter(Boolean)
  }

  if (body.hero_logo !== undefined) {
    if (!['color', 'white', 'none'].includes(body.hero_logo as string)) {
      return { error: 'hero_logo must be one of: color, white, none' }
    }
    content.hero_logo = body.hero_logo as StorefrontContent['hero_logo']
  }

  if (body.show_recent_cards !== undefined) {
    if (typeof body.show_recent_cards !== 'boolean') {
      return { error: 'show_recent_cards must be a boolean' }
    }
    content.show_recent_cards = body.show_recent_cards
  }

  if (body.photo_display !== undefined) {
    if (!['crop', 'fit'].includes(body.photo_display as string)) {
      return { error: 'photo_display must be one of: crop, fit' }
    }
    content.photo_display = body.photo_display as StorefrontContent['photo_display']
  }

  if (body.socials !== undefined) {
    if (typeof body.socials !== 'object' || body.socials === null || Array.isArray(body.socials)) {
      return { error: 'socials must be an object' }
    }
    const socials: StorefrontContent['socials'] = {}
    for (const key of SOCIAL_KEYS) {
      const v = (body.socials as Record<string, unknown>)[key]
      if (v === undefined) continue
      if (typeof v !== 'string') return { error: `socials.${key} must be a string` }
      const trimmed = v.trim()
      if (trimmed && !isHttpUrl(trimmed)) return { error: `socials.${key} must start with https:// (or http://)` }
      socials[key] = trimmed
    }
    content.socials = socials
  }

  if (body.photos !== undefined) {
    if (!Array.isArray(body.photos)) return { error: 'photos must be an array' }
    if (body.photos.length > MAX_PHOTOS) return { error: `photos is capped at ${MAX_PHOTOS}` }
    for (const p of body.photos) {
      if (typeof p !== 'string' || !p.startsWith(`${orgId}/store/`)) {
        return { error: 'photos entries must be paths inside this org\'s store folder' }
      }
    }
    content.photos = body.photos as string[]
  }

  if (body.slab !== undefined) {
    if (typeof body.slab !== 'object' || body.slab === null || Array.isArray(body.slab)) {
      return { error: 'slab must be an object' }
    }
    const slabIn = body.slab as Record<string, unknown>
    const slab: NonNullable<StorefrontContent['slab']> = {}
    if (slabIn.pattern !== undefined) {
      if (typeof slabIn.pattern !== 'string' || !BAND_PATTERNS.some(p => p.id === slabIn.pattern)) {
        return { error: `slab.pattern must be one of: ${BAND_PATTERNS.map(p => p.id).join(', ')}` }
      }
      slab.pattern = slabIn.pattern
    }
    if (slabIn.color_source !== undefined) {
      if (!['brand', 'card'].includes(slabIn.color_source as string)) {
        return { error: 'slab.color_source must be one of: brand, card' }
      }
      slab.color_source = slabIn.color_source as 'brand' | 'card'
    }
    if (slabIn.label_style !== undefined) {
      if (!['modern', 'heritage'].includes(slabIn.label_style as string)) {
        return { error: 'slab.label_style must be one of: modern, heritage' }
      }
      slab.label_style = slabIn.label_style as 'modern' | 'heritage'
    }
    if (slabIn.colors !== undefined) {
      // 1–5 colors; an empty array is fine and means "use the brand default".
      if (!Array.isArray(slabIn.colors) || slabIn.colors.length > 5) {
        return { error: 'slab.colors must be an array of 1–5 colors (empty = brand default)' }
      }
      for (const c of slabIn.colors) {
        if (typeof c !== 'string' || !isHex(c)) return { error: 'slab.colors entries must be #rrggbb hex strings' }
      }
      slab.colors = slabIn.colors as string[]
    }
    content.slab = slab
  }

  return { content }
}

export async function PATCH(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const current = await loadStorefront(params.id)
  if (!current) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const body = await request.json()
  const updates: { storefront_enabled?: boolean; storefront?: StorefrontContent } = {}

  if (body.storefront_enabled !== undefined) {
    if (typeof body.storefront_enabled !== 'boolean') {
      return NextResponse.json({ error: 'storefront_enabled must be a boolean' }, { status: 400 })
    }
    updates.storefront_enabled = body.storefront_enabled
  }

  if (body.storefront !== undefined) {
    const result = validateContent(params.id, body.storefront)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
    // Shallow-merge over the stored blob so partial saves don't wipe fields
    updates.storefront = { ...current.content, ...result.content }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const error = await saveStorefront(params.id, updates)
  if (error) {
    console.error('[org storefront] update failed:', error)
    return NextResponse.json({ error: 'Failed to save storefront' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    storefront_enabled: updates.storefront_enabled ?? current.enabled,
    storefront: updates.storefront ?? current.content,
  })
}

export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const current = await loadStorefront(params.id)
  if (!current) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const photos = current.content.photos || []
  if (photos.length >= MAX_PHOTOS) {
    return NextResponse.json({ error: `Storefront already has ${MAX_PHOTOS} photos — remove one first` }, { status: 400 })
  }

  const formData = await request.formData()
  const file = formData.get('photo')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'photo file is required (multipart form field "photo")' }, { status: 400 })
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: 'Photo must be under 8MB' }, { status: 400 })
  }

  const input = Buffer.from(await file.arrayBuffer())
  let normalized: Buffer
  try {
    normalized = await sharp(input)
      .rotate() // apply EXIF orientation
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer()
  } catch {
    return NextResponse.json({ error: 'File is not a readable image' }, { status: 400 })
  }

  const path = `${params.id}/store/${Date.now()}.webp`
  const { error: uploadError } = await supabaseAdmin.storage
    .from('org-assets')
    .upload(path, normalized, { contentType: 'image/webp', upsert: false })
  if (uploadError) {
    console.error('[org storefront] photo upload failed:', path, uploadError)
    return NextResponse.json({ error: 'Failed to store photo' }, { status: 500 })
  }

  const error = await saveStorefront(params.id, {
    storefront: { ...current.content, photos: [...photos, path] },
  })
  if (error) {
    console.error('[org storefront] photo save failed:', error)
    return NextResponse.json({ error: 'Photo stored but organization update failed' }, { status: 500 })
  }

  const { data: signed } = await supabaseAdmin.storage.from('org-assets').createSignedUrl(path, SIGN_TTL)
  return NextResponse.json({ success: true, path, signedUrl: signed?.signedUrl ?? null })
}

export async function DELETE(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const path = request.nextUrl.searchParams.get('path')
  if (!path || !path.startsWith(`${params.id}/store/`)) {
    return NextResponse.json({ error: 'path must be inside this org\'s store folder' }, { status: 400 })
  }

  const current = await loadStorefront(params.id)
  if (!current) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const { error: removeError } = await supabaseAdmin.storage.from('org-assets').remove([path])
  if (removeError) {
    console.error('[org storefront] photo remove failed:', path, removeError)
    return NextResponse.json({ error: 'Failed to remove photo from storage' }, { status: 500 })
  }

  const error = await saveStorefront(params.id, {
    storefront: { ...current.content, photos: (current.content.photos || []).filter(p => p !== path) },
  })
  if (error) {
    console.error('[org storefront] photo delete save failed:', error)
    return NextResponse.json({ error: 'Photo removed but organization update failed' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
