'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Icon, type IconName } from '@/components/design/Primitives'

const checks = [
  { title: 'Centering', text: 'Border balance and alignment of the printed design.', shape: 'centering' },
  { title: 'Corners', text: 'Corner shape, rounding, whitening and visible damage.', shape: 'corners' },
  { title: 'Edges', text: 'Edge wear, chips and the condition of the perimeter.', shape: 'edges' },
  { title: 'Surface', text: 'Scratches, print lines, dents and other visible surface marks.', shape: 'surface' },
]
const benefits: { title: string; text: string; icon: IconName; href: string; action: string }[] = [
  { title: 'Understand the condition', text: 'Review your grade, subgrades and written condition analysis together to understand the result.', icon: 'report', href: '/reports-and-labels', action: 'Explore card reports' },
  { title: 'Make the label your own', text: 'Create Heritage labels and explore designs for slabs, one-touch holders and top loaders in Label Studio.', icon: 'label', href: '/reports-and-labels', action: 'Explore labels' },
  { title: 'Track your collection', text: 'Organize your graded cards in binders and revisit the photos and reports behind each grade.', icon: 'collection', href: '/collection', action: 'Open My Collection' },
  { title: 'Follow your portfolio', text: 'Explore available market estimates and track your collection value, with pricing sources and context.', icon: 'chart', href: '/market-pricing', action: 'Explore portfolio tools' },
  { title: 'Prepare an eBay listing', text: 'Use InstaList to prepare listing photos and descriptions from your graded cards.', icon: 'sell', href: '/instalist-marketplace', action: 'Explore eBay InstaList' },
  { title: 'Grade across your collection', text: 'Pokémon, sports, Magic, Lorcana, One Piece, Yu-Gi-Oh!, Star Wars and other trading cards, all in one place.', icon: 'scan', href: '/why-dcm', action: 'See what DCM can do' },
]

/** Presentation-only cycling. Never advances the grading queue or reports completed checks. */
export function GradingWaitFeatures({ mode, active, children }: { mode: 'inspection' | 'benefits'; active: boolean; children?: ReactNode }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = mode === 'inspection' ? checks.length : benefits.length
  useEffect(() => {
    if (!active || paused) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const timer = window.setInterval(() => {
      if (!document.hidden && !motion.matches) setIndex(current => (current + 1) % count)
    }, mode === 'inspection' ? 4500 : 8000)
    return () => window.clearInterval(timer)
  }, [active, paused, count, mode])

  if (mode === 'inspection') return <div className={`dcm-inspection-cycle ${active ? `dcm-inspection-cycle--${checks[index].shape}` : ''}`}>
    <div className="dcm-inspection-cycle__image">{children}{active && <div className="dcm-inspection-cycle__overlay" aria-hidden="true"><span /><span /><span /><span /></div>}</div>
    <div className="dcm-inspection-cycle__explanation">
      <p className="dcm-eyebrow">What DCM checks</p>
      <div className="dcm-wait-tabs" role="group" aria-label="Explore inspection areas">{checks.map((item, i) => <button type="button" key={item.title} aria-pressed={index === i} onClick={() => { setIndex(i); setPaused(true) }}>{item.title}</button>)}</div>
      <p>{checks[index].text}</p>
      <small>Animated inspection overview. Your submission status is shown separately.</small>
    </div>
  </div>

  const benefit = benefits[index]
  return <section className="dcm-wait-benefits" aria-label="Things you can do with DCM" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false) }}>
    <p className="dcm-eyebrow">More from your grade</p>
    <div className="dcm-wait-benefits__heading"><Icon name={benefit.icon} /><h2>{benefit.title}</h2></div>
    <p>{benefit.text}</p>
    {active && <Link href={benefit.href}>{benefit.action} →</Link>}
    <div className="dcm-wait-tabs" role="group" aria-label="Choose a DCM benefit">{benefits.map((item, i) => <button type="button" key={item.title} aria-label={item.title} aria-pressed={index === i} onClick={() => setIndex(i)}><span aria-hidden="true">{i + 1}</span></button>)}</div>
  </section>
}
