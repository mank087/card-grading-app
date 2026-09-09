import { describe, expect, it } from 'vitest'
import { MARKETING_POKEMON_CARD_ID } from '@/lib/cards/marketingShowcase'
import { diverseShowcaseCards, showcaseGrade, showcaseHref, showcaseSubgrade, type ShowcaseCard } from './featuredCard'

const card: ShowcaseCard = { id: 'example' }
describe('public showcase data normalization', () => {
  it('prioritizes the reviewed Gengar only while its current grade is 10', () => {
    const mewtwo = { id: 'mewtwo', category: 'Pokemon', serial: '804433', front_url: '/mewtwo.jpg', conversational_whole_grade: 10 }
    const gengar = { ...mewtwo, id: MARKETING_POKEMON_CARD_ID, serial: '475225' }
    expect(diverseShowcaseCards([mewtwo, gengar])[0].id).toBe(MARKETING_POKEMON_CARD_ID)
    expect(diverseShowcaseCards([mewtwo, { ...gengar, conversational_whole_grade: 9 }])[0].id).toBe('mewtwo')
  })
  it('reads current flat weighted subgrades and their alternate storage location', () => {
    expect(showcaseSubgrade({ ...card, conversational_weighted_sub_scores: { corners_weighted: 8 }, conversational_sub_scores: { corners: { weighted: 9 } } }, 'corners')).toBe(8)
    expect(showcaseSubgrade({ ...card, conversational_sub_scores: { weighted: { surface_weighted: 7 } } }, 'surface')).toBe(7)
  })
  it('selects a diverse set without duplicates or unusable records', () => {
    const pool = ['Pokemon', 'Pokemon', 'Other', 'One Piece', 'Football', 'Baseball'].map((category, i) => ({ id: String(i), serial: String(i), front_url: '/card.jpg', category, conversational_whole_grade: 9 }))
    const result = diverseShowcaseCards([...pool, { id: 'missing' }])
    expect(result.slice(0, 5).map(card => card.category)).toEqual(['Pokemon', 'Football', 'Baseball', 'One Piece', 'Other'])
    expect(new Set(result.map(card => card.id)).size).toBe(6)
  })
  it('supports historical grade and nested subgrade records', () => {
    expect(showcaseGrade({ ...card, dvg_decimal_grade: 8.5 })).toBe(9)
    expect(showcaseSubgrade({ ...card, conversational_sub_scores: { corners: { weighted: 8 } } }, 'corners')).toBe(8)
  })
  it('prefers current values without replacing missing subgrades with the overall grade', () => {
    expect(showcaseGrade({ ...card, conversational_whole_grade: 7, dvg_decimal_grade: 9 })).toBe(7)
    expect(showcaseSubgrade({ ...card, conversational_whole_grade: 10 }, 'corners')).toBeNull()
    expect(showcaseSubgrade({ ...card, conversational_weighted_sub_scores: { corners: 7 }, conversational_sub_scores: { corners: { weighted: 9 } } }, 'corners')).toBe(7)
  })
  it('does not present invalid scores as real results', () => {
    for (const score of [NaN, Infinity, 0, -1, 11]) {
      expect(showcaseGrade({ ...card, conversational_whole_grade: score })).toBeNull()
      expect(showcaseSubgrade({ ...card, conversational_weighted_sub_scores: { surface: score } }, 'surface')).toBeNull()
    }
  })
  it('links straight to the card detail page for the card category', () => {
    // Contract changed 2026-09: showcase cards link to /{route}/{id}, not /verify/{serial}.
    expect(showcaseHref({ ...card, id: 'abc-123', category: 'Pokemon' })).toBe('/pokemon/abc-123')
    expect(showcaseHref({ ...card, id: 'abc-123', category: 'One Piece' })).toBe('/onepiece/abc-123')
    expect(showcaseHref({ ...card, id: 'abc-123', category: 'Baseball' })).toBe('/sports/abc-123')
    expect(showcaseHref({ ...card, id: 'abc-123', category: 'Something else' })).toBe('/other/abc-123')
    expect(showcaseHref({ ...card, id: 'a/b?c', category: 'Pokemon' })).toBe('/pokemon/a%2Fb%3Fc')
    expect(showcaseHref({ ...card, id: '' })).toBe('/featured')
  })
})
