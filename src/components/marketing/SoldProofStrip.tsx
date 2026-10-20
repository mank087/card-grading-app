'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { SOLD_PROOF } from '@/data/soldProof'
import styles from './SoldProofStrip.module.css'

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`
const pct = (r: number) => `${r >= 0 ? '+' : ''}${Math.round(r * 100)}%`

/**
 * 0→1 progress per stat, run once when the list scrolls into view, staggered.
 * Starts at 1 so server HTML and no-JS visitors see the real numbers; reduced
 * motion skips the animation.
 */
function useCountUp(count: number, duration = 1400, stagger = 150) {
  const ref = useRef<HTMLUListElement>(null)
  const [progress, setProgress] = useState<number[]>(() => Array(count).fill(1))
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setProgress(Array(count).fill(0))
    let frame = 0
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      const start = performance.now()
      const tick = (now: number) => {
        const next = Array.from({ length: count }, (_, i) => {
          const t = Math.min(Math.max((now - start - i * stagger) / duration, 0), 1)
          return 1 - Math.pow(1 - t, 3) // ease-out cubic
        })
        setProgress(next)
        if (next.some(p => p < 1)) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }, { threshold: 0.4 })
    observer.observe(el)
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [count, duration, stagger])
  return { ref, progress }
}

/** Real InstaList sales vs the raw market, near the top of /why-dcm. */
export function SoldProofStrip() {
  const { stats, examples } = SOLD_PROOF
  const [index, setIndex] = useState(0)
  const sale = examples[index]
  const top = Math.max(sale.sold, sale.rawAvg)
  const go = (step: number) => setIndex(i => (i + step + examples.length) % examples.length)
  const { ref: statsRef, progress } = useCountUp(stats.length)

  return <section className="dcm-section dcm-surface" aria-labelledby="sold-proof-title"><div className={`dcm-container ${styles.section}`}>
    <div className={styles.intro}>
      <p className="dcm-eyebrow">Real InstaList sales</p>
      <h2 id="sold-proof-title">Buyers pay more for a card they can trust.</h2>
      <p className="dcm-lead">A DCM grade shows buyers the condition before they bid. Here is what DCM graded cards sold for through InstaList, next to what the same cards sold for ungraded.</p>
      <ul className={styles.stats} ref={statsRef}>
        {stats.map((s, i) => <li key={s.claim}>
          <strong aria-label={pct(s.premium)}>{pct(s.premium * progress[i])}</strong>
          <span className={styles.claim}>{s.claim}</span>
        </li>)}
      </ul>
    </div>

    <div className={styles.carousel} role="region" aria-roledescription="carousel" aria-label="DCM graded card sales">
      <article className={styles.sale} aria-live="polite" aria-label={`${index + 1} of ${examples.length}: ${sale.name}`}>
        <Link href={`/${sale.category}/${sale.cardId}`} className={styles.slab} aria-label={`View the DCM ${sale.grade} report for ${sale.name}`}>
          {/* All six stay mounted so switching slides cross-fades instead of waiting on a load. */}
          {examples.map((e, i) => <Image key={e.serial} src={`/why-dcm/sold/${e.serial}.webp`} alt={i === index ? `${e.name} in a DCM ${e.grade} slab` : ''} aria-hidden={i !== index} width={520} height={865} sizes="(max-width: 640px) 150px, 200px" quality={90} loading="eager" className={i === index ? styles.active : undefined} />)}
        </Link>
        <div className={styles.details}>
          <p className={styles.grade}>DCM {sale.grade}</p>
          <h3>{sale.name}</h3>
          <p className={styles.setLine}>{sale.setLine}</p>
          <div className={styles.bars}>
            <span>DCM {sale.grade} sold</span>
            <div className={styles.track}><div className={styles.soldBar} style={{ width: `${Math.round(sale.sold / top * 100)}%` }} /></div>
            <strong>{money(sale.sold)}</strong>
            <span>Raw average</span>
            <div className={styles.track}><div className={styles.rawBar} style={{ width: `${Math.round(sale.rawAvg / top * 100)}%` }} /></div>
            <strong className={styles.rawValue}>{money(Math.round(sale.rawAvg))}</strong>
          </div>
          <p className={styles.badge}>{pct(sale.sold / sale.rawAvg - 1)} over raw</p>
          <p className={styles.meta}>{sale.format === 'Auction' ? 'Sold at auction' : 'Sold'} on eBay via InstaList · raw average of {sale.rawSales} ungraded sales</p>
        </div>
      </article>
      <div className={styles.controls}>
        <button type="button" onClick={() => go(-1)} aria-label="Previous sale">←</button>
        <div className={styles.dots} role="group" aria-label="Choose a sale">
          {examples.map((e, i) => <button type="button" key={e.cardId} onClick={() => setIndex(i)} aria-pressed={i === index} aria-label={`${e.name}, DCM ${e.grade}`} />)}
        </div>
        <button type="button" onClick={() => go(1)} aria-label="Next sale">→</button>
      </div>
    </div>

    <p className={`dcm-fineprint ${styles.fineprint}`}>
      Raw average is the trimmed mean of ungraded eBay sales of the same card within 180 days of the DCM sale, from PriceCharting and SportsCardsPro. Averages compare the total DCM sale prices with the total raw average of the same cards, for sales completed through InstaList. Premiums tend to be largest on lower-priced cards. Results vary by card and grade, and lower grades often sell below raw. Past sales do not guarantee future prices.
    </p>
  </div></section>
}
