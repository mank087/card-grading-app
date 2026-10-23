'use client'

import { useEffect, useState } from 'react'

// Typed endings for the homepage headline ("Card Grading" + phrase).
// The first phrase is what the server renders, crawlers index, and
// screen readers and reduced-motion visitors get, so keep the strongest first.
export const HERO_PHRASES = [
  'from Home',
  'for Every Card',
  'with Instant Results',
  'with Market Pricing',
  'and Selling Tools',
  'Your Way',
  'for Collectors',
  'for The Hobby',
]

const TYPE_MS = 60
const DELETE_MS = 30
const HOLD_MS = 2000
const FIRST_HOLD_MS = 2600
const GAP_MS = 350

// className styles the typed line, e.g. the campaign pages' accent-text classes.
export function HeroTypewriter({ phrases = HERO_PHRASES, className }: { phrases?: string[]; className?: string }) {
  const [index, setIndex] = useState(0)
  const [length, setLength] = useState(phrases[0].length)
  const [deleting, setDeleting] = useState(false)
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setAnimate(!query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!animate) { setIndex(0); setLength(phrases[0].length); setDeleting(false); return }
    const phrase = phrases[index]
    let delay: number
    let step: () => void
    if (!deleting && length < phrase.length) {
      delay = TYPE_MS; step = () => setLength(length + 1)
    } else if (!deleting) {
      delay = index === 0 ? FIRST_HOLD_MS : HOLD_MS; step = () => setDeleting(true)
    } else if (length > 0) {
      delay = DELETE_MS; step = () => setLength(length - 1)
    } else {
      delay = GAP_MS; step = () => { setDeleting(false); setIndex((index + 1) % phrases.length) }
    }
    const timer = window.setTimeout(step, delay)
    return () => window.clearTimeout(timer)
  }, [animate, deleting, index, length, phrases])

  return <>
    <span className="dcm-visually-hidden">{phrases[0]}</span>
    <span className={`dcm-typer${className ? ` ${className}` : ''}`} aria-hidden="true">
      {/* Invisible copies of every phrase share one grid cell so the line keeps the size of the longest one (no layout shift). The visible text is CSS-generated too, so the headline's only real text is "Card Grading" plus the first phrase. */}
      {phrases.map(p => <span key={p} className="dcm-typer-sizer" data-phrase={p} />)}
      <span className="dcm-typer-live" data-phrase={phrases[index].slice(0, length)}><span className={`dcm-typer-caret${animate ? '' : ' is-static'}`} /></span>
    </span>
  </>
}
