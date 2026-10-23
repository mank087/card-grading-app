'use client'

import { useEffect, useState } from 'react'
import { SOLD_PROOF } from '@/data/soldProof'

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

/**
 * Real InstaList sales on the grading wait screen. Display only: no links,
 * because anything that navigates away mid-grade costs us the report view.
 * Cycles while `active`; reduced motion and hidden tabs hold the current sale.
 */
export function SoldProofTicker({ active }: { active: boolean }) {
  const { examples } = SOLD_PROOF
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (!active) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const timer = window.setInterval(() => {
      if (!document.hidden && !motion.matches) setIndex(i => (i + 1) % examples.length)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [active, examples.length])

  const sale = examples[index]
  return (
    <section className="dcm-sold-ticker" aria-label="Recent DCM graded card sales">
      <p className="dcm-eyebrow">Sold with a DCM grade</p>
      <div className="dcm-sold-ticker__row" aria-live="polite">
        <div className="dcm-sold-ticker__slab">
          {examples.map((e, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- small static thumbnails, all mounted so the swap never flashes
            <img key={e.serial} src={`/why-dcm/sold/${e.serial}.webp`} alt={i === index ? `${e.name} in a DCM ${e.grade} slab` : ''} aria-hidden={i !== index} className={i === index ? 'is-active' : undefined} width={52} height={86} />
          ))}
        </div>
        <div className="dcm-sold-ticker__text">
          <strong>{sale.name} · DCM {sale.grade}</strong>
          <span>Sold {money(sale.sold)} · raw average {money(sale.rawAvg)}</span>
        </div>
        <span className="dcm-sold-ticker__badge">+{Math.round((sale.sold / sale.rawAvg - 1) * 100)}%</span>
      </div>
    </section>
  )
}
