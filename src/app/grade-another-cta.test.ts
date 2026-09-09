import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * Conversion guard (2026-09-09).
 *
 * 36% of new users graded exactly one card and stopped while a free credit was
 * still sitting on the account, because the card detail page ended with a
 * delete button and no next step. Every card detail client now carries an
 * owner-only "Grade another card" block after the DCM Optic version footer.
 *
 * The same files used to link to /upload/starwars, a route that does not
 * exist. Only /upload/{mtg,onepiece,pokemon,sports} are real upload routes;
 * everything else goes through /upload?category=<key>, and the key must be one
 * of CARD_TYPES in src/lib/cardTypeConfig.ts or the page silently falls back to
 * Sports. Star Wars is an "Other" sub-category, not a top-level type.
 */

const root = path.resolve(__dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')

const CARD_DETAIL_CLIENTS = [
  'app/pokemon/[id]/CardDetailClient.tsx',
  'app/mtg/[id]/CardDetailClient.tsx',
  'app/sports/[id]/CardDetailClient.tsx',
  'app/lorcana/[id]/CardDetailClient.tsx',
  'app/onepiece/[id]/CardDetailClient.tsx',
  'app/yugioh/[id]/CardDetailClient.tsx',
  'app/starwars/[id]/CardDetailClient.tsx',
  'app/other/[id]/CardDetailClient.tsx',
]

// Upload routes that actually exist on disk. Anything else must be a query param.
const REAL_UPLOAD_ROUTES = ['mtg', 'onepiece', 'pokemon', 'sports']

describe('grade another card CTA', () => {
  for (const file of CARD_DETAIL_CLIENTS) {
    it(`${file} offers the owner a next card`, () => {
      const src = read(file)
      expect(src).toContain("'Grade another card'")
      expect(src).toContain("'Get credits to grade more'")
      expect(src).toContain("'Your free grades are used up.'")
      // Owner gate, not merely a logged-in viewer.
      expect(src).toContain('session.user.id === card.user_id')
      // Reuses the shared credits context rather than a second fetch.
      expect(src).toContain('isLoading: creditsLoading')
      // Design-system primitive, not a hand-rolled button.
      expect(src).toContain("from '@/components/design/Primitives'")
    })

    it(`${file} links only to upload routes that exist`, () => {
      const src = read(file)
      const deadPathLinks = [...src.matchAll(/\/upload\/([a-z]+)/g)]
        .map((m) => m[1])
        .filter((slug) => !REAL_UPLOAD_ROUTES.includes(slug))
      expect(deadPathLinks).toEqual([])
      expect(src).not.toContain('/upload/starwars')
      // "Star Wars" is not a CARD_TYPES key, so the upload page would silently
      // reset the picker to Sports.
      expect(src).not.toContain('category=Star Wars')
      expect(src).not.toContain('category=Star%20Wars')
    })
  }

  it('the first grade congrats modal is owner-gated everywhere', () => {
    for (const file of CARD_DETAIL_CLIENTS) {
      const src = read(file)
      expect(src).not.toContain('if (session?.user?.id) {\r\n        setShowFirstGradeModal(true);')
      expect(src).not.toContain('if (session?.user?.id) {\n        setShowFirstGradeModal(true);')
    }
  })
})
