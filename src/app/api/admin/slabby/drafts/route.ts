import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * Slabby Lab drafts — stored as JSON files in a private storage bucket
 * (scenes with embedded voiceover/images run to many MB, past both
 * localStorage quotas and Vercel's request-body limit — so the client
 * uploads/downloads directly against signed storage URLs and this route
 * only brokers signatures and metadata).
 *
 *   GET               → list drafts (name, updated_at, size)
 *   GET ?name=<slug>  → signed download URL for one draft
 *   POST {name}       → signed upload URL (client PUTs the JSON to it)
 *   DELETE ?name=     → remove draft
 */

const BUCKET = 'slabby-drafts'

const slug = (name: string) =>
  String(name || 'draft').replace(/[^a-z0-9-_]/gi, '-').toLowerCase().slice(0, 80)

async function ensureBucket() {
  const { data } = await supabaseAdmin.storage.getBucket(BUCKET)
  if (!data) {
    await supabaseAdmin.storage.createBucket(BUCKET, { public: false })
  }
}

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value
  if (!token) return false
  return Boolean(await verifyAdminSession(token))
}

export async function GET(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await ensureBucket()

    const name = request.nextUrl.searchParams.get('name')
    if (name) {
      const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(`${slug(name)}.json`, 300)
      if (error || !data) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
      return NextResponse.json({ url: data.signedUrl })
    }

    const { data, error } = await supabaseAdmin.storage.from(BUCKET).list('', {
      limit: 100,
      sortBy: { column: 'updated_at', order: 'desc' },
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const drafts = (data || [])
      .filter((f) => f.name.endsWith('.json'))
      .map((f) => ({
        name: f.name.replace(/\.json$/, ''),
        updated_at: f.updated_at || f.created_at,
        size_bytes: (f.metadata as any)?.size ?? null,
      }))
    return NextResponse.json({ drafts })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Drafts failed' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await ensureBucket()

    const body = await request.json().catch(() => null)
    const name = slug(body?.name)
    if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 })

    // Remove any existing file first so the signed upload never conflicts.
    await supabaseAdmin.storage.from(BUCKET).remove([`${name}.json`])
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(`${name}.json`)
    if (error || !data) return NextResponse.json({ error: error?.message || 'Could not sign upload' }, { status: 500 })
    return NextResponse.json({ url: data.signedUrl, name })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Drafts failed' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const name = request.nextUrl.searchParams.get('name')
    if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 })
    const { error } = await supabaseAdmin.storage.from(BUCKET).remove([`${slug(name)}.json`])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Drafts failed' }, { status: 500 })
  }
}
