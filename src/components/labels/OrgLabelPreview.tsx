'use client'

/**
 * Stacked FRONT + BACK slab-label preview for an org's house design — the
 * live demo shown in the owner Brand Setup page and the admin org console.
 * Labels only (no slab case), both styles supported:
 *  - heritage: HeritageLabelPreview x2 (side front/back) with the org's
 *    pattern + band colors and the color logo in both mark slots
 *  - modern: ModernFrontLabel + ModernBackLabel with overrides derived from
 *    the primary brand color (same recipe as the public org card report)
 * Sample card data; serial shows the org's real prefix.
 */

import { useEffect, useMemo, useState } from 'react'
import HeritageLabelPreview from '@/components/labels/HeritageLabelPreview'
import ModernFrontLabel from '@/components/labels/ModernFrontLabel'
import ModernBackLabel from '@/components/labels/ModernBackLabel'
import type { BandPattern } from '@/lib/labelLab/bandGeometry'
import type { SlabLabelData } from '@/lib/slabLabelGenerator'

interface OrgLabelPreviewProps {
  orgName: string
  labelStyle: 'heritage' | 'modern'
  pattern: string
  /** Resolved band colors (custom slab colors, else the brand palette). */
  bandColors: string[]
  /** Primary brand color — reserved for future accents (modern labels use the standard DCM formatting). */
  brandColor?: string
  logos: { color: string | null; white: string | null }
  /** Serial prefix for the sample serial (e.g. APX → APX442921). */
  serialPrefix: string
  className?: string
}

const SAMPLE_SUBS = { centering: 9.5, corners: 9, edges: 9.5, surface: 9 }

export default function OrgLabelPreview({
  orgName, labelStyle, pattern, bandColors, logos, serialPrefix, className = '',
}: OrgLabelPreviewProps) {
  const serial = `${serialPrefix || 'ORG'}442921`
  const [qrDataUrl, setQrDataUrl] = useState<string>('')

  // Heritage's back QR is an <image> needing a data URL; generate a sample.
  useEffect(() => {
    if (labelStyle !== 'heritage') return
    let cancelled = false
    import('qrcode')
      .then(q => q.default.toDataURL(`https://dcmgrading.com/verify/${serial}`, {
        errorCorrectionLevel: 'M', margin: 1, width: 200,
        color: { dark: '#141414', light: '#ffffff' },
      }))
      .then(url => { if (!cancelled) setQrDataUrl(url) })
      .catch(() => { /* preview renders without the QR */ })
    return () => { cancelled = true }
  }, [labelStyle, serial])

  const heritageData = useMemo(() => ({
    primaryName: 'Aaron Judge',
    contextLine: 'Bowman Chrome • #99 • 2023',
    features: [],
    featuresLine: null,
    serial,
    grade: 9,
    gradeFormatted: '9',
    condition: 'Mint',
    qrCodeDataUrl: qrDataUrl,
    subScores: SAMPLE_SUBS,
  }) as unknown as SlabLabelData, [serial, qrDataUrl])

  const safeBand = bandColors.length >= 2 ? bandColors : bandColors.length === 1 ? [bandColors[0], bandColors[0]] : ['#7C3AED', '#4C1D95']

  return (
    <div className={`space-y-3 ${className}`}>
      {labelStyle === 'heritage' ? (
        <>
          <div className="rounded-lg overflow-hidden shadow-sm border border-gray-200">
            <HeritageLabelPreview
              data={heritageData}
              side="front"
              pattern={pattern as BandPattern}
              bandColors={safeBand}
              blackLogoHref={logos.color ?? undefined}
              colorLogoHref={logos.color ?? undefined}
              suppressImages={!logos.color}
            />
          </div>
          <div className="rounded-lg overflow-hidden shadow-sm border border-gray-200">
            <HeritageLabelPreview
              data={heritageData}
              side="back"
              pattern={pattern as BandPattern}
              bandColors={safeBand}
              blackLogoHref={logos.color ?? undefined}
              colorLogoHref={logos.color ?? undefined}
              suppressImages={!logos.color}
            />
          </div>
        </>
      ) : (
        <>
          {/* Same defaults + size as the consumer detail pages (CardSlab):
              no color overrides — the standard DCM modern formatting with the
              org logo in the logo slot. */}
          <div className="rounded-lg overflow-hidden shadow-sm border border-gray-200">
            <ModernFrontLabel
              displayName="Aaron Judge"
              setLineText="#99 Bowman Chrome"
              serial={serial}
              grade={9}
              condition="Mint"
              size="lg"
              logoColorSrc={logos.color}
              logoWhiteSrc={logos.white ?? logos.color}
            />
          </div>
          <div className="rounded-lg overflow-hidden shadow-sm border border-gray-200">
            <ModernBackLabel
              serial={serial}
              grade={9}
              condition="Mint"
              qrCodeUrl={`https://dcmgrading.com/verify/${serial}`}
              qrLogoSrc={logos.color}
              subScores={SAMPLE_SUBS}
              size="lg"
            />
          </div>
        </>
      )}
      <p className="text-[11px] text-gray-400 text-center">
        Sample card shown. Front and back of every {orgName} label use this design.
      </p>
    </div>
  )
}
