'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { HeritageCard } from './HeritageCard'
import { useShowcaseCards } from './useShowcaseCards'
import { showcaseHref } from './featuredCard'

export function OfferCardSlider() {
  const cards = useShowcaseCards().slice(0, 5)
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const timer = window.setInterval(() => {
      if (!motion.matches && !document.hidden && cards.length > 1) {
        setIndex(current => (current + 1) % cards.length)
      }
    }, 5000)
    return () => window.clearInterval(timer)
  }, [cards.length])

  const card = cards[index % Math.max(1, cards.length)]
  if (!card) return null
  return <div className="dcm-offer-slider" role="region" aria-label="Featured cards with Heritage labels">
    <div className="dcm-offer-slider-stage">
      <Link key={card.id} href={showcaseHref(card)} aria-label={`View ${card.card_name} report`}>
        <HeritageCard card={card} />
      </Link>
    </div>
    <div className="dcm-offer-slider-dots" role="group" aria-label="Choose a featured card">
      {cards.map((item, i) => <button key={item.id} type="button" aria-label={`Show ${item.card_name}`} aria-pressed={index % cards.length === i} onClick={() => setIndex(i)} />)}
    </div>
  </div>
}
