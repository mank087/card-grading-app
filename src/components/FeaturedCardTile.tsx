'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ModernFrontLabel } from '@/components/labels/ModernFrontLabel'
import { ModernBackLabel } from '@/components/labels/ModernBackLabel'
import { getCardLabelData } from '@/lib/useLabelData'
import { GradeHeroBanner } from '@/components/grading/GradeHeroBanner'
import { SubScoresDisplay } from '@/components/grading/SubScoresDisplay'
import { PriceEstimateBadge } from '@/components/grading/PriceEstimateBadge'

// Slab border style — matches card detail pages exactly
const slabBorderStyle = {
  background: 'linear-gradient(145deg, #1a1625 0%, #2d1f47 50%, #1a1625 100%)',
  boxShadow: '0 0 20px rgba(139, 92, 246, 0.4), 0 0 40px rgba(139, 92, 246, 0.2), inset 0 1px 0 rgba(139, 92, 246, 0.3), inset 0 -1px 0 rgba(0,0,0,0.3)',
  border: '1px solid rgba(139, 92, 246, 0.4)',
}

// Separator style — matches card detail pages exactly
const separatorStyle = {
  background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.3) 0%, rgba(139, 92, 246, 0.6) 50%, rgba(139, 92, 246, 0.3) 100%)',
}

function getCardLink(card: any): string {
  const sportCategories = ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Sports']
  if (card.category && sportCategories.includes(card.category)) return `/sports/${card.id}`
  if (card.category === 'Pokemon') return `/pokemon/${card.id}`
  if (card.category === 'MTG') return `/mtg/${card.id}`
  if (card.category === 'Lorcana') return `/lorcana/${card.id}`
  if (card.category === 'One Piece') return `/onepiece/${card.id}`
  if (card.category === 'Other') return `/other/${card.id}`
  return `/card/${card.id}`
}

function getEstimatedValue(card: any): number | null {
  if (card.dcm_price_estimate != null && card.dcm_price_estimate > 0) {
    return parseFloat(card.dcm_price_estimate)
  }
  if (card.dcm_cached_prices?.estimatedValue != null && card.dcm_cached_prices.estimatedValue > 0) {
    return parseFloat(card.dcm_cached_prices.estimatedValue)
  }
  if (card.category === 'MTG' && card.scryfall_price_usd != null && card.scryfall_price_usd > 0) {
    return parseFloat(card.scryfall_price_usd)
  }
  return null
}

function getMatchConfidence(card: any): 'high' | 'medium' | 'low' | 'none' | null {
  return card.dcm_cached_prices?.matchConfidence || null
}

interface FeaturedCardTileProps {
  card: any
}

export default function FeaturedCardTile({ card }: FeaturedCardTileProps) {
  const labelData = getCardLabelData(card)
  const cardLink = getCardLink(card)
  const estimatedValue = getEstimatedValue(card)
  const matchConfidence = getMatchConfidence(card)
  const subScores = card.conversational_sub_scores
  const weightedScores = card.conversational_weighted_sub_scores

  // QR code URL — same pattern as card detail pages
  const [origin, setOrigin] = useState('')
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin)
    }
  }, [])
  const qrCodeUrl = origin ? `${origin}${cardLink}` : ''

  // Sub-scores for the back label (flat weighted values)
  const backLabelSubScores = subScores ? {
    centering: subScores.centering?.weighted ?? 0,
    corners: subScores.corners?.weighted ?? 0,
    edges: subScores.edges?.weighted ?? 0,
    surface: subScores.surface?.weighted ?? 0,
  } : undefined

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
      {/* Card Images with Labels — inline rendering matching card detail pages */}
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Front Card with Label — Metallic Slab */}
          <Link href={cardLink} className="rounded-xl p-1 overflow-hidden block hover:opacity-95 transition-opacity" style={slabBorderStyle}>
            <div className="rounded-lg overflow-hidden">
              {/* Front Label */}
              <ModernFrontLabel
                displayName={labelData.primaryName}
                setLineText={labelData.contextLine || 'Card Details'}
                features={labelData.features}
                serial={labelData.serial}
                grade={labelData.grade}
                condition={labelData.condition}
                isAlteredAuthentic={labelData.isAlteredAuthentic}
                size="lg"
              />

              {/* Separator */}
              <div className="h-1" style={separatorStyle} />

              {/* Front Card Image — fixed aspect ratio container */}
              <div className="relative bg-gray-100" style={{ aspectRatio: '5/7' }}>
                {card.front_url ? (
                  <Image
                    src={card.front_url}
                    alt="Card front"
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-contain"
                    unoptimized={card.front_url.includes('supabase')}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    No Image
                  </div>
                )}
              </div>
            </div>
          </Link>

          {/* Back Card with Label — Metallic Slab */}
          <Link href={cardLink} className="rounded-xl p-1 overflow-hidden block hover:opacity-95 transition-opacity" style={slabBorderStyle}>
            <div className="rounded-lg overflow-hidden">
              {/* Back Label */}
              <ModernBackLabel
                serial={labelData.serial}
                grade={labelData.grade}
                condition={labelData.condition}
                qrCodeUrl={qrCodeUrl}
                subScores={backLabelSubScores}
                isAlteredAuthentic={labelData.isAlteredAuthentic}
                size="lg"
              />

              {/* Separator */}
              <div className="h-1" style={separatorStyle} />

              {/* Back Card Image — fixed aspect ratio container */}
              <div className="relative bg-gray-100" style={{ aspectRatio: '5/7' }}>
                {card.back_url ? (
                  <Image
                    src={card.back_url}
                    alt="Card back"
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-contain"
                    unoptimized={card.back_url.includes('supabase')}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    No Image
                  </div>
                )}
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Grade + Details */}
      <div className="px-4 pb-4 space-y-3">
        {/* Grade Hero Banner */}
        <GradeHeroBanner
          grade={card.conversational_decimal_grade}
          conditionLabel={card.conversational_condition_label || labelData.condition}
          imageConfidence={card.conversational_image_confidence}
          isAlteredAuthentic={labelData.isAlteredAuthentic}
          compact
        />

        {/* Sub-Scores */}
        {subScores && (
          <SubScoresDisplay
            subScores={subScores}
            weightedScores={weightedScores}
            limitingFactor={card.conversational_limiting_factor}
            compact
          />
        )}

        {/* Price Estimate or "View Market Value" link */}
        {estimatedValue ? (
          <PriceEstimateBadge
            estimatedValue={estimatedValue}
            matchConfidence={matchConfidence}
            compact
          />
        ) : (
          <Link
            href={cardLink}
            className="block text-center text-sm text-emerald-700 font-medium hover:text-emerald-800 py-2"
          >
            View Market Value &rarr;
          </Link>
        )}

        {/* Footer: serial + link */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <span className="text-xs text-gray-500 font-mono">{card.serial}</span>
          <Link
            href={cardLink}
            className="text-sm font-semibold text-purple-600 hover:text-purple-700 transition-colors"
          >
            View Full Report &rarr;
          </Link>
        </div>
      </div>
    </div>
  )
}
