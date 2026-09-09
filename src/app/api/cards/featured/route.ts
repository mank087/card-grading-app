import { HOME_SHOWCASE_IDS, LEARNING_CARD_IDS } from '@/lib/cards/marketingShowcase'
import { NextRequest, NextResponse } from 'next/server'
import { cachedShowcase, loadFeaturedCards } from '@/lib/cards/publicShowcase'
export async function GET(request: NextRequest) {
  try {
    const params = new URL(request.url).searchParams
    const showcase = params.get('showcase')
    const curated = showcase === '1' || (showcase !== null && Object.prototype.hasOwnProperty.call(LEARNING_CARD_IDS, showcase))
    const parsed = Number.parseInt(params.get('limit') || '15', 10)
    const limit = Math.max(1, Math.min(Number.isFinite(parsed) ? parsed : 15, showcase === '1' ? HOME_SHOWCASE_IDS.length : 50))
    const result = await (curated ? cachedShowcase : loadFeaturedCards)(limit, params.get('category'), showcase)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in featured cards API:', error)
    return NextResponse.json({ error: 'Failed to fetch featured cards', cards: [] }, { status: 500 })
  }
}
