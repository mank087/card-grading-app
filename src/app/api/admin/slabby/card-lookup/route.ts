import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import sharp from 'sharp'
import { getLabelData, CardForLabel, CARD_FOR_LABEL_COLUMNS } from '@/lib/labelDataGenerator'

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

// Label fields + what this route reads itself (image path, grading JSON).
const LOOKUP_COLUMNS = `${CARD_FOR_LABEL_COLUMNS}, front_path, user_id, conversational_grading`

// Scenes only need a mockup-sized image; full-res originals bloat the JSON.
const MAX_IMAGE_EDGE = 1200

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
        const { data } = await supabaseAdmin.from('cards').select(LOOKUP_COLUMNS).eq('id', candidate).maybeSingle()
        if (data) { card = data as any; break }
      }
    }
    if (!card && /^\d{6,10}$/.test(decoded)) {
      const { data } = await supabaseAdmin.from('cards').select(LOOKUP_COLUMNS).eq('serial', decoded).maybeSingle()
      if (data) card = data as any
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
          try {
            const small = await sharp(buf)
              .rotate()
              .resize(MAX_IMAGE_EDGE, MAX_IMAGE_EDGE, { fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 88 })
              .toBuffer()
            image = `data:image/jpeg;base64,${small.toString('base64')}`
          } catch {
            // Undecodable by sharp: fall back to the original bytes.
            const mime = res.headers.get('content-type') || 'image/jpeg'
            image = `data:${mime};base64,${buf.toString('base64')}`
          }
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
