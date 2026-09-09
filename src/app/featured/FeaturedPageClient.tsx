'use client'

import { useEffect, useState } from 'react'
import FeaturedCardTile from '@/components/FeaturedCardTile'
import { ActionLink } from '@/components/design/Primitives'
import { showcaseGrade, type ShowcaseCard } from '@/components/design/featuredCard'

export default function FeaturedPageClient() {
  const [cards, setCards] = useState<ShowcaseCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All categories')
  const [sort, setSort] = useState('recent')
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(false)
    fetch('/api/cards/featured?limit=30', { signal: controller.signal })
      .then(res => { if (!res.ok) throw new Error('Unavailable'); return res.json() })
      .then(data => setCards(Array.isArray(data.cards) ? data.cards : []))
      .catch(() => { if (!controller.signal.aborted) setError(true) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [attempt])
  const categories = [...new Set(cards.map(card => card.category).filter((value): value is string => Boolean(value)))].sort()
  const filtered = cards.filter(card => (category === 'All categories' || card.category === category)
    && `${card.card_name ?? ''} ${card.card_set ?? ''} ${card.serial ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))
  if (sort === 'grade') filtered.sort((a, b) => (showcaseGrade(b) ?? 0) - (showcaseGrade(a) ?? 0))
  if (sort === 'name') filtered.sort((a, b) => (a.card_name ?? '').localeCompare(b.card_name ?? ''))
  return <div className="dcm-brand dcm-browse-page">
    <section className="dcm-hero dcm-dark">
      <div className="dcm-container">
        <p className="dcm-eyebrow">The community showcase</p>
        <h1>Featured graded cards.<br /><span>Every detail counts.</span></h1>
        <p className="dcm-lead">Explore featured cards, their Heritage labels and the condition analysis behind each grade.</p>
        <div className="dcm-actions"><ActionLink href="#cards" variant="primary">Browse featured cards</ActionLink><ActionLink href="/grading-standard" variant="secondary">Understand the grades</ActionLink></div>
      </div>
    </section>
    <section id="cards" className="dcm-container dcm-section" aria-label="Featured Cards">
      <div className="dcm-browse-toolbar">
        <label>Find a card<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Card name, set or serial number" /></label>
        <label>Category<select value={category} onChange={event => setCategory(event.target.value)}><option>All categories</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Sort by<select value={sort} onChange={event => setSort(event.target.value)}><option value="recent">Recently graded</option><option value="grade">Highest grade</option><option value="name">Card name</option></select></label>
      </div>
      <p className="dcm-browse-count" role="status">{loading ? 'Loading featured cards…' : error ? 'Featured cards could not be loaded.' : `${filtered.length} of ${cards.length} featured cards`}</p>
      {error ? <div className="dcm-browse-empty"><h2>Please try again</h2><p>The card showcase is temporarily unavailable.</p><button className="dcm-button dcm-button--primary" onClick={() => setAttempt(value => value + 1)}>Reload cards</button></div>
        : loading ? <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" aria-hidden="true">{[0, 1].map(key => <div key={key} className="h-96 bg-gray-200 rounded-2xl animate-pulse" />)}</div>
        : filtered.length ? <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">{filtered.map(card => <FeaturedCardTile key={card.id} card={card} />)}</div>
        : <div className="dcm-browse-empty"><h2>{cards.length ? 'No matching cards' : 'The next cards are on their way'}</h2><p>{cards.length ? 'Try another name, set or category.' : 'Check back soon for more graded cards from the community.'}</p>{cards.length > 0 && <button className="dcm-button dcm-button--secondary" onClick={() => { setSearch(''); setCategory('All categories') }}>Clear filters</button>}</div>}
    </section>
  </div>
}
