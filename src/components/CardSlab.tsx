'use client'

import { ReactNode } from 'react'
import ProgressiveCardImage from './ProgressiveCardImage'
import { ModernFrontLabel } from './labels/ModernFrontLabel'
import { ModernBackLabel } from './labels/ModernBackLabel'
import { HeritageLabelPreview } from '@/components/labels/HeritageLabelPreview'
import { ClassicLabelPreview, useClassicQrDataUrl } from '@/components/labels/ClassicLabelPreview'
import type { LabelColorOverrides } from '@/lib/labelPresets'
import type { SlabLabelData } from '@/lib/slabLabelGenerator'
import type { OrgLabelDesign } from '@/lib/labels/orgLabelDesign'

// Sub-scores interface for modern labels
export interface SubScores {
  centering: number
  corners: number
  edges: number
  surface: number
}

// Props for the CardSlab component
export interface CardSlabProps {
  // Card info for the label
  displayName: string
  setLineText: string
  features?: string[]
  serial: string
  grade: number | null
  condition?: string

  // Image
  frontImageUrl: string | null
  altText?: string

  // Optional: For detail pages - show back image with QR code
  showBackCard?: boolean
  backImageUrl?: string | null
  qrCodeUrl?: string

  // Optional: Click handlers
  onFrontClick?: () => void
  onBackClick?: () => void

  // Size variants
  size?: 'sm' | 'md' | 'lg'

  // Optional: Show click to zoom text
  showZoomHint?: boolean

  // Optional: className for additional styling
  className?: string

  // For Altered/Authentic cards
  isAlteredAuthentic?: boolean

  /** v9.23 notation beside the grade (e.g. "Altered - Unverified Autograph"). */
  designation?: string | null

  // Label style preference
  labelStyle?: string

  // Sub-scores for modern back label
  subScores?: SubScores

  // Badge/emblem options (for back labels)
  showFounderEmblem?: boolean
  showCardLoversEmblem?: boolean

  /** Heritage label channel — when set, the label renders the Heritage design. */
  heritage?: { pattern: string; bandColors: string[]; gradeColors?: Record<string, string> | null } | null

  /** Enterprise org logos — color for light labels (traditional/heritage), white for the dark modern label. Omit for DCM branding. */
  orgLogoColor?: string | null
  orgLogoWhite?: string | null
  /** Mark size multiplier from Brand Setup; 1 keeps DCM sizing. */
  orgLogoScale?: number
  /** Enterprise Label Designer document for org cards; null/absent = stock layout. */
  orgDesign?: OrgLabelDesign | null
}

/**
 * CardSlab - A unified slab-like display component for graded cards
 * Features a metallic purple border wrapping both the label and card image
 */
