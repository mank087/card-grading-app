'use client'
import { HeritageCard } from './HeritageCard'
import { ActionLink, Icon } from './Primitives'
import { showcaseHref, type ShowcaseCard } from './featuredCard'
export function CardShowcase({ card, loading = false }: { card?: ShowcaseCard; loading?: boolean; detailed?: boolean }) {
  return <div className="dcm-authentic-showcase" aria-busy={loading}>
    {card ? <><HeritageCard card={card} /><ActionLink href={showcaseHref(card)} variant="text">View this card’s report <Icon name="arrow" /></ActionLink></> : <p className="dcm-lead">Explore featured cards and their Heritage labels.<br /><ActionLink href="/featured" variant="text">View Featured Cards <Icon name="arrow" /></ActionLink></p>}
  </div>
}
