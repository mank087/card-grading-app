/**
 * Org logo upload (admin). Validation, variant derivation, storage, and the
 * org-row stamp all live in src/lib/orgLogo.ts — shared with the self-serve
 * application wizard.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isUuid } from '@/lib/uuid'
import { processAndStoreOrgLogo } from '@/lib/orgLogo'

export const runtime = 'nodejs'

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value
  if (!token) return null
  return await verifyAdminSession(token)
}

export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, brand_colors')
    .eq('id', params.id)
    .maybeSingle()
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  const formData = await request.formData()
  const file = formData.get('logo')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'logo file is required (multipart form field "logo")' }, { status: 400 })
  }

  const result = await processAndStoreOrgLogo(params.id, file, (org as any).brand_colors)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ success: true, previews: result.previews })
}
