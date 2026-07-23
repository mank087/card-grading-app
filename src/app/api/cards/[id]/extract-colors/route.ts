import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { verifyAuth } from '@/lib/serverAuth'
import { extractAndSaveCardColors } from '@/lib/serverColorExtractor'
import { isUuid } from '@/lib/uuid'

/**
 * POST /api/cards/[id]/extract-colors
 *
 * On-demand color extraction for a card. The grading pipeline kicks off
 * extraction fire-and-forget (vision-grade route etc.), so a user opening
 * Label Studio immediately after grading may find card_colors still null.
 * Mobile can't fall back to client-side extraction (no Canvas API), so this
 * endpoint runs the same server-side extractor synchronously and returns
 * the result.
 *
 * Returns the existing card_colors if already populated — extraction is
 * deterministic enough that re-running is wasted work.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardId } = await params
    if (!isUuid(cardId)) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }
    const auth = await verifyAuth(request)
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: auth.error || 'Authentication required' }, { status: 401 })
    }

    const supabase = supabaseServer()
    const { data: card, error: fetchError } = await supabase
      .from('cards')
      .select('id, user_id, front_path, card_colors')
      .eq('id', cardId)
      .single()

    if (fetchError || !card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }
    if (card.user_id !== auth.userId) {
      return NextResponse.json({ error: 'You do not own this card' }, { status: 403 })
    }

    if (card.card_colors) {
      return NextResponse.json({ card_colors: card.card_colors, cached: true })
    }
    if (!card.front_path) {
      return NextResponse.json({ error: 'Card has no front image to extract from' }, { status: 400 })
    }

    const colors = await extractAndSaveCardColors(cardId, card.front_path)
    if (!colors) {
      return NextResponse.json({ error: 'Color extraction failed' }, { status: 500 })
    }

    return NextResponse.json({ card_colors: colors, cached: false })
  } catch (error: any) {
    console.error('[ExtractColors] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
