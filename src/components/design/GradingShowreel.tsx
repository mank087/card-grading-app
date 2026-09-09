'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { getCardLabelData } from '@/lib/useLabelData'
import { resolveGradeChip, GRADE_10_FOIL_CSS } from '@/lib/labelPresets'
import { HeritageCard, ShowcasePhoto } from './HeritageCard'
import { ActionLink, Icon } from './Primitives'
import { showcaseHref, showcaseSubgrade, type ShowcaseCard } from './featuredCard'
const categories = ['centering', 'corners', 'edges', 'surface']
export function GradingShowreel({ cards }: { cards: ShowcaseCard[] }) {
  const [{ index, step }, setFrame] = useState({ index: 0, step: 0 })
  const [reduced, setReduced] = useState(true)
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const motion = () => setReduced(media.matches)
    const visibility = () => setVisible(!document.hidden)
    motion(); visibility()
    media.addEventListener('change', motion); document.addEventListener('visibilitychange', visibility)
    return () => { media.removeEventListener('change', motion); document.removeEventListener('visibilitychange', visibility) }
  }, [])
  useEffect(() => {
    if (reduced || !visible || !cards.length) return
    const timer = window.setInterval(() => setFrame(frame => frame.step >= 11 ? { index: (frame.index + 1) % cards.length, step: 0 } : { ...frame, step: frame.step + 1 }), 1000)
    return () => window.clearInterval(timer)
  }, [reduced, visible, cards.length])
  const card = cards[index % Math.max(cards.length, 1)]
  const phase = reduced ? 6 : Math.min(step, 6)
  const label = card ? getCardLabelData(card) : null
  const chip = resolveGradeChip(label?.grade, true)
  if (!card || !label) return <div className="dcm-reel dcm-reel--loading" role="region" aria-label="Card analysis preview loading" aria-busy="true">
    <div className="dcm-reel-top"><span>DCM OPTIC™ · CARD ANALYSIS</span></div>
    <div className="dcm-reel-scene">
      <div className="dcm-reel-card"><div className="dcm-reel-skeleton-card"><span className="dcm-reel-skeleton-label" /><span className="dcm-photo-loading" /></div></div>
      <div className="dcm-reel-analysis"><p className="dcm-eyebrow">Card condition report</p><p className="dcm-reel-name">Every detail, connected.</p><p className="dcm-reel-stage">Loading a real graded card</p><dl className="dcm-reel-scores">{categories.map(key => <div key={key}><dt>{key}</dt><dd><span className="dcm-reel-track" /><strong>…</strong></dd></div>)}</dl><p className="dcm-fineprint">Card grade, condition analysis, and Heritage label.</p><ActionLink href="/featured" variant="text">Explore Featured Cards</ActionLink></div>
    </div>
  </div>
  const choose = (next: number) => setFrame({ index: next, step: reduced ? 6 : 0 })
  return <div className="dcm-reel" role="region" aria-label="Featured card grading animation">
    <div className="dcm-reel-top"><span>DCM OPTIC™ · CARD ANALYSIS</span></div>
    <div className="dcm-reel-scene" key={card.id}>
      <div className={`dcm-reel-card ${phase >= 6 ? 'dcm-reel-card--complete' : ''}`}>
        <div className="dcm-reel-raw" aria-hidden={phase >= 6}><ShowcasePhoto card={card} /><div className={`dcm-scan-line ${phase > 4 ? 'dcm-scan-line--done' : ''}`} aria-hidden="true" /></div>
        <div className="dcm-reel-labeled" aria-hidden={phase < 6}><HeritageCard card={card} /></div>
      </div>
      <div className="dcm-reel-analysis">
        <p className="dcm-eyebrow">{card.category} · {label.serial}</p><p className="dcm-reel-name">{label.primaryName}</p><p className="dcm-reel-context">{label.contextLine}</p>
        <p className="dcm-reel-stage">{phase === 0 ? 'Scanning the card' : phase < 5 ? 'Reviewing card condition' : phase === 5 ? 'Your DCM grade' : 'Your card. Your Heritage label.'}</p>
        <dl className="dcm-reel-scores">{categories.map((key, i) => {
          const score = showcaseSubgrade(card, key)
          const revealed = phase > i
          const color = resolveGradeChip(score, true).ink
          return <div key={key}><dt>{key}</dt><dd><span className="dcm-reel-track" aria-hidden="true"><span style={{ transform: `scaleX(${revealed && score !== null ? score / 10 : 0})`, background: color }} /></span><strong>{revealed ? score ?? '—' : '…'}</strong></dd></div>
        })}</dl>
        {phase < 5 && <div className="dcm-reel-pending"><strong>Building the condition report</strong><p>The recorded grade and Heritage label appear next.</p></div>}
        <div className={`dcm-reel-result ${phase >= 5 ? 'dcm-reel-result--visible' : ''}`} aria-hidden={phase < 5}>
          <div className={`dcm-reel-chip ${label.grade === 10 ? 'dcm-reel-chip--foil' : ''}`} style={{ background: label.grade === 10 ? `linear-gradient(${chip.fill}, ${chip.fill}) padding-box, ${GRADE_10_FOIL_CSS} border-box` : chip.fill, color: chip.ink }}><strong style={label.grade === 10 ? { backgroundImage: GRADE_10_FOIL_CSS, backgroundClip: 'text', color: 'transparent' } : undefined}>{label.grade ?? '—'}</strong><span>{chip.label}</span></div>
          <div><strong>DCM card grade</strong><p>{label.condition}</p><ActionLink href={showcaseHref(card)} variant="text">View the Full Report <Icon name="arrow" /></ActionLink></div>
        </div>
      </div>
    </div>
    <div className="dcm-reel-controls"><div className="dcm-reel-card-select" role="group" aria-label="Choose a featured card">{cards.map((item, i) => <button key={item.id} type="button" aria-label={`Show ${item.card_name}`} aria-pressed={index === i} onClick={() => choose(i)}><Image src={item.front_url!} alt="" width={35} height={49} unoptimized /><span>{item.card_name}</span></button>)}</div></div>
  </div>
}
