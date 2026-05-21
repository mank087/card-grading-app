/**
 * Google-official "Get it on Google Play" badge.
 *
 * Source assets live at public/app-store-badge/GetItOnGooglePlay_Badge_*. We
 * use the SVG verbatim — Google's brand guidelines require we don't modify
 * color, proportions, or add visual treatments.
 *
 * Single source of truth for the Play Store URL — every placement on the
 * marketing site (homepage, /why-dcm, footer, banner) routes through this
 * component, so future store-listing URL changes only touch one file.
 *
 * Sized to read visually balanced next to AppStoreBadge.tsx — both default
 * to height=48 with width auto-scaling to preserve each store's official
 * aspect ratio.
 */

import Image from 'next/image'

export const GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.dcmgrading.app'

interface Props {
  /** Display height in px. Google's brand guidelines specify min ~40px; we
   *  default to 48 to match AppStoreBadge. Width auto-scales by aspect ratio. */
  height?: number
  className?: string
}

export default function GooglePlayBadge({ height = 48, className = '' }: Props) {
  // Google's official badge SVG has roughly 3.36:1 aspect ratio (564x168).
  const width = Math.round(height * 3.36)

  return (
    <a
      href={GOOGLE_PLAY_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Get DCM Grading on Google Play"
      className={`inline-block transition-opacity hover:opacity-85 ${className}`}
      style={{ height }}
    >
      <Image
        src="/app-store-badge/GetItOnGooglePlay_Badge_Web_color_English.svg"
        alt="Get it on Google Play"
        width={width}
        height={height}
        unoptimized
        priority={false}
        style={{ height, width: 'auto' }}
      />
    </a>
  )
}
