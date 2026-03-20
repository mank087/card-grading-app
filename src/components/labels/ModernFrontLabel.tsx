'use client'

import type { LabelColorOverrides } from '@/lib/labelPresets'
import { RAINBOW_GRADIENT } from '@/lib/labelPresets'

interface ModernFrontLabelProps {
  displayName: string
  setLineText: string // Card number + set name
  features?: string[]
  serial: string
  grade: number | null
  condition?: string
  isAlteredAuthentic?: boolean
  size?: 'sm' | 'md' | 'lg'
  colorOverrides?: LabelColorOverrides
}

// Helper: Format grade for display
const formatGrade = (grade: number): string => {
  return Math.round(grade).toString()
}

// Size configurations for modern label - heights match ModernBackLabel for consistency
const sizeConfig = {
  sm: {
    logoHeight: 'h-6',
    nameMaxFontSize: 10,
    nameMinFontSize: 7,
    detailFontSize: '8px',
    featureFontSize: '7px',
    serialFontSize: '7px',
    gradeSize: 'text-2xl',
    conditionSize: 'text-[8px]',
    padding: 'px-2 py-1.5',
    height: 'h-[85px]',
    maxNameChars: 18,
  },
  md: {
    logoHeight: 'h-8',
    nameMaxFontSize: 12,
    nameMinFontSize: 9,
    detailFontSize: '9px',
    featureFontSize: '8px',
    serialFontSize: '8px',
    gradeSize: 'text-3xl',
    conditionSize: 'text-[9px]',
    padding: 'px-3 py-2',
    height: 'h-[95px]',
    maxNameChars: 22,
  },
  lg: {
    logoHeight: 'h-10',
    nameMaxFontSize: 14,
    nameMinFontSize: 10,
    detailFontSize: '11px',
    featureFontSize: '10px',
    serialFontSize: '9px',
    gradeSize: 'text-4xl',
    conditionSize: 'text-[10px]',
    padding: 'px-4 py-2.5',
    height: 'h-[110px]',
    maxNameChars: 26,
  },
}

export function ModernFrontLabel({
  displayName,
  setLineText,
  features = [],
  serial,
  grade,
  condition = '',
  isAlteredAuthentic = false,
  size = 'md',
  colorOverrides,
}: ModernFrontLabelProps) {
  const config = sizeConfig[size]

  // Calculate dynamic font size for name (shrink to fit instead of scaleX)
  const nameFontSize = displayName.length <= config.maxNameChars
    ? config.nameMaxFontSize
    : Math.max(config.nameMinFontSize, Math.floor(config.nameMaxFontSize * (config.maxNameChars / displayName.length)))

  // Use color overrides if provided, else default purple
  const gradStart = colorOverrides?.gradientStart || '#1a1625'
  const gradEnd = colorOverrides?.gradientEnd || '#2d1f47'
  const isRainbow = colorOverrides?.isRainbow || false

  // Background gradient - rainbow uses multi-stop, else standard 3-point
  const bgGradient = isRainbow
    ? RAINBOW_GRADIENT
    : `linear-gradient(135deg, ${gradStart} 0%, ${gradEnd} 50%, ${gradStart} 100%)`

  // Derive glow color from gradientEnd at low opacity
  const glowColor = isRainbow
    ? 'rgba(255, 255, 255, 0.08)'
    : colorOverrides?.gradientEnd
      ? `${colorOverrides.gradientEnd}1a` // ~10% opacity via hex alpha
      : 'rgba(139, 92, 246, 0.1)'

  const borderStyle = colorOverrides?.borderEnabled
    ? { border: `${Math.round(colorOverrides.borderWidth * 96)}px solid ${colorOverrides.borderColor}` }
    : {}

  return (
    <div
      className={`${config.height} ${config.padding} relative overflow-hidden`}
      style={{
        background: bgGradient,
        ...borderStyle,
      }}
    >
      {/* Subtle inner glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, ${glowColor} 0%, transparent 70%)`,
        }}
      />

      <div className="relative flex items-center justify-between h-full w-full gap-2">
        {/* Left: DCM Logo */}
        <div className="flex-shrink-0">
          <img
            src="/DCM Logo white.png"
            alt="DCM"
            className={`${config.logoHeight} w-auto`}
          />
        </div>

        {/* Center: Card Information - Light white text */}
        <div className="flex-1 min-w-0 mx-1 flex flex-col justify-center gap-0">
          {/* Line 1: Player/Card Name - font shrinks to fit */}
          <div
            className="font-semibold leading-tight"
            style={{
              fontSize: `${nameFontSize}px`,
              color: 'rgba(255, 255, 255, 0.95)',
              wordBreak: 'break-word',
            }}
            title={displayName}
          >
            {displayName}
          </div>

          {/* Line 2: Card Number + Set Name - wraps to multiple lines */}
          <div
            className="leading-tight"
            style={{
              fontSize: config.detailFontSize,
              color: 'rgba(255, 255, 255, 0.7)',
              wordBreak: 'break-word',
            }}
            title={setLineText}
          >
            {setLineText}
          </div>

          {/* Line 3: Special Features */}
          {features.length > 0 && (
            <div
              className="font-medium leading-tight"
              style={{
                fontSize: config.featureFontSize,
                color: 'rgba(34, 197, 94, 0.9)', // Green accent for features
                wordBreak: 'break-word',
              }}
            >
              {features.join(' • ')}
            </div>
          )}

          {/* Line 4: Serial Number */}
          <div
            className="font-mono leading-tight"
            style={{
              fontSize: config.serialFontSize,
              color: 'rgba(255, 255, 255, 0.5)',
            }}
          >
            {serial}
          </div>
        </div>

        {/* Right: Grade Display */}
        <div className="text-center flex-shrink-0">
          <div
            className={`font-bold ${config.gradeSize} leading-none`}
            style={{ color: '#ffffff' }}
          >
            {grade !== null ? formatGrade(grade) : (isAlteredAuthentic ? 'A' : 'N/A')}
          </div>
          {(condition || isAlteredAuthentic) && (
            <div
              className={`font-semibold ${config.conditionSize} leading-tight mt-0.5 uppercase tracking-wide`}
              style={{ color: 'rgba(255, 255, 255, 0.8)' }}
            >
              {isAlteredAuthentic && grade === null ? 'Authentic' : condition}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ModernFrontLabel
