/**
 * Label Wizard — per-card preview.
 *
 * Slab holder: the REAL label render (Heritage's SVG preview, or the canvas
 * renderer for modern/traditional — the same pipeline the print PDF mirrors)
 * composited into the slab photo, exactly like the classic studio's sticky
 * preview. One-Touch / Toploader: the existing LabelMockup gallery visuals,
 * which match what those holders can actually print today.
 */
'use client'

import React, { useMemo, useRef } from 'react'
import type { SlabLabelData } from '@/lib/slabLabelGenerator'
import type { CustomLabelConfig } from '@/lib/labelPresets'
import { LABEL_TYPES } from '@/lib/labelPresets'
import { useLabelPreview } from '@/hooks/useLabelPreview'
import HeritageLabelPreview from '@/components/labels/HeritageLabelPreview'
import LabelMockup from '@/components/labels/LabelMockup'
import { BAND_PATTERNS, type BandPattern } from '@/lib/labelLab/bandGeometry'
import { resolveHeritageBandColors, HERITAGE_BRAND_COLORS } from '@/lib/labelLab/heritageLayout'
import type { HolderType } from './wizardTypes'
import { useHeritageCompactImages, type CompactFormat } from './HeritageCompactPreview'
import type { HeritageCompactInputs } from '@/lib/labels/heritageCompact'

const HEX_RE = /^#[0-9a-fA-F]{6}$/

/** Band palette for THIS card under the working config. */
export function heritageBandColorsForCard(card: any, config: CustomLabelConfig): string[] {
  const custom = config.heritageBandColors?.filter((c) => HEX_RE.test(c))
  if (custom && custom.length >= 2) return custom
  if (config.heritageColorSource === 'brand') return HERITAGE_BRAND_COLORS
  return resolveHeritageBandColors(card?.card_colors)
}

export function heritagePatternFromConfig(config: CustomLabelConfig): BandPattern {
  const raw = config.heritagePattern
  return (BAND_PATTERNS.some((p) => p.id === raw) ? raw : 'diamond') as BandPattern
}

