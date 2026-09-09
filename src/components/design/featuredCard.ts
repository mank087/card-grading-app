import { MARKETING_POKEMON_CARD_ID } from '@/lib/cards/marketingShowcase'

/** Public records from /api/cards/featured. No private card lookup. */
export interface ShowcaseCard {
  [key: string]: unknown
  id: string
  serial?: string | null
  card_name?: string | null
  category?: string | null
  front_url?: string | null
  back_url?: string | null
  card_set?: string | null
  card_colors?: { palette?: string[] | null; topEdgeColors?: string[] | null; primary?: string | null; secondary?: string | null } | null
  conversational_whole_grade?: number | null
  conversational_decimal_grade?: number | null
  dvg_decimal_grade?: number | null
  conversational_condition_label?: string | null
  conversational_weighted_sub_scores?: Record<string, unknown> | null
  conversational_sub_scores?: Record<string, unknown> | null
}

export function showcaseGrade(card: ShowcaseCard): number | null {
  const grade = card.conversational_whole_grade ?? card.conversational_decimal_grade ?? card.dvg_decimal_grade
  return typeof grade === 'number' && Number.isFinite(grade) && grade >= 1 && grade <= 10 ? Math.round(grade) : null
}

export function showcaseSubgrade(card: ShowcaseCard, key: string): number | null {
  const flat = card.conversational_weighted_sub_scores ?? card.conversational_sub_scores?.weighted as Record<string, unknown> | undefined
  const weighted = flat?.[`${key}_weighted`] ?? flat?.[key]
  const raw = card.conversational_sub_scores?.[key]
  const fallback = raw && typeof raw === 'object' && 'weighted' in raw ? raw.weighted : raw
  const score = weighted ?? fallback
  return typeof score === 'number' && Number.isFinite(score) && score >= 1 && score <= 10 ? Math.round(score) : null
}

export function showcaseHref(card: ShowcaseCard): string {
  const category = (card.category ?? '').toLowerCase()
  const route = ({ pokemon: 'pokemon', mtg: 'mtg', lorcana: 'lorcana', 'one piece': 'onepiece', onepiece: 'onepiece', 'yu-gi-oh': 'yugioh', yugioh: 'yugioh', sports: 'sports', football: 'sports', baseball: 'sports', basketball: 'sports', hockey: 'sports', soccer: 'sports', wrestling: 'sports' } as Record<string, string>)[category] ?? 'other'
  return card.id ? `/${route}/${encodeURIComponent(card.id)}` : '/featured'
}

/** Deliberately mix the public curated pool before filling remaining slots. */
export function diverseShowcaseCards(cards: ShowcaseCard[]): ShowcaseCard[] {
  const available = cards.filter(card => card.front_url && card.serial && showcaseGrade(card) !== null)
  const reviewedPokemon = available.find(card => card.id === MARKETING_POKEMON_CARD_ID && showcaseGrade(card) === 10)
  const groups = [/pokemon/i, /football|tom brady/i, /baseball|shohei|richie allen/i, /one piece/i, /other/i]
  const selected: ShowcaseCard[] = []
  for (const group of groups) {
    const match = selected.length === 0 && reviewedPokemon
      ? reviewedPokemon
      : available.find(card => !selected.includes(card) && group.test(`${card.category} ${card.card_name}`))
    if (match) selected.push(match)
  }
  return [...selected, ...available.filter(card => !selected.includes(card))]
}
