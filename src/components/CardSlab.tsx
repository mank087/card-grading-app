'use client'

import { ReactNode } from 'react'
import Image from 'next/image'
import { QRCodeCanvas } from 'qrcode.react'
import { ModernFrontLabel } from './labels/ModernFrontLabel'
import { ModernBackLabel } from './labels/ModernBackLabel'

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

  // Label style preference
  labelStyle?: 'modern' | 'traditional'

  // Sub-scores for modern back label
  subScores?: SubScores

  // Badge/emblem options (for back labels)
  showFounderEmblem?: boolean
  showCardLoversEmblem?: boolean
}

// Helper: Format grade for display - v6.0: Always whole numbers
const formatGrade = (grade: number): string => {
  // v6.0: Always return whole number (no .5 grades)
  return Math.round(grade).toString()
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
  labelStyle = 'modern',
  subScores,
  showFounderEmblem = false,
  showCardLoversEmblem = false,
}: CardSlabProps) {
  const isModern = labelStyle === 'modern'
  // Size configurations
  const sizeConfig = {
    sm: {
      logoHeight: 'h-7',
      nameFontSize: '11px',
      setFontSize: '9px',
      featureFontSize: 'text-[8px]',
      serialFontSize: 'text-[8px]',
      gradeSize: 'text-2xl',
      conditionSize: 'text-[0.55rem]',
      dividerWidth: 'w-6',
      padding: 'p-2',
      labelHeight: 'h-[85px]',
      imageWidth: 300,
      imageHeight: 420,
      qrSize: 45,
      qrLogoSize: '16px',
    },
    md: {
      logoHeight: 'h-9',
      nameFontSize: '13px',
      setFontSize: '11px',
      featureFontSize: 'text-[10px]',
      serialFontSize: 'text-[10px]',
      gradeSize: 'text-3xl',
      conditionSize: 'text-[0.65rem]',
      dividerWidth: 'w-8',
      padding: 'p-3',
      labelHeight: 'h-[95px]',
      imageWidth: 350,
      imageHeight: 490,
      qrSize: 55,
      qrLogoSize: '18px',
    },
    lg: {
      logoHeight: 'h-14',
      nameFontSize: '14px',
      setFontSize: '12px',
      featureFontSize: 'text-[11px]',
      serialFontSize: 'text-[11px]',
      gradeSize: 'text-4xl',
      conditionSize: 'text-[0.7rem]',
      dividerWidth: 'w-10',
      padding: 'p-4',
      labelHeight: 'h-[110px]',
      imageWidth: 400,
      imageHeight: 560,
      qrSize: 58,
      qrLogoSize: '20px',
    },
  }

  const config = sizeConfig[size]

  // Calculate scale for name to fit on single line
  const maxCharsAtFullSize = 20
  const nameScaleX = displayName.length <= maxCharsAtFullSize
    ? 1
    : Math.max(0.55, maxCharsAtFullSize / displayName.length)

  // Dynamic set line font size
  const dynamicSetFontSize = setLineText.length > 50 ? '8px'
    : setLineText.length > 40 ? '9px'
    : setLineText.length > 30 ? '10px'
    : config.setFontSize

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

  // Traditional label component (reused for front and back)
  const FrontLabel = () => (
    <div className={`bg-gradient-to-b from-gray-50 to-white ${config.labelHeight} ${config.padding}`}>
      <div className="flex items-center justify-between h-full gap-1.5">
        {/* Left: DCM Logo */}
        <div className="flex-shrink-0">
          <img
            src="/DCM-logo.png"
            alt="DCM"
            className={`${config.logoHeight} w-auto`}
          />
        </div>

        {/* Center: Card Information */}
        <div className="flex-1 min-w-0 mx-1 flex flex-col justify-center gap-0.5">
          {/* Line 1: Player/Card Name */}
          <div
            className="font-bold text-gray-900 leading-tight whitespace-nowrap origin-left"
            style={{
              fontSize: config.nameFontSize,
              transform: `scaleX(${nameScaleX})`,
              lineHeight: '1.2'
            }}
            title={displayName}
          >
            {displayName}
          </div>

          {/* Line 2: Set Name */}
          <div
            className="text-gray-700 leading-tight"
            style={{
              fontSize: dynamicSetFontSize,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word'
            }}
            title={setLineText}
          >
            {setLineText}
          </div>

          {/* Line 3: Special Features */}
          {features.length > 0 && (
            <div className={`text-blue-600 font-semibold ${config.featureFontSize} leading-tight truncate`}>
              {features.join(' • ')}
            </div>
          )}

          {/* Line 4: DCM Serial Number */}
          <div className={`text-gray-500 font-mono truncate ${config.serialFontSize} leading-tight`}>
            {serial}
          </div>
        </div>

        {/* Right: Grade Display */}
        <div className="text-center flex-shrink-0">
          <div className={`font-bold text-purple-700 ${config.gradeSize} leading-none`}>
            {grade !== null ? formatGrade(grade) : (isAlteredAuthentic ? 'A' : 'N/A')}
          </div>
          {(condition || isAlteredAuthentic) && (
            <>
              <div className={`border-t-2 border-purple-600 ${config.dividerWidth} mx-auto my-1`}></div>
              <div className={`font-semibold text-purple-600 ${config.conditionSize} leading-tight`}>
                {isAlteredAuthentic && grade === null ? 'Authentic' : condition}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )

  // Back label with QR code, grade, and sub-scores (matches modern layout)
  const BackLabel = () => {
    // Size-specific configurations for back label elements
    const backLabelConfig = {
      sm: { gradeSize: 'text-2xl', conditionSize: 'text-[8px]', subScoreSize: 'text-[8px]', founderStarSize: 'text-[12px]', founderTextSize: '7px' },
      md: { gradeSize: 'text-3xl', conditionSize: 'text-[9px]', subScoreSize: 'text-[9px]', founderStarSize: 'text-[14px]', founderTextSize: '8px' },
      lg: { gradeSize: 'text-4xl', conditionSize: 'text-[10px]', subScoreSize: 'text-[10px]', founderStarSize: 'text-[16px]', founderTextSize: '9px' },
    }
    const backConfig = backLabelConfig[size]

    return (
      <div className={`bg-gradient-to-b from-gray-50 to-white ${config.labelHeight} ${config.padding}`}>
        <div className="flex items-center justify-between h-full gap-2">
          {/* LEFT: QR Code + Founder badge */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {qrCodeUrl ? (
              <div className="bg-white p-1 rounded shadow-sm">
                <QRCodeCanvas
                  value={qrCodeUrl}
                  size={config.qrSize}
                  level="H"
                  includeMargin={false}
                  fgColor="#000000"
                  bgColor="#FFFFFF"
                />
              </div>
            ) : (
              <div className="text-gray-400 text-sm">Back</div>
            )}

            {/* Founder badge - star at top, Founder sideways below */}
            {showFounderEmblem && (
              <div className="flex flex-col items-center justify-start h-full py-1">
                <span className={`${backConfig.founderStarSize} leading-none`} style={{ color: '#d97706' }}>
                  ★
                </span>
                <span
                  className="uppercase"
                  style={{
                    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                    fontWeight: 600,
                    fontSize: backConfig.founderTextSize,
                    color: '#7c3aed',
                    writingMode: 'vertical-rl',
                    transform: 'rotate(180deg)',
                    marginTop: '3px',
                    letterSpacing: '0.5px',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    textRendering: 'optimizeLegibility',
                  } as React.CSSProperties}
                >
                  Founder
                </span>
              </div>
            )}

            {/* Card Lovers badge - heart at top, CARD LOVER sideways below */}
            {showCardLoversEmblem && (
              <div className="flex flex-col items-center justify-start h-full py-1">
                <span className={`${backConfig.founderStarSize} leading-none`} style={{ color: '#f43f5e' }}>
                  ♥
                </span>
                <span
                  className="uppercase"
                  style={{
                    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                    fontWeight: 600,
                    fontSize: backConfig.founderTextSize,
                    color: '#ec4899',
                    writingMode: 'vertical-rl',
                    transform: 'rotate(180deg)',
                    marginTop: '3px',
                    letterSpacing: '0.5px',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    textRendering: 'optimizeLegibility',
                  } as React.CSSProperties}
                >
                  Card Lover
                </span>
              </div>
            )}
          </div>

          {/* CENTER: Large Grade + Condition */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className={`font-bold text-purple-700 ${backConfig.gradeSize} leading-none`}>
              {grade !== null ? formatGrade(grade) : (isAlteredAuthentic ? 'A' : 'N/A')}
            </div>
            {(condition || isAlteredAuthentic) && (
              <div className={`font-semibold text-purple-600 ${backConfig.conditionSize} leading-tight mt-1 uppercase tracking-wide`}>
                {isAlteredAuthentic && grade === null ? 'Authentic' : condition}
              </div>
            )}
          </div>

          {/* RIGHT: Four Sub-Grades */}
          {subScores && (
            <div className="flex flex-col justify-center gap-0.5 flex-shrink-0 text-right">
              <div className={`${backConfig.subScoreSize} text-gray-700`}>
                Centering: {Math.round(subScores.centering)}
              </div>
              <div className={`${backConfig.subScoreSize} text-gray-700`}>
                Corners: {Math.round(subScores.corners)}
              </div>
              <div className={`${backConfig.subScoreSize} text-gray-700`}>
                Edges: {Math.round(subScores.edges)}
              </div>
              <div className={`${backConfig.subScoreSize} text-gray-700`}>
                Surface: {Math.round(subScores.surface)}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

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
        <Image
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
            {isModern ? (
              <ModernFrontLabel
                displayName={displayName}
                setLineText={setLineText}
                features={features}
                serial={serial}
                grade={grade}
                condition={condition}
                isAlteredAuthentic={isAlteredAuthentic}
                size={size}
              />
            ) : (
              <FrontLabel />
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
              {isModern ? (
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
                <BackLabel />
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
  displayName: string
  setLineText: string
  features?: string[]
  serial: string
  grade: number | null
  condition?: string
  frontImageUrl: string | null
  isAlteredAuthentic?: boolean
  children?: ReactNode // For additional content like buttons
  className?: string
  labelStyle?: 'modern' | 'traditional'
}

export function CardSlabGrid({
  displayName,
  setLineText,
  features = [],
  serial,
  grade,
  condition = '',
  frontImageUrl,
  isAlteredAuthentic = false,
  children,
  className = '',
  labelStyle = 'modern',
}: CardSlabGridProps) {
  const isModern = labelStyle === 'modern'

  // Calculate scale for name to fit on single line
  const maxCharsAtFullSize = 20
  const nameScaleX = displayName.length <= maxCharsAtFullSize
    ? 1
    : Math.max(0.55, maxCharsAtFullSize / displayName.length)

  // Dynamic set line font size
  const dynamicSetFontSize = setLineText.length > 50 ? '8px'
    : setLineText.length > 40 ? '9px'
    : setLineText.length > 30 ? '10px'
    : '11px'

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

  // Separator style
  const separatorStyle = isModern
    ? {
        background: 'linear-gradient(90deg, rgba(139, 92, 246, 0.3) 0%, rgba(139, 92, 246, 0.6) 50%, rgba(139, 92, 246, 0.3) 100%)',
      }
    : {
        background: 'linear-gradient(90deg, #9333ea 0%, #a855f7 50%, #9333ea 100%)',
      }

  // Traditional label for grid
  const TraditionalLabel = () => (
    <div className="bg-gradient-to-b from-gray-50 to-white p-3 h-[95px]">
      <div className="flex items-center justify-between gap-1.5 h-full">
        {/* Left: DCM Logo */}
        <div className="flex-shrink-0 -ml-1">
          <img
            src="/DCM-logo.png"
            alt="DCM"
            className="h-9 w-auto"
          />
        </div>

        {/* Center: Card Information */}
        <div className="flex-1 min-w-0 mx-1 flex flex-col justify-center gap-0.5">
          {/* Line 1: Player/Card Name */}
          <div
            className="font-bold text-gray-900 leading-tight whitespace-nowrap origin-left"
            style={{
              fontSize: '13px',
              transform: `scaleX(${nameScaleX})`,
              lineHeight: '1.2'
            }}
            title={displayName}
          >
            {displayName}
          </div>

          {/* Line 2: Set Name */}
          <div
            className="text-gray-700 leading-tight"
            style={{
              fontSize: dynamicSetFontSize,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word'
            }}
            title={setLineText}
          >
            {setLineText}
          </div>

          {/* Line 3: Special Features */}
          {features.length > 0 && (
            <div className="text-blue-600 font-semibold text-[10px] leading-tight truncate">
              {features.join(' • ')}
            </div>
          )}

          {/* Line 4: DCM Serial Number */}
          <div className="text-gray-500 font-mono truncate text-[10px] leading-tight">
            {serial}
          </div>
        </div>

        {/* Right: Grade Display */}
        <div className="text-center flex-shrink-0">
          <div className="font-bold text-purple-700 text-3xl leading-none">
            {grade !== null ? Math.round(grade).toString() : (isAlteredAuthentic ? 'A' : 'N/A')}
          </div>
          {(condition || isAlteredAuthentic) && (
            <>
              <div className="border-t-2 border-purple-600 w-8 mx-auto my-1"></div>
              <div className="font-semibold text-purple-600 text-[0.65rem] leading-tight">
                {isAlteredAuthentic && grade === null ? 'Authentic' : condition}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div
      className={`rounded-xl p-1 overflow-hidden ${className}`}
      style={slabBorderStyle}
    >
      <div className={`${isModern ? '' : 'bg-white'} rounded-lg overflow-hidden`}>
        {/* Label */}
        {isModern ? (
          <ModernFrontLabel
            displayName={displayName}
            setLineText={setLineText}
            features={features}
            serial={serial}
            grade={grade}
            condition={condition}
            isAlteredAuthentic={isAlteredAuthentic}
            size="md"
          />
        ) : (
          <TraditionalLabel />
        )}

        {/* Separator - mimics slab divider */}
        <div className="h-1" style={separatorStyle} />

        {/* Card Image */}
        <div className="aspect-[3/4] relative bg-gray-100">
          {frontImageUrl ? (
            <Image
              src={frontImageUrl}
              alt="Card"
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-contain"
              unoptimized={frontImageUrl.includes('supabase')}
            />
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