export function CardSlab({
  displayName,
  setLineText,
  features = [],
  serial,
  grade,
  condition = '',
  frontImageUrl,
  altText = 'Card image',
  showBackCard = false,
  backImageUrl,
  qrCodeUrl,
  onFrontClick,
  onBackClick,
  size = 'md',
  showZoomHint = false,
  className = '',
  isAlteredAuthentic = false,
  designation = null,
  labelStyle = 'modern',
  subScores,
  showFounderEmblem = false,
  showCardLoversEmblem = false,
  heritage = null,
  orgLogoColor = null,
  orgLogoWhite = null,
  orgLogoScale = 1,
  orgDesign = null,
}: CardSlabProps) {
  const isModern = labelStyle !== 'traditional'
  // Slab border styles - modern has dark with glow, traditional has metallic purple
  const slabBorderStyle = isModern
    ? {
        background: 'linear-gradient(145deg, #1a1625 0%, #2d1f47 50%, #1a1625 100%)',
        boxShadow: '0 0 20px rgba(139, 92, 246, 0.4), 0 0 40px rgba(139, 92, 246, 0.2), inset 0 1px 0 rgba(139, 92, 246, 0.3), inset 0 -1px 0 rgba(0,0,0,0.3)',
        border: '1px solid rgba(139, 92, 246, 0.4)',
      }
    : {
        background: 'linear-gradient(145deg, #9333ea 0%, #6b21a8 25%, #a855f7 50%, #7c3aed 75%, #581c87 100%)',
        boxShadow: '0 4px 15px rgba(147, 51, 234, 0.4), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.2)',
      }

  // Built-in 'traditional' is the Classic grading label (Sept 2026): the same
  // 1400x400 design the print PDF draws, rendered from the shared layout math.
  // Custom slots keep their own design - callers never pass 'traditional' for one.
  const isClassic = !isModern && !heritage
  const classicData: SlabLabelData = {
    primaryName: displayName,
    contextLine: setLineText || '',
    features: features || [],
    serial,
    grade,
    condition,
    isAlteredAuthentic,
    designation: designation ?? null,
    qrCodeDataUrl: '',
  }
  // Only the Classic back label draws a QR, so only generate one when that is
  // what is being rendered. Every other style makes its own.
  const classicQr = useClassicQrDataUrl(isClassic && showBackCard ? qrCodeUrl : null)

  // Card image component
  const CardImage = ({
    url,
    alt,
    onClick
  }: {
    url: string | null
    alt: string
    onClick?: () => void
  }) => (
    <div
      className={`relative bg-gray-100 ${onClick ? 'cursor-pointer transition-transform hover:scale-[1.02]' : ''}`}
      style={{ aspectRatio: '3/4' }}
      onClick={onClick}
    >
      {url ? (
        <ProgressiveCardImage
          src={url}
          alt={alt}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-contain"
          unoptimized={url.includes('supabase')}
        />
      ) : (
        <div className="flex items-center justify-center h-full text-gray-400">
          No Image
        </div>
      )}
    </div>
  )

  // Separator style - modern uses darker glow, traditional uses purple gradient
  const separatorStyle = isModern
    ? {
        background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.3) 0%, rgba(139, 92, 246, 0.6) 50%, rgba(139, 92, 246, 0.3) 100%)',
      }
    : {
        background: 'linear-gradient(90deg, #9333ea 0%, #a855f7 50%, #9333ea 100%)',
      }

  return (
    <div className={`inline-block ${className}`}>
      <div className="flex flex-col md:flex-row gap-4 justify-center">
        {/* Front Card Slab */}
        <div
          className="rounded-xl p-1 overflow-hidden"
          style={slabBorderStyle}
        >
          <div className={`${isModern ? '' : 'bg-white'} rounded-lg overflow-hidden`}>
            {heritage ? (
              <HeritageLabelPreview
                data={{
                  primaryName: displayName,
                  contextLine: setLineText || '',
                  features: features || [],
                  serial,
                  grade,
                  condition,
                  isAlteredAuthentic,
                  qrCodeDataUrl: '',
                  showFounderEmblem,
                  showCardLoversEmblem,
                } as any}
                side="front"
                pattern={heritage.pattern as any}
                bandColors={heritage.bandColors}
                blackLogoHref={orgLogoColor ?? undefined}
                colorLogoHref={orgLogoColor ?? undefined}
                logoScale={orgLogoScale}
                design={orgDesign}
              />
            ) : isModern ? (
              <ModernFrontLabel
                displayName={displayName}
                setLineText={setLineText}
                features={features}
                serial={serial}
                grade={grade}
                condition={condition}
                isAlteredAuthentic={isAlteredAuthentic}
                size={size}
                logoColorSrc={orgLogoColor}
                logoWhiteSrc={orgLogoWhite}
                logoScale={orgLogoScale}
              />
            ) : (
              <ClassicLabelPreview data={classicData} side="front" blackLogoHref={orgLogoColor ?? undefined} />
            )}
            {/* Separator - mimics slab divider */}
            <div className="h-1" style={separatorStyle} />
            <CardImage
              url={frontImageUrl}
              alt={`${altText} front`}
              onClick={onFrontClick}
            />
          </div>
          {showZoomHint && (
            <p className="text-xs text-white/80 mt-1 text-center">Click to zoom</p>
          )}
        </div>

        {/* Back Card Slab (optional) */}
        {showBackCard && (
          <div
            className="rounded-xl p-1 overflow-hidden"
            style={slabBorderStyle}
          >
            <div className={`${isModern ? '' : 'bg-white'} rounded-lg overflow-hidden`}>
              {heritage ? (
                <HeritageLabelPreview
                  data={{
                    primaryName: displayName,
                    contextLine: setLineText || '',
                    features: features || [],
                    serial,
                    grade,
                    condition,
                    isAlteredAuthentic,
                    qrCodeDataUrl: '',
                    showFounderEmblem,
                    showCardLoversEmblem,
                  } as any}
                  side="back"
                  pattern={heritage.pattern as any}
                  bandColors={heritage.bandColors}
                  blackLogoHref={orgLogoColor ?? undefined}
                  colorLogoHref={orgLogoColor ?? undefined}
                  logoScale={orgLogoScale}
                  design={orgDesign}
                />
              ) : isModern ? (
                <ModernBackLabel
                  serial={serial}
                  grade={grade}
                  condition={condition}
                  qrCodeUrl={qrCodeUrl}
                  subScores={subScores}
                  isAlteredAuthentic={isAlteredAuthentic}
                  size={size}
                  showFounderEmblem={showFounderEmblem}
                  showCardLoversEmblem={showCardLoversEmblem}
                />
              ) : (
                <ClassicLabelPreview data={classicData} side="back" blackLogoHref={orgLogoColor ?? undefined} qrDataUrl={classicQr} verifyUrl={qrCodeUrl} />
              )}
              {/* Separator - mimics slab divider */}
              <div className="h-1" style={separatorStyle} />
              <CardImage
                url={backImageUrl || null}
                alt={`${altText} back`}
                onClick={onBackClick}
              />
            </div>
            {showZoomHint && (
              <p className="text-xs text-white/80 mt-1 text-center">Click to zoom</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * CardSlabGrid - A simplified version for grid displays (collection, search, featured)
 * Single card view with click-through to details
 */
export interface CardSlabGridProps {
  /** Optional display-only photo framing. Coordinates are fractions of the original image. */
  imageViewport?: { x: number; y: number; width: number; height: number; sourceAspect: number }
  displayName: string
  setLineText: string
  features?: string[]
  serial: string
  grade: number | null
  condition?: string
  frontImageUrl: string | null
  isAlteredAuthentic?: boolean
  /** v9.23 notation beside the grade (e.g. "Altered - Unverified Autograph"). */
  designation?: string | null
  children?: ReactNode // For additional content like buttons
  className?: string
  labelStyle?: string
  colorOverrides?: LabelColorOverrides
  /** Heritage label channel — when set, the label renders the Heritage design. */
  heritage?: { pattern: string; bandColors: string[]; gradeColors?: Record<string, string> | null } | null
  /** Enterprise org logos — color for light labels (traditional/heritage), white for the dark modern label. Omit for DCM branding. */
  orgLogoColor?: string | null
  orgLogoWhite?: string | null
  /** Mark size multiplier from Brand Setup; 1 keeps DCM sizing. */
  orgLogoScale?: number
  orgDesign?: OrgLabelDesign | null
}

export function CardSlabGrid({
  imageViewport,
  displayName,
  setLineText,
  features = [],
  serial,
  grade,
  condition = '',
  frontImageUrl,
  isAlteredAuthentic = false,
  designation = null,
  children,
  className = '',
  labelStyle = 'modern',
  colorOverrides,
  heritage = null,
  orgLogoColor = null,
  orgLogoWhite = null,
  orgLogoScale = 1,
  orgDesign = null,
}: CardSlabGridProps) {
  const isModern = labelStyle !== 'traditional'

  // Slab border styles - modern has dark with glow, traditional has metallic purple
  // Custom styles use their own gradient colors for the slab border
  const slabBorderStyle = isModern
    ? colorOverrides?.isRainbow
      ? {
          background: 'linear-gradient(145deg, #ff0000 0%, #ff8800 17%, #ffff00 33%, #00cc00 50%, #0066ff 67%, #8800ff 83%, #ff00ff 100%)',
          boxShadow: '0 0 20px rgba(255, 255, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.3), inset 0 -1px 0 rgba(0,0,0,0.3)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
        }
      : colorOverrides
        ? {
            background: `linear-gradient(145deg, ${colorOverrides.gradientStart} 0%, ${colorOverrides.gradientEnd} 50%, ${colorOverrides.gradientStart} 100%)`,
            boxShadow: `0 0 20px ${colorOverrides.gradientEnd}66, inset 0 1px 0 ${colorOverrides.gradientEnd}4d, inset 0 -1px 0 rgba(0,0,0,0.3)`,
            border: `1px solid ${colorOverrides.gradientEnd}66`,
          }
        : {
            background: 'linear-gradient(145deg, #1a1625 0%, #2d1f47 50%, #1a1625 100%)',
            boxShadow: '0 0 20px rgba(139, 92, 246, 0.4), 0 0 40px rgba(139, 92, 246, 0.2), inset 0 1px 0 rgba(139, 92, 246, 0.3), inset 0 -1px 0 rgba(0,0,0,0.3)',
            border: '1px solid rgba(139, 92, 246, 0.4)',
          }
    : {
        background: 'linear-gradient(145deg, #9333ea 0%, #6b21a8 25%, #a855f7 50%, #7c3aed 75%, #581c87 100%)',
        boxShadow: '0 4px 15px rgba(147, 51, 234, 0.4), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.2)',
      }

  // Separator style
  const separatorStyle = isModern
    ? colorOverrides?.isRainbow
      ? { background: 'linear-gradient(90deg, #ff0000, #ff8800, #ffff00, #00cc00, #0066ff, #8800ff, #ff00ff)' }
      : colorOverrides
        ? { background: `linear-gradient(90deg, ${colorOverrides.gradientEnd}4d 0%, ${colorOverrides.gradientEnd}99 50%, ${colorOverrides.gradientEnd}4d 100%)` }
        : { background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.3) 0%, rgba(139, 92, 246, 0.6) 50%, rgba(139, 92, 246, 0.3) 100%)' }
    : {
        background: 'linear-gradient(90deg, #9333ea 0%, #a855f7 50%, #9333ea 100%)',
      }

  // Built-in 'traditional' renders the Classic grading label, same as the
  // detail slab above. The grid tile only ever shows the front.
  const gridClassicData: SlabLabelData = {
    primaryName: displayName,
    contextLine: setLineText || '',
    features: features || [],
    serial,
    grade,
    condition,
    isAlteredAuthentic,
    designation: designation ?? null,
    qrCodeDataUrl: '',
  }

  return (
    <div
      className={`rounded-xl p-1 overflow-hidden ${className}`}
      style={slabBorderStyle}
    >
      <div className={`${isModern ? '' : 'bg-white'} rounded-lg overflow-hidden`}>
        {/* Label */}
        {heritage ? (
          <HeritageLabelPreview
            data={{
              primaryName: displayName,
              contextLine: setLineText || '',
              features: features || [],
              serial,
              grade,
              condition,
              isAlteredAuthentic,
              qrCodeDataUrl: '',
            } as any}
            side="front"
            pattern={heritage.pattern as any}
            bandColors={heritage.bandColors}
            blackLogoHref={orgLogoColor ?? undefined}
            colorLogoHref={orgLogoColor ?? undefined}
            logoScale={orgLogoScale}
            design={orgDesign}
          />
        ) : isModern ? (
          <ModernFrontLabel
            displayName={displayName}
            setLineText={setLineText}
            features={features}
            serial={serial}
            grade={grade}
            condition={condition}
            isAlteredAuthentic={isAlteredAuthentic}
            size="md"
            colorOverrides={colorOverrides}
            logoColorSrc={orgLogoColor}
            logoWhiteSrc={orgLogoWhite}
            logoScale={orgLogoScale}
          />
        ) : (
          <ClassicLabelPreview data={gridClassicData} side="front" blackLogoHref={orgLogoColor ?? undefined} />
        )}

        {/* Separator - mimics slab divider */}
        <div className="h-1" style={separatorStyle} />

        {/* Card Image */}
        <div className="aspect-[3/4] relative overflow-hidden bg-gray-100" style={imageViewport ? { aspectRatio: imageViewport.sourceAspect * imageViewport.width / imageViewport.height } : undefined}>
          {frontImageUrl ? (
            <div className="absolute inset-0" style={imageViewport ? {
                width: `${100 / imageViewport.width}%`,
                height: `${100 / imageViewport.height}%`,
                maxWidth: 'none',
                left: `${-100 * imageViewport.x / imageViewport.width}%`,
                top: `${-100 * imageViewport.y / imageViewport.height}%`,
                right: 'auto',
                bottom: 'auto',
              } : undefined}>
            <ProgressiveCardImage
              src={frontImageUrl}
              alt={`${displayName || 'Trading card'} front photo`}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-contain"
              unoptimized={frontImageUrl.includes('supabase')}
            />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              No Image
            </div>
          )}
        </div>

        {/* Optional children (buttons, badges, etc.) */}
        {children}
      </div>
    </div>
  )
}

export default CardSlab
