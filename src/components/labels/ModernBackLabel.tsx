'use client'

import { QRCodeCanvas } from 'qrcode.react'
import type { LabelColorOverrides } from '@/lib/labelPresets'
import { RAINBOW_GRADIENT } from '@/lib/labelPresets'

interface SubScores {
  centering: number
  corners: number
  edges: number
  surface: number
}

interface ModernBackLabelProps {
  serial: string
  grade: number | null
  condition?: string
  qrCodeUrl?: string
  subScores?: SubScores
  isAlteredAuthentic?: boolean
  size?: 'sm' | 'md' | 'lg'
  // Badge options - display order: Founder first, then Card Lover, then VIP
  showFounderEmblem?: boolean
  showVipEmblem?: boolean
  showCardLoversEmblem?: boolean
  colorOverrides?: LabelColorOverrides
}

// Helper: Format grade for display
const formatGrade = (grade: number): string => {
  return Math.round(grade).toString()
}

// Helper: Format sub-score (whole number)
const formatSubScore = (score: number): string => {
  return Math.round(score).toString()
}

// Size configurations for modern back label - heights match ModernFrontLabel for consistency
const sizeConfig = {
  sm: {
    height: 'h-[85px]',
    padding: 'px-2 py-1.5',
    qrSize: 50,
    gradeSize: 'text-2xl',
    conditionSize: 'text-[8px]',
    subScoreSize: 'text-[8px]',
    founderStarSize: 'text-[12px]',
    founderTextSize: '7px',
  },
  md: {
    height: 'h-[95px]',
    padding: 'px-3 py-2',
    qrSize: 58,
    gradeSize: 'text-3xl',
    conditionSize: 'text-[9px]',
    subScoreSize: 'text-[9px]',
    founderStarSize: 'text-[14px]',
    founderTextSize: '8px',
  },
  lg: {
    height: 'h-[110px]',
    padding: 'px-4 py-2.5',
    qrSize: 66,
    gradeSize: 'text-4xl',
    conditionSize: 'text-[10px]',
    subScoreSize: 'text-[10px]',
    founderStarSize: 'text-[16px]',
    founderTextSize: '9px',
  },
}

export function ModernBackLabel({
  serial,
  grade,
  condition = '',
  qrCodeUrl,
  subScores,
  isAlteredAuthentic = false,
  size = 'md',
  showFounderEmblem = false,
  showVipEmblem = false,
  showCardLoversEmblem = false,
  colorOverrides,
}: ModernBackLabelProps) {
  const config = sizeConfig[size]

  // Use color overrides if provided, else default purple
  const gradStart = colorOverrides?.gradientStart || '#1a1625'
  const gradEnd = colorOverrides?.gradientEnd || '#2d1f47'
  const isRainbow = colorOverrides?.isRainbow || false

  // Background gradient
  const bgGradient = isRainbow
    ? RAINBOW_GRADIENT
    : `linear-gradient(135deg, ${gradStart} 0%, ${gradEnd} 50%, ${gradStart} 100%)`

  const glowColor = isRainbow
    ? 'rgba(255, 255, 255, 0.08)'
    : colorOverrides?.gradientEnd
      ? `${colorOverrides.gradientEnd}1a`
      : 'rgba(139, 92, 246, 0.1)'

  // QR container accent color derived from gradientEnd
  const qrAccent40 = isRainbow
    ? 'rgba(255, 255, 255, 0.25)'
    : colorOverrides?.gradientEnd
      ? `${colorOverrides.gradientEnd}66`
      : 'rgba(139, 92, 246, 0.4)'
  const qrAccent50 = isRainbow
    ? 'rgba(255, 255, 255, 0.35)'
    : colorOverrides?.gradientEnd
      ? `${colorOverrides.gradientEnd}80`
      : 'rgba(139, 92, 246, 0.5)'

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

      <div className="relative flex items-center justify-between h-full gap-2">
        {/* LEFT: QR Code with styled background + Founder badge */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* QR Code with modern styled background */}
          {qrCodeUrl && (
            <div
              className="p-1.5 rounded"
              style={{
                background: gradStart,
                boxShadow: `0 0 12px ${qrAccent50}`,
                border: `1px solid ${qrAccent40}`,
              }}
            >
              <div className="bg-white p-1 rounded">
                <QRCodeCanvas
                  value={qrCodeUrl}
                  size={config.qrSize}
                  level="H"
                  includeMargin={false}
                  fgColor="#000000"
                  bgColor="#FFFFFF"
                />
              </div>
            </div>
          )}

          {/* Founder badge - star at top, Founder sideways below */}
          {showFounderEmblem && (
            <div className="flex flex-col items-center justify-start h-full py-1">
              <span className={`${config.founderStarSize} leading-none`} style={{ color: '#FFD700' }}>
                ★
              </span>
              <span
                className="uppercase"
                style={{
                  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                  fontWeight: 600,
                  fontSize: config.founderTextSize,
                  color: '#FFFFFF',
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

          {/* Card Lovers badge - heart at top, Card Lover sideways below */}
          {showCardLoversEmblem && (
            <div className="flex flex-col items-center justify-start h-full py-1">
              <span className={`${config.founderStarSize} leading-none`} style={{ color: '#f43f5e' }}>
                ♥
              </span>
              <span
                style={{
                  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                  fontWeight: 600,
                  fontSize: config.founderTextSize,
                  color: '#FFFFFF',
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

          {/* VIP badge - diamond at top, VIP sideways below */}
          {showVipEmblem && (
            <div className="flex flex-col items-center justify-start h-full py-1">
              <span className={`${config.founderStarSize} leading-none`} style={{ color: '#6366f1' }}>
                ◆
              </span>
              <span
                style={{
                  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                  fontWeight: 600,
                  fontSize: config.founderTextSize,
                  color: '#FFFFFF',
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                  marginTop: '3px',
                  letterSpacing: '0.5px',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale',
                  textRendering: 'optimizeLegibility',
                } as React.CSSProperties}
              >
                VIP
              </span>
            </div>
          )}
        </div>

        {/* CENTER: Large Grade + Condition (centered, no founding member text) */}
        <div className="flex-1 flex flex-col items-center justify-center">
          {/* Grade */}
          <div
            className={`font-bold ${config.gradeSize} leading-none`}
            style={{ color: '#ffffff' }}
          >
            {grade !== null ? formatGrade(grade) : (isAlteredAuthentic ? 'A' : 'N/A')}
          </div>
          {/* Condition */}
          {(condition || isAlteredAuthentic) && (
            <div
              className={`font-semibold ${config.conditionSize} leading-tight mt-1 uppercase tracking-wide`}
              style={{ color: 'rgba(255, 255, 255, 0.8)' }}
            >
              {isAlteredAuthentic && grade === null ? 'Authentic' : condition}
            </div>
          )}
        </div>

        {/* RIGHT: Four Sub-Grades formatted as "Label: Score" */}
        {subScores && (
          <div className="flex flex-col justify-center gap-0.5 flex-shrink-0 text-right">
            <div className={`${config.subScoreSize}`} style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
              Centering: {formatSubScore(subScores.centering)}
            </div>
            <div className={`${config.subScoreSize}`} style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
              Corners: {formatSubScore(subScores.corners)}
            </div>
            <div className={`${config.subScoreSize}`} style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
              Edges: {formatSubScore(subScores.edges)}
            </div>
            <div className={`${config.subScoreSize}`} style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
              Surface: {formatSubScore(subScores.surface)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ModernBackLabel
