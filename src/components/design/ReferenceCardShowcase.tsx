'use client'

import { useServerShowcase } from '@/components/design/ShowcaseProvider'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LEARNING_CARD_IDS } from '@/lib/cards/marketingShowcase'
import { HeritageCard } from './HeritageCard'
import { showcaseHref, type ShowcaseCard } from './featuredCard'

export function ReferenceCardShowcase({ page, category }: { page: keyof typeof LEARNING_CARD_IDS; category?: 'Pokemon' | 'Sports' }) {
  const initial = useServerShowcase(page)
  const [cards, setCards] = useState<ShowcaseCard[]>(() => LEARNING_CARD_IDS[page].flatMap(id => (initial ?? []).filter(card => card.id === id && card.front_url)).filter(card => !category || (category === 'Pokemon' ? card.category?.toLowerCase() === 'pokemon' : ['sports','football','baseball','basketball','hockey','soccer','wrestling'].includes(card.category?.toLowerCase() || ''))))
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (initial?.length) return
    const controller = new AbortController()
    fetch(`/api/cards/featured?showcase=${page}&limit=3`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Examples unavailable'); return response.json() })
      .then(data => setCards(LEARNING_CARD_IDS[page].flatMap(id => {
        const card = (Array.isArray(data.cards) ? data.cards : []).find((card: ShowcaseCard) => card.id === id && card.front_url)
        const matchesCategory = !category || (category === 'Pokemon' ? card?.category?.toLowerCase() === 'pokemon' : ['sports', 'football', 'baseball', 'basketball', 'hockey', 'soccer', 'wrestling'].includes(card?.category?.toLowerCase() || ''))
        return card && matchesCategory ? [card] : []
      }))).catch(() => {})
    return () => controller.abort()
  }, [page, category, initial])
  const card = cards[index % Math.max(cards.length, 1)]
  return <div className="dcm-reference-showcase" role="region" aria-label="Real graded card examples">
    <div className="dcm-reference-card">
      {card ? <Link href={showcaseHref(card)} aria-label={`View ${card.card_name} condition report`}><HeritageCard card={card} /></Link> : <p className="dcm-fineprint">Explore public grades in <Link href="/featured">Featured Cards</Link>.</p>}
    </div>
    {card && <p className="dcm-reference-caption"><Link href={showcaseHref(card)}>{card.card_name} · View report →</Link></p>}
    {cards.length > 1 && <div className="dcm-reference-select" role="group" aria-label="Choose a card example">{cards.map((card, i) => <button type="button" key={card.id} onClick={() => setIndex(i)} aria-pressed={i === index}>{card.card_name}</button>)}</div>}
  </div>
}
