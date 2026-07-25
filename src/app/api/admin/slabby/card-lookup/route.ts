import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getLabelData, CardForLabel } from '@/lib/labelDataGenerator'

/**
 * Slabby Lab: resolve any card reference into slab-mockup data.
 *
 * `q` accepts a card details URL (/pokemon/<id>), a storage/image URL (the
 * card id is a path segment), a raw card id, or a DCM serial number. Returns
 * the real label data (same generator the Label Studio uses) plus the front
 * image as a data URL — self-contained, so scenes never break when signed
 * URLs expire.
 */

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value
    if (!token || !(await verifyAdminSession(token))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const q = (request.nextUrl.searchParams.get('q') || '').trim()
    if (!q) return NextResponse.json({ error: 'Missing q' }, { status: 400 })

    // Find the card: storage URLs contain user_id AND card_id uuids — the
    // card id is the LAST uuid in the string. Fall back to serial lookup.
    const decoded = decodeURIComponent(q)
    const uuids = decoded.match(UUID_RE)
    let card: (CardForLabel & { id: string; front_path: string | null; user_id: string }) | null = null

    if (uuids && uuids.length > 0) {
      for (const candidate of [...uuids].reverse()) {
        const { data } = await supabaseAdmin.from('cards').select('*').eq('id', candidate).maybeSingle()
        if (data) { card = data; break }
      }
    }
    if (!card && /^\d{6,10}$/.test(decoded)) {
      const { data } = await supabaseAdmin.from('cards').select('*').eq('serial', decoded).maybeSingle()
      if (data) card = data
    }
    if (!card) {
      return NextResponse.json({ error: 'Card not found — paste a card details URL, image URL, card id, or serial.' }, { status: 404 })
    }

    const label = getLabelData(card)

    // Fetch the front image server-side and inline it as a data URL.
    let image: string | null = null
    if (card.front_path) {
      const { data: signed } = await supabaseAdmin.storage.from('cards').createSignedUrl(card.front_path, 600)
      if (signed?.signedUrl) {
        const res = await fetch(signed.signedUrl)
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer())
          const mime = res.headers.get('content-type') || 'image/jpeg'
          image = `data:${mime};base64,${buf.toString('base64')}`
        }
      }
    }
    if (!image) {
      return NextResponse.json({ error: 'Could not load the card image.' }, { status: 502 })
    }

    // Extras for the scrolling details-page background: subgrades + summary
    // from the stored grading JSON (tolerant of both shapes).
    let subgrades: Record<string, number | null> | null = null
    let summary: string | null = null
    try {
      const j = JSON.parse((card as any).conversational_grading || '{}')
      // Prefer the server-consensus subgrades (what the app displays); fall
      // back to the model's weighted scores for older cards.
      const r = j.grading_passes?.averaged_rounded || {}
      const w = j.weighted_scores || {}
      subgrades = {
        centering: r.centering ?? w.centering_weighted ?? null,
        corners: r.corners ?? w.corners_weighted ?? null,
        edges: r.edges ?? w.edges_weighted ?? null,
        surface: r.surface ?? w.surface_weighted ?? null,
      }
      summary = j.final_grade?.summary || j.final_grade?.model_summary || null
    } catch { /* older cards without JSON grading */ }

    return NextResponse.json({
      card: {
        id: card.id,
        image,
        name: label.primaryName,
        contextLine: label.contextLine,
        featuresLine: label.featuresLine,
        serial: label.serial,
        gradeFormatted: label.gradeFormatted,
        condition: label.condition,
        category: label.category,
        subgrades,
        summary,
      },
    })
  } catch (error: any) {
    console.error('[SlabbyCardLookup] error:', error)
    return NextResponse.json({ error: error.message || 'Lookup failed' }, { status: 500 })
  }
}
