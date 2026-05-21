/**
 * Apple-official "Download on the App Store" badge.
 *
 * Source SVGs live at public/app-store-badge/{Black,White}_lockup/SVG/. We use
 * the SVGs verbatim — Apple's marketing rules require we don't modify color
 * or proportions.
 *
 * Use variant="black" on light backgrounds, variant="white" on dark.
 *
 * Single source of truth for the App Store URL — every placement on the
 * marketing site (homepage, /why-dcm, footer, banner) routes through this
 * component. Pairs with GooglePlayBadge.tsx in all four placements.
 */

import Image from 'next/image'

// Universal short URL — Apple auto-redirects to the user's country store.
export const APP_STORE_URL = 'https://apps.apple.com/app/id6768663163'

interface Props {
  variant?: 'black' | 'white'
  /** Display height in px. Apple specifies minimum ~40px; we default to 48
   *  to read well next to bold buttons. Width auto-scales by aspect ratio. */
  height?: number
  className?: string
}

export default function AppStoreBadge({ variant = 'black', height = 48, className = '' }: Props) {
  const src = variant === 'black'
    ? '/app-store-badge/Black_lockup/SVG/Download_on_the_App_Store_Badge_US-UK_RGB_blk_092917.svg'
    : '/app-store-badge/White_lockup/SVG/Download_on_the_App_Store_Badge_US-UK_RGB_wht_092917.svg'

  // Apple's badge SVG natural aspect ratio is roughly 120:40 (3:1).
  const width = Math.round(height * 3)

  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Download DCM Grading on the App Store"
      className={`inline-block transition-opacity hover:opacity-85 ${className}`}
      style={{ height }}
    >
      <Image
        src={src}
        alt="Download on the App Store"
        width={width}
        height={height}
        unoptimized
        priority={false}
        style={{ height, width: 'auto' }}
      />
    </a>
  )
}
