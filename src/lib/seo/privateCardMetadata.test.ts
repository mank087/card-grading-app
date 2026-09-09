import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ row: { visibility: 'private', card_name: 'PRIVATE_TEST_CARD', label_data: { primaryName: 'PRIVATE_TEST_CARD' } } as Record<string, unknown> | null, image: vi.fn() }))
vi.mock('@/lib/supabaseServer', () => ({ supabaseServer: () => ({ from: () => ({ select: () => ({ eq: () => ({ is: () => ({ single: async () => ({ data: mock.row, error: null }) }), single: async () => ({ data: mock.row, error: null }) }) }) }) }) }))
vi.mock('@/lib/seo/cardMetadataImage', () => ({ getCardOgImageUrl: mock.image }))
vi.mock('@/app/pokemon/[id]/CardDetailClient', () => ({ PokemonCardDetails: () => null }))
vi.mock('@/app/sports/[id]/CardDetailClient', () => ({ SportsCardDetails: () => null }))
vi.mock('@/app/mtg/[id]/CardDetailClient', () => ({ default: () => null }))
vi.mock('@/app/lorcana/[id]/CardDetailClient', () => ({ default: () => null }))
vi.mock('@/app/onepiece/[id]/CardDetailClient', () => ({ default: () => null }))
vi.mock('@/app/other/[id]/CardDetailClient', () => ({ default: () => null }))
vi.mock('@/app/yugioh/[id]/CardDetailClient', () => ({ default: () => null }))
import { generateMetadata as pokemon } from '@/app/pokemon/[id]/page'
import { generateMetadata as sports } from '@/app/sports/[id]/page'
import { generateMetadata as mtg } from '@/app/mtg/[id]/page'
import { generateMetadata as lorcana } from '@/app/lorcana/[id]/page'
import { generateMetadata as onepiece } from '@/app/onepiece/[id]/page'
import { generateMetadata as other } from '@/app/other/[id]/page'
import { generateMetadata as yugioh } from '@/app/yugioh/[id]/page'
beforeEach(() => { vi.clearAllMocks(); mock.row = { visibility: 'private', card_name: 'PRIVATE_TEST_CARD' } })
describe('card metadata privacy', () => {
  for (const [name, generate] of Object.entries({ pokemon, sports, mtg, lorcana, onepiece, other, yugioh })) {
    it(`${name}: malformed and missing card IDs return not-found responses`, async () => {
      await expect(generate({ params: Promise.resolve({ id: 'not-a-card-id' }) })).rejects.toMatchObject({ digest: 'NEXT_HTTP_ERROR_FALLBACK;404' })
      mock.row = null
      await expect(generate({ params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }) })).rejects.toMatchObject({ digest: 'NEXT_HTTP_ERROR_FALLBACK;404' })
    })
    it(`${name}: private and unknown visibility never expose identity or a signed image`, async () => {
      for (const visibility of ['private', null, undefined]) {
        mock.row!.visibility = visibility
        const metadata = await generate({ params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }) })
        expect(metadata.robots).toMatchObject({ index: false, follow: false })
        expect(JSON.stringify(metadata)).not.toContain('PRIVATE_TEST_CARD')
        expect(mock.image).not.toHaveBeenCalled()
      }
    })
  }
})
