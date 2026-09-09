'use client'
import Link from 'next/link'
import { HeritageCard } from './HeritageCard'
import { useShowcaseCards } from './useShowcaseCards'
import { showcaseHref } from './featuredCard'
export function CardVisualRail({ compact = false }: { compact?: boolean }) {
  const cards = useShowcaseCards()
  if (!cards.length) return null
  return <div className={`dcm-card-visual-rail ${compact ? 'dcm-card-visual-rail--compact' : ''}`} role="region" aria-label="Featured cards with Heritage labels">
    {cards.slice(0,5).map(card => <Link key={card.id} href={showcaseHref(card)} aria-label={`View ${card.card_name} report`}><HeritageCard card={card} /><span>{card.card_name}</span></Link>)}
  </div>
}
