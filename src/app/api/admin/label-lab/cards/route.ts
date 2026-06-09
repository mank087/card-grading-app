/**
 * GET /api/admin/label-lab/cards
 *
 * Admin-only card source for the Label Lab. Mirrors the production
 * /api/cards/my-collection / /api/labels/sample-cards shape but with
 * two differences:
 *   1. Admin scope. Returns recent cards across ALL users, not just the
 *      caller's own collection. The lab is for stress-testing label
 *      rendering, so we want maximum variety.
 *   2. Optional ?search= filter against player/character, card_name,
 *      card_set, serial. Matches the search behaviour of the production
 *      Label Studio card picker.
 *
 * Returns at most LIMIT cards. No pagination — the Lab UI is a single
 * dropdown / grid, not a paged list.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin/adminAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const RECENT_LIMIT = 10
const SEARCH_LIMIT = 50

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const admin = await verifyAdminSession(token)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const search = (url.searchParams.get('search') || '').trim()

    // Columns kept thin. The lab renders a label with what's available;
    // the production label generator pulls richer data through its own
    // resolvers when we promote.
    const baseSelect = `
      id, serial, category, sub_category,
      card_name, featured, pokemon_featured,
      card_set, card_number, release_date, manufacturer_name,
      conversational_whole_grade, conversational_condition_label,
      conversational_card_info, conversational_sub_scores,
      conversational_weighted_sub_scores,
      front_path, back_path,
      card_colors, created_at
    `

    let query = supabaseAdmin
      .from('cards')
      .select(baseSelect)
      .not('conversational_whole_grade', 'is', null)
      .order('created_at', { ascending: false })

    if (search.length > 0) {
      // PostgREST `or` filter across the human-readable text columns.
      // ilike means case-insensitive partial match.
      const q = search.replace(/[%,()]/g, '')
      query = query
        .or(
          `card_name.ilike.%${q}%,featured.ilike.%${q}%,pokemon_featured.ilike.%${q}%,card_set.ilike.%${q}%,serial.ilike.%${q}%`,
        )
        .limit(SEARCH_LIMIT)
    } else {
      query = query.limit(RECENT_LIMIT)
    }

    const { data, error } = await query
    if (error) {
      console.error('[label-lab/cards] DB error:', error)
      return NextResponse.json({ error: 'Failed to load cards' }, { status: 500 })
    }

    // Resolve signed image URLs so the client can display thumbnails. We
    // accept the round-trip cost since this is admin-only and called once
    // per picker open.
    const paths: string[] = []
    for (const c of data || []) {
      if (c.front_path) paths.push(c.front_path)
      if (c.back_path) paths.push(c.back_path)
    }
    let urlMap = new Map<string, string>()
    if (paths.length > 0) {
      const { data: signed } = await supabaseAdmin.storage
        .from('cards')
        .createSignedUrls(paths, 3600)
      if (signed) {
        for (const s of signed) {
          if (s.signedUrl && s.path) urlMap.set(s.path, s.signedUrl)
        }
      }
    }
    const enriched = (data || []).map((c: any) => ({
      ...c,
      front_url: c.front_path ? urlMap.get(c.front_path) || null : null,
      back_url: c.back_path ? urlMap.get(c.back_path) || null : null,
    }))

    return NextResponse.json({ cards: enriched })
  } catch (err: any) {
    console.error('[label-lab/cards] unexpected:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}
