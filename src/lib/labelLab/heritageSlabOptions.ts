/**
 * Heritage slab option lists (band patterns, logo treatments, logo colours).
 *
 * Deliberately free of @react-pdf/renderer so client UIs (Label Lab) can
 * import these statically and still lazy-load the PDF renderer.
 */
export { BAND_PATTERNS } from './bandGeometry'
export type { BandPattern } from './bandGeometry'

/**
 * How the DCM mark is presented at the bottom edge.
 *
 * On the ivory field a bare navy mark at 200x78 mockup-px is honest but quiet —
 * at 2.8" it reads as a smudge from arm's length, which defeats the point of
 * moving it to the bottom centre in the first place. Each treatment below buys
 * presence a different way, and they cost different amounts of ink.
 */
export type LogoColor = 'black' | 'color' | 'white'

export const LOGO_COLORS: { id: LogoColor; name: string }[] = [
  { id: 'black', name: 'Black' },
  { id: 'color', name: 'Colour' },
  { id: 'white', name: 'White' },
]

export type LogoTreatment = 'plate' | 'rules' | 'plain'

export const LOGO_TREATMENTS: { id: LogoTreatment; name: string; note: string }[] = [
  { id: 'plate', name: 'Purple plate', note: 'White mark knocked out of a brand-purple rounded plate.' },
  { id: 'rules', name: 'Colour mark + rules', note: 'The navy mark with a short horizontal rule either side. Almost no extra ink, and it anchors the mark without committing the design to a shape.' },
  { id: 'plain', name: 'Plain (reference)', note: 'Bare navy mark on ivory, kept only for comparison.' },
]
