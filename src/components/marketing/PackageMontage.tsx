/**
 * Text-free slab strip that shows a package's credit count visually: one
 * DCM Heritage slab per grading credit. Source art is rendered offline by
 * marketing/package-refresh-2026-09-14/heritage/render-montage.tsx.
 */
import Image from 'next/image'

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

interface PackageMontageProps {
  pack: MontagePack
  priority?: boolean
  className?: string
}

export default function PackageMontage({ pack, priority = false, className }: PackageMontageProps) {
  return (
    <Image
      src={`/packages/dcm-package-${pack}-montage.jpg`}
      alt={ALT[pack]}
      width={1500}
      height={600}
      sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw"
      priority={priority}
      loading={priority ? undefined : 'lazy'}
      className={className}
    />
  )
}
