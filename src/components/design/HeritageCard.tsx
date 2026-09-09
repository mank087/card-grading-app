'use client'

import { CardSlabGrid } from '@/components/CardSlab'
import { getCardLabelData } from '@/lib/useLabelData'
import { resolveHeritageBandColors } from '@/lib/labelLab/heritageLayout'
import type { ShowcaseCard } from './featuredCard'
import ProgressiveCardImage from '@/components/ProgressiveCardImage'

// Display-only bounds leave a small margin around all physical card edges.
const PHOTO_VIEWPORTS: Record<string, { x: number; y: number; width: number; height: number; sourceAspect: number }> = {
  '243264': { x: 0.41, y: 0.13, width: 0.29, height: 0.71, sourceAspect: 3000 / 1688 },
  '594019': { x: 0.16, y: 0.11, width: 0.75, height: 0.77, sourceAspect: 2105 / 2947 },
  '743228': { x: 0.02, y: 0.10, width: 0.89, height: 0.81, sourceAspect: 1010 / 1414 },
  '135189': { x: 0.13, y: 0.16, width: 0.71, height: 0.725, sourceAspect: 2250 / 3000 },
  '601783': { x: 0.10, y: 0.095, width: 0.78, height: 0.77, sourceAspect: 2035 / 2849 },
  '218109': { x: 0.105, y: 0.042, width: 0.75, height: 0.78, sourceAspect: 2250 / 3000 },
  '368841': { x: 0.12, y: 0.14, width: 0.725, height: 0.71, sourceAspect: 2143 / 3000 },
  '787570': { x: 0.11, y: 0.14, width: 0.795, height: 0.75, sourceAspect: 1080 / 1570 },
  '475225': { x: 0.115, y: 0.145, width: 0.78, height: 0.80, sourceAspect: 2250 / 3000 },
  '731714': { x: 0.078, y: 0.111, width: 0.779, height: 0.729, sourceAspect: 2029 / 3000 },
}

/** The same slab and label pipeline used by Collection and Featured Cards. */
export function ShowcasePhoto({ card }: { card: ShowcaseCard }) {
  const frame = PHOTO_VIEWPORTS[card.serial ?? '']
  if (!frame) return <div className="dcm-showcase-photo"><ProgressiveCardImage src={card.front_url!} alt={card.card_name || 'Featured card'} fill unoptimized priority style={{ objectFit: 'contain' }} /></div>
  return <div style={{ position: 'relative', overflow: 'hidden', width: '100%', aspectRatio: frame.sourceAspect * frame.width / frame.height }}>
    <div style={{ position: 'absolute', width: `${100 / frame.width}%`, height: `${100 / frame.height}%`, left: `${-100 * frame.x / frame.width}%`, top: `${-100 * frame.y / frame.height}%` }}>
      <ProgressiveCardImage src={card.front_url!} alt={card.card_name || 'Featured card'} fill unoptimized priority style={{ objectFit: 'contain' }} />
    </div>
  </div>
}

export function HeritageCard({ card, className = '' }: { card: ShowcaseCard; className?: string }) {
  const label = getCardLabelData(card)
  return <div className={`dcm-heritage-card ${className}`}>
    <CardSlabGrid imageViewport={PHOTO_VIEWPORTS[card.serial ?? '']} displayName={label.primaryName} setLineText={label.contextLine} features={label.features} serial={label.serial} grade={label.grade} condition={label.condition} frontImageUrl={PHOTO_VIEWPORTS[card.serial ?? ''] && typeof card.front_full_url === 'string' ? card.front_full_url : card.front_url ?? null} isAlteredAuthentic={label.isAlteredAuthentic} heritage={{ pattern: 'diamond', bandColors: resolveHeritageBandColors(card.card_colors) }} />
  </div>
}
