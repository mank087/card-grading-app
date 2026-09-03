/**
 * GET /api/ebay/preview-card
 *
 * One real graded card for the store-settings listing-template preview, so an
 * owner sees their template rendered against their own inventory rather than
 * against fake data.
 *
 * Org members get the newest graded card from their org; everyone else gets
 * their own newest graded card.
 *
 * Deliberately NOT /api/org/cards: that route selects `*` for up to 2000 rows,
 * and pulling every grading blob to render one preview is how we caused an
 * outage before. This selects one row and only the listing columns.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/serverAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getOrgForUser } from '@/lib/organizations'

export const runtime = 'nodejs'

/** Mirrors eligible-cards CARD_COLUMNS, minus the pricing/picker fields. */
const PREVIEW_COLUMNS = [
  'id', 'card_name', 'category', 'sub_category', 'serial', 'org_id', 'org_serial_display',
  'conversational_whole_grade', 'conversational_decimal_grade',
  'conversational_condition_label', 'conversational_card_info', 'conversational_sub_scores',
  'conversational_weighted_sub_scores', 'conversational_final_grade_summary',
  'featured', 'pokemon_featured', 'card_set', 'card_number', 'release_date',
  'serial_numbering', 'rarity_tier', 'rarity_description', 'autographed', 'autograph_type',
  'rookie_card', 'first_print_rookie', 'holofoil', 'is_foil', 'foil_type', 'mtg_rarity',
  'is_enchanted', 'manufacturer', 'custom_label_data',
].join(',')

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request)
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const membership = await getOrgForUser(auth.user.id)

  let query = supabaseAdmin
    .from('cards')
    .select(PREVIEW_COLUMNS)
    .not('conversational_whole_grade', 'is', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)

  query = membership
    ? query.eq('org_id', membership.org.id)
    : query.eq('user_id', auth.user.id)

  const { data, error } = await query.maybeSingle()
  if (error) {
    console.error('[ebay/preview-card] query error:', error)
    return NextResponse.json({ error: 'Failed to load a preview card' }, { status: 500 })
  }

  return NextResponse.json({ card: data ?? null })
}
