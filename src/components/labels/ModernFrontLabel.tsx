'use client'

interface ModernFrontLabelProps {
  displayName: string
  setLineText: string // Card number + set name
  features?: string[]
  serial: string
  grade: number | null
  condition?: string
  isAlteredAuthentic?: boolean
  size?: 'sm' | 'md' | 'lg'
}

// Helper: Format grade for display
const formatGrade = (grade: number): string => {
  return Math.round(grade).toString()
}

// Size configurations for modern label
const sizeConfig = {
  sm: {
    logoHeight: 'h-6',
    nameFontSize: '10px',
    detailFontSize: '8px',
    featureFontSize: '7px',
    serialFontSize: '7px',
    gradeSize: 'text-2xl',
    conditionSize: 'text-[8px]',
    padding: 'px-2 py-1.5',
    height: 'h-[70px]',
  },
  md: {
    logoHeight: 'h-8',
    nameFontSize: '12px',
    detailFontSize: '9px',
    featureFontSize: '8px',
    serialFontSize: '8px',
    gradeSize: 'text-3xl',
    conditionSize: 'text-[9px]',
    padding: 'px-3 py-2',
    height: 'h-[80px]',
  },
  lg: {
    logoHeight: 'h-10',
    nameFontSize: '14px',
    detailFontSize: '11px',
    featureFontSize: '10px',
    serialFontSize: '9px',
    gradeSize: 'text-4xl',
    conditionSize: 'text-[10px]',
    padding: 'px-4 py-2.5',
    height: 'h-[90px]',
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
}: ModernFrontLabelProps) {
  const config = sizeConfig[size]

  // Calculate scale for name to fit on single line
  const maxCharsAtFullSize = size === 'sm' ? 16 : size === 'md' ? 20 : 24
  const nameScaleX = displayName.length <= maxCharsAtFullSize
    ? 1
    : Math.max(0.55, maxCharsAtFullSize / displayName.length)

  return (
    <div
      className={`${config.height} ${config.padding} relative overflow-hidden`}
      style={{
        background: 'linear-gradient(135deg, #1a1625 0%, #2d1f47 50%, #1a1625 100%)',
      }}
    >
      {/* Subtle inner glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(139, 92, 246, 0.1) 0%, transparent 70%)',
        }}
      />

      <div className="relative flex items-center justify-between h-full gap-2">
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
          {/* Line 1: Player/Card Name */}
          <div
            className="font-semibold leading-tight whitespace-nowrap origin-left"
            style={{
              fontSize: config.nameFontSize,
              transform: `scaleX(${nameScaleX})`,
              color: 'rgba(255, 255, 255, 0.95)',
            }}
            title={displayName}
          >
            {displayName}
          </div>

          {/* Line 2: Card Number + Set Name */}
          <div
            className="leading-tight truncate"
            style={{
              fontSize: config.detailFontSize,
              color: 'rgba(255, 255, 255, 0.7)',
            }}
            title={setLineText}
          >
            {setLineText}
          </div>

          {/* Line 3: Special Features */}
          {features.length > 0 && (
            <div
              className="font-medium leading-tight truncate"
              style={{
                fontSize: config.featureFontSize,
                color: 'rgba(34, 197, 94, 0.9)', // Green accent for features
              }}
            >
              {features.join(' • ')}
            </div>
          )}

          {/* Line 4: Serial Number */}
          <div
            className="font-mono leading-tight truncate"
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
