'use client'

/**
 * Text-free slab strip that shows a package's credit count visually: one
 * DCM Heritage slab per grading credit. Source art is rendered offline by
 * marketing/package-refresh-2026-09-14/heritage/render-montage.tsx.
 * Tapping the strip opens the full package sheet in a lightbox.
 */
import ZoomableImage from '@/components/marketing/ZoomableImage'

export type MontagePack =
  | 'basic'
  | 'pro'
  | 'elite'
  | 'vip'
  | 'card-lovers-monthly'
  | 'card-lovers-annual'

const ALT: Record<MontagePack, string> = {
  basic: 'One DCM Heritage slab representing 1 grading credit',
  pro: 'Five DCM Heritage slabs representing 5 grading credits',
  elite: 'Twenty DCM Heritage slabs representing 20 grading credits',
  vip: 'A grid of 150 DCM Heritage slabs representing 150 grading credits',
  'card-lovers-monthly': 'A grid of 70 DCM Heritage slabs representing 70 grading credits each month',
  'card-lovers-annual': 'A grid of 900 DCM Heritage slabs representing 900 grading credits each year',
}

const SHEET_ALT: Record<MontagePack, string> = {
  basic: 'DCM Basic package: 1 grading credit for $2.99',
  pro: 'DCM Pro package: 5 grading credits for $9.99',
  elite: 'DCM Elite package: 20 grading credits for $19.99',
  vip: 'DCM VIP package: 150 grading credits for $99',
  'card-lovers-monthly': 'DCM Card Lovers Monthly membership: 70 grading credits a month for $49.99',
  'card-lovers-annual': 'DCM Card Lovers Annual membership: 900 grading credits a year for $449',
}

interface PackageMontageProps {
  pack: MontagePack
  priority?: boolean
  className?: string
}

export default function PackageMontage({ pack, priority = false, className }: PackageMontageProps) {
  return (
    <ZoomableImage
      src={`/packages/dcm-package-${pack}-montage.jpg`}
      alt={ALT[pack]}
      width={1500}
      height={600}
      sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw"
      priority={priority}
      className={className}
      zoomSrc={`/packages/dcm-package-${pack}.jpg`}
      zoomWidth={1500}
      zoomHeight={1000}
      zoomAlt={SHEET_ALT[pack]}
      zoomLabel="Expand package details"
    />
  )
}
