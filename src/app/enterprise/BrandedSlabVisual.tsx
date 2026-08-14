'use client'

/**
 * Slab examples for the enterprise page.
 *
 * These are real renders (public/enterprise/*.png): actual graded cards from
 * the DCM library inside actual Heritage labels, with each store's mark in
 * the bottom-centre slot — the exact position org branding occupies in
 * production. Rendered by scripts/_tmp-enterprise-slabs.ts.
 */

import Image from 'next/image'

interface SlabProps {
  src: string
  alt: string
  priority?: boolean
  float?: boolean
}

function Slab({ src, alt, priority = false, float = false }: SlabProps) {
  return (
    <div className={float ? 'slab-float' : undefined}>
      <Image
        src={src}
        alt={alt}
        width={800}
        height={1314}
        priority={priority}
        sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 380px"
        className="w-full h-auto drop-shadow-2xl"
      />
      <style jsx>{`
        .slab-float {
          animation: slabFloat 5s ease-in-out infinite;
        }
        @keyframes slabFloat {
          0%,
          100% {
            transform: translateY(0) rotate(-0.5deg);
          }
          50% {
            transform: translateY(-10px) rotate(0.5deg);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .slab-float {
            animation: none;
          }
        }
      `}</style>
    </div>
  )
}

const STORES = [
  {
    src: '/enterprise/slab-aces-v3.png',
    store: "Ace's Card Shop",
    caption: 'Diamond band, store red',
    alt: "Pikachu with Grey Felt Hat graded DCM 10 Gem Mint in a slab labelled for Ace's Card Shop",
  },
  {
    src: '/enterprise/slab-summit-v3.png',
    store: 'Summit Sports Cards',
    caption: 'Chevron band, store blue',
    alt: 'LeBron James Donruss Optic Downtown graded DCM 9 Mint in a slab labelled for Summit Sports Cards',
  },
  {
    src: '/enterprise/slab-dragons-v3.png',
    store: "Dragon's Hoard TCG",
    caption: 'Prism band, store green and gold',
    alt: "Monkey D. Luffy One Piece promo graded DCM 9 Mint in a slab labelled for Dragon's Hoard TCG",
  },
]

/** Three invented stores, real cards, real labels. */
export function StoreMockRow() {
  return (
    <div className="grid gap-8 sm:grid-cols-3">
      {STORES.map(s => (
        <figure key={s.store} className="m-0">
          <Slab src={s.src} alt={s.alt} />
          <figcaption className="mt-4 text-center">
            <span className="block font-semibold text-gray-900">{s.store}</span>
            <span className="block text-sm text-gray-500">{s.caption}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  )
}

/** Hero slab with the logo slot left open. */
export default function BrandedSlabVisual() {
  return (
    <div className="mx-auto w-full max-w-sm">
      <Slab
        float
        priority
        src="/enterprise/slab-your-logo-v4.png"
        alt="Aaron Judge Bowman Chrome graded 9 Mint in a DCM slab with the label's logo slot reserved for your brand"
      />
    </div>
  )
}
