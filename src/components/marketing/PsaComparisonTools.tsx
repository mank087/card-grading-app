'use client'

import { useState } from 'react'
import Link from 'next/link'
import { pricingTiers, VIP_PACKAGE } from '@/lib/creditPackages'
import { useServerShowcase } from '@/components/design/ShowcaseProvider'
import { HeritageCard } from '@/components/design/HeritageCard'
import { showcaseHref, showcaseSubgrade } from '@/components/design/featuredCard'
import styles from './PsaExperience.module.css'

const inspections = [
  ['centering', 'Centering', 'Compare the borders and alignment on the front and back of the card.'],
  ['corners', 'Corners', 'Look closely at the tips for rounding, whitening and other visible wear.'],
  ['edges', 'Edges', 'Inspect the perimeter for chips, whitening and roughness.'],
  ['surface', 'Surface', 'Examine visible scratches, print lines and other surface details.'],
] as const

export function PsaReportExample() {
  const cards = useServerShowcase('reports-and-labels') ?? []
  const [selected, setSelected] = useState(0)
  const [inspection, setInspection] = useState(0)
  const card = cards[selected]
  const [key, title, description] = inspections[inspection]
  const score = card ? showcaseSubgrade(card, key) : null
  return <div className={styles.reportGrid}>
    <div className={styles.cardExample}>
      {card ? <Link href={showcaseHref(card)} aria-label={`Open ${card.card_name} report`}><HeritageCard card={card} /></Link> : <p>Browse <Link href="/featured">real graded cards</Link> and their complete reports.</p>}
      <div className={styles.choices} role="group" aria-label="Choose a real card report">{cards.map((item, index) => <button key={item.id} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)}>{item.card_name}</button>)}</div>
    </div>
    <div>
      <p className="dcm-eyebrow">The evidence behind the grade</p>
      <h2>A grade you can explore.</h2>
      <p>Start with the card. See its four subgrades, then open the actual report to examine the condition analysis and reasons behind the result.</p>
      <div className={styles.choices} role="group" aria-label="Explore the four subgrades">{inspections.map(([id, label], index) => <button key={id} type="button" aria-pressed={inspection === index} onClick={() => setInspection(index)}>{label}</button>)}</div>
      <div className={styles.inspection} aria-live="polite">
        <p className="dcm-eyebrow">{title} · what we inspect</p><p>{description}</p>
        {card && <><strong>{score === null ? 'See report for score' : `${score} / 10`}<span>Recorded {title.toLowerCase()} subgrade</span></strong>{score !== null && <meter min={0} max={10} value={score} aria-label={`${title} subgrade`}>{score} out of 10</meter>}</>}
        <p className={styles.note}>These are recorded results. The inspection descriptions explain the criteria; the linked report contains this card’s findings.</p>
      </div>
      <Link className={styles.primary} href={card ? showcaseHref(card) : '/featured'}>Explore the Full Report →</Link>
    </div>
  </div>
}

export function PsaCostComparison() {
  const [count, setCount] = useState(20)
  const packs = [...pricingTiers, { ...VIP_PACKAGE, id: 'vip' }]
  const pack = packs.find(item => item.credits === count)!
  const psa = count * 59.99
  const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  return <div className={styles.calculator}>
    <div><p className="dcm-eyebrow">Compare your grading budget</p><h2>How many cards are you considering?</h2><p>Compare a DCM digital assessment pack with PSA’s announced Standard service. Choose the outcome that suits your collection.</p></div>
    <div className={styles.choices} role="group" aria-label="Number of cards">{packs.map(item => <button type="button" key={item.id} aria-pressed={count === item.credits} onClick={() => setCount(item.credits)}>{item.credits} {item.credits === 1 ? 'card' : 'cards'}</button>)}</div>
    <div aria-live="polite" aria-atomic="true">
      <div className={styles.costRow}><div><strong>DCM · {pack.name} pack</strong><span>{money(pack.price)}<small>one-time purchase</small></span></div><div className={styles.track}><div className={styles.dcmBar} style={{ width: `${pack.price / psa * 100}%` }} /></div><p>{count} digital assessments. Reports and printable labels included.</p></div>
      <div className={styles.costRow}><div><strong>PSA · Standard</strong><span>{money(psa)}<small>{count} × $59.99</small></span></div><div className={styles.track}><div className={styles.psaBar} /></div><p>Physical authentication, grading and encapsulation. Announced opening: September 14, 2026.</p></div>
    </div>
    <p className={styles.note}>USD grading fees only. Shipping, taxes, promotions and first-purchase bonuses excluded. Bar lengths use the same zero-based scale. Different services and outputs; DCM grades do not predict PSA grades. Standard’s maximum insured value is $1,000 per card. <a href="https://www.psacard.com/articles/articleview/15763" target="_blank" rel="noopener noreferrer">PSA announcement ↗</a></p>
    <Link className={styles.primary} href="/login?mode=signup&redirect=%2Fupload">Try DCM with 2 Free Credits →</Link>
  </div>
}
