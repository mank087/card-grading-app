/**
 * Founder / Card Lover / VIP emblem marks as SVG paths.
 *
 * Two reasons these are paths rather than the text glyphs production uses:
 *
 *  1. @react-pdf ships the base-14 PDF fonts, and Helvetica has no U+2605
 *     BLACK STAR, U+2665 BLACK HEART or U+25C6 BLACK DIAMOND. Setting them as
 *     text renders blank or tofu, which is exactly what was showing on the back
 *     labels. A path always draws.
 *  2. Colour. Production's emblems (#FFD700 gold, #f43f5e rose, #6366f1 indigo)
 *     sit on ModernBackLabel's DARK gradient, where bright saturated marks pop.
 *     The Heritage back is a light field, so the same colours land around
 *     1.4:1 against white and effectively disappear. These are the same hues
 *     pulled dark enough to hold on paper.
 *
 * All three are authored in a 0..100 box and centred on (50,50), so a caller
 * scales by setting the viewBox size and nothing else has to change.
 */

export interface EmblemSpec {
  id: 'founder' | 'cardLover' | 'vip'
  word: string
  /** For the light Heritage field. */
  color: string
  /** What production uses on its dark back label, for reference. */
  productionColor: string
  path: string
}

/** Five-pointed star, points up, centred (50,50). */
const STAR = (() => {
  const cx = 50, cy = 52, outer = 46, inner = 18.5
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner
    // -90deg so a point faces up rather than a valley.
    const a = (Math.PI / 5) * i - Math.PI / 2
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`)
  }
  return `M ${pts[0]} L ${pts.slice(1).join(' L ')} Z`
})()

/** Heart. Two arcs into a point, rather than beziers — fewer ways to go wrong. */
const HEART =
  'M 50 92 C 20 70 6 52 6 34 C 6 18 18 8 31 8 C 40 8 47 13 50 20 ' +
  'C 53 13 60 8 69 8 C 82 8 94 18 94 34 C 94 52 80 70 50 92 Z'

/** Diamond: a square on its point. */
const DIAMOND = 'M 50 6 L 92 50 L 50 94 L 8 50 Z'

export const EMBLEMS: Record<EmblemSpec['id'], EmblemSpec> = {
  founder: {
    id: 'founder', word: 'FOUNDER', path: STAR,
    color: '#A67C1B', productionColor: '#FFD700',
  },
  cardLover: {
    id: 'cardLover', word: 'CARD LOVER', path: HEART,
    color: '#E11D48', productionColor: '#F43F5E',
  },
  vip: {
    id: 'vip', word: 'VIP', path: DIAMOND,
    color: '#4338CA', productionColor: '#6366F1',
  },
}

export const EMBLEM_ORDER: EmblemSpec['id'][] = ['founder', 'cardLover', 'vip']
