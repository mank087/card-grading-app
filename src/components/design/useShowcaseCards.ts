'use client'
import { useServerShowcase } from './ShowcaseProvider'
import { useEffect, useState } from 'react'
import { diverseShowcaseCards, type ShowcaseCard } from './featuredCard'
let cached: { cards: ShowcaseCard[]; at: number } | undefined
let pending: Promise<ShowcaseCard[]> | undefined
function loadCards() {
  if (cached && Date.now() - cached.at < 60 * 1000) return Promise.resolve(cached.cards)
  if (!pending) pending = fetch('/api/cards/featured?limit=5&showcase=1')
    .then(async response => { if (!response.ok) throw new Error('Featured cards unavailable'); return response.json() })
    .then(data => { const cards = diverseShowcaseCards(Array.isArray(data.cards) ? data.cards : []); cached = { cards, at: Date.now() }; return cards })
    .finally(() => { pending = undefined })
  return pending
}
export function useShowcaseCards() {
  const initial = useServerShowcase('1')
  const [cards, setCards] = useState<ShowcaseCard[]>(() => diverseShowcaseCards(initial ?? []))
  useEffect(() => { if (initial?.length) return; let active = true; loadCards().then(cards => { if (active) setCards(cards) }).catch(() => {}); return () => { active = false } }, [initial])
  return cards
}