/** Canvas-rendered label (modern/traditional), as an <img>. */
function CanvasLabel({ data, config }: { data: SlabLabelData; config: CustomLabelConfig }) {
  const dummyRef = useRef<HTMLCanvasElement | null>(null)
  const { previewDataUrl, isRendering } = useLabelPreview({ config, data, canvasRef: dummyRef, debounceMs: 150 })
  if (!previewDataUrl) {
    return <div className="w-full bg-gray-200 animate-pulse rounded" style={{ aspectRatio: '3.5 / 1' }} />
  }
  return (
    <div className="relative w-full">
      <img src={previewDataUrl} alt="Label preview" className="w-full h-auto" />
      {isRendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/40">
          <div className="w-3 h-3 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}

interface LabelOnlyProps {
  card: any
  data: SlabLabelData | undefined
  config: CustomLabelConfig
  orgLogoColor?: string | null
}

/** Just the label artwork at label aspect ratio (no holder). */
export function WizardLabelOnly({ card, data, config, orgLogoColor }: LabelOnlyProps) {
  if (!data) {
    return <div className="w-full bg-gray-200 animate-pulse rounded" style={{ aspectRatio: '3.5 / 1' }} />
  }
  if (config.style === 'heritage') {
    // Non-standard slots (Zion) stretch the preview to the physical aspect,
    // mirroring the print pipeline's scale transform.
    const w = config.width || 2.8
    const h = config.height || 0.8
    const nonStd = Math.abs(w - 2.8) > 0.001 || Math.abs(h - 0.8) > 0.001
    return (
      <HeritageLabelPreview
        data={data}
        side={config.side}
        pattern={heritagePatternFromConfig(config)}
        bandColors={heritageBandColorsForCard(card, config)}
        gradeColors={config.heritageGradeColors ?? null}
        blackLogoHref={orgLogoColor ?? undefined}
        colorLogoHref={orgLogoColor ?? undefined}
        className="w-full"
        stretchAspect={nonStd ? w / h : undefined}
      />
    )
  }
  return <CanvasLabel data={data} config={config} />
}

interface WizardPreviewProps extends LabelOnlyProps {
  holder: HolderType
  /** Toploader label variation (front+back pair vs fold-over). */
  toploaderVariant?: 'front-back' | 'foldover'
}

/** The label in context: slab composite, or the holder mockups. */
export function WizardPreview({ card, data, config, holder, orgLogoColor, toploaderVariant = 'front-back' }: WizardPreviewProps) {
  const labelType = useMemo(() => {
    if (holder === 'onetouch') return LABEL_TYPES.find((t) => t.id === 'onetouch')!
    if (toploaderVariant === 'foldover') return LABEL_TYPES.find((t) => t.id === 'foldover')!
    return LABEL_TYPES.find((t) => t.id === 'toploader')!
  }, [holder, toploaderVariant])

  // Heritage Compact for the small holders. Both computed unconditionally —
  // hooks cannot sit behind the slab early-return below.
  const compactFormat: CompactFormat =
    holder === 'onetouch' ? 'onetouch' : toploaderVariant === 'foldover' ? 'foldover' : 'toploader'
  const compactInputs = useMemo<HeritageCompactInputs | null>(() => {
    if (holder === 'slab' || config.style !== 'heritage' || !data) return null
    const context = (data.contextLine || '').toUpperCase()
    return {
      primaryName: data.primaryName || 'Card',
      contextLine: context,
      contextShort: context.split('•').slice(0, 2).join(' • ').trim(),
      serial: data.serial,
      grade: data.grade !== null && data.grade !== undefined
        ? Math.round(data.grade).toString()
        : (data.isAlteredAuthentic ? 'A' : '—'),
      condition: data.condition || '',
      subgrades: data.subScores,
      bandColors: heritageBandColorsForCard(card, config),
      pattern: heritagePatternFromConfig(config),
      qrDataUrl: data.qrCodeDataUrl || null,
      showFounderEmblem: data.showFounderEmblem,
      showVipEmblem: data.showVipEmblem,
      showCardLoversEmblem: data.showCardLoversEmblem,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holder, config, data, card])
  const compactImages = useHeritageCompactImages(compactInputs, compactFormat)

  if (holder === 'slab') {
    // The slab slot in the photo is the standard 2.8" opening (73% of the
    // composite width). Non-standard labels (Zion 2.51") render at true
    // relative scale, centered in the slot, so the preview matches print.
    const widthRatio = Math.min(1, (config.width || 2.8) / 2.8)
    const slotPct = 73 * widthRatio
    const slotLeft = 13.5 + (73 - slotPct) / 2
    const isStdDims = Math.abs((config.width || 2.8) - 2.8) < 0.001 && Math.abs((config.height || 0.8) - 0.8) < 0.001
    return (
      <div>
      <div className="w-full max-w-[240px] relative mx-auto" style={{ aspectRatio: '280 / 460' }}>
        <img
          src="/labels/graded-card-slab.png"
          alt="Graded card slab"
          className="absolute inset-0 w-full h-full object-contain"
        />
        <div className="absolute overflow-hidden" style={{ top: '4.5%', left: `${slotLeft}%`, width: `${slotPct}%` }}>
          <WizardLabelOnly card={card} data={data} config={config} orgLogoColor={orgLogoColor} />
        </div>
        <div className="absolute overflow-hidden" style={{ top: '20%', left: '10.7%', width: '78.6%', height: '73.9%' }}>
          {config.side === 'back' && card?.back_url ? (
            <img src={card.back_url} alt={card.card_name || 'Card back'} className="w-full h-full object-contain" loading="lazy" />
          ) : card?.front_url ? (
            <img src={card.front_url} alt={card.card_name || 'Card'} className="w-full h-full object-contain" loading="lazy" />
          ) : (
            <div className="w-full h-full" />
          )}
        </div>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.03) 100%)',
          }}
        />
      </div>
      <p className="text-center text-[10px] text-gray-400 mt-1">
        {config.width}&quot; × {config.height}&quot;{!isStdDims ? ' — Zion Mag Pro' : ''}
      </p>
      </div>
    )
  }

  // One-Touch / Toploader — the holder mockup frames the label either way. For
  // Heritage we hand it the very canvases the print sheets use, so what you see
  // on the holder is what lands on the paper.
  if (!data) {
    return <div className="w-full max-w-[240px] mx-auto bg-gray-200 animate-pulse rounded" style={{ aspectRatio: '3 / 4' }} />
  }
  return (
    <div className="w-full max-w-[240px] mx-auto">
      <LabelMockup
        card={{ front_url: card?.front_url, back_url: card?.back_url, card_name: card?.card_name }}
        labelType={labelType}
        labelImages={compactInputs ? compactImages : null}
        labelProps={{
          displayName: data.primaryName,
          setLineText: data.contextLine,
          features: data.features,
          serial: data.serial,
          grade: data.grade,
          condition: data.condition,
          isAlteredAuthentic: Boolean(data.isAlteredAuthentic),
        }}
        backLabelProps={{
          serial: data.serial,
          grade: data.grade,
          condition: data.condition,
          qrCodeUrl: data.qrCodeDataUrl,
          subScores: data.subScores,
          isAlteredAuthentic: Boolean(data.isAlteredAuthentic),
          showFounderEmblem: data.showFounderEmblem,
          showVipEmblem: data.showVipEmblem,
          showCardLoversEmblem: data.showCardLoversEmblem,
        }}
      />
    </div>
  )
}

export default WizardPreview
