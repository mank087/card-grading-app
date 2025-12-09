'use client'

import { QRCodeCanvas } from 'qrcode.react'
import { type LabelData } from '@/lib/labelDataGenerator'
import { getCardLabelData } from '@/lib/useLabelData'

/**
 * CardLabel - Renders just the label portion of a card slab
 *
 * This component ensures consistent label display across:
 * - Card detail pages
 * - Collection grids
 * - Featured cards
 * - Search results
 *
 * Uses pre-generated label_data from database when available,
 * falls back to on-the-fly generation for backward compatibility.
 */

export interface CardLabelProps {
  // Option 1: Pass the entire card object (will extract label_data)
  card?: any

  // Option 2: Pass pre-extracted label data directly
  labelData?: LabelData

  // Size variant
  size?: 'sm' | 'md' | 'lg'

  // For back labels - show QR code instead of card info
  variant?: 'front' | 'back'
  qrCodeUrl?: string
}

// Size configurations
const sizeConfig = {
  sm: {
    height: 'h-[85px]',
    padding: 'p-2',
    logoHeight: 'h-7',
    nameSize: { base: 11, medium: 10, small: 9 },
    contextSize: { base: 9, long: 8 },
    featureSize: 'text-[8px]',
    serialSize: 'text-[8px]',
    gradeSize: 'text-2xl',
    conditionSize: 'text-[0.55rem]',
    dividerWidth: 'w-6',
    qrSize: 45,
    qrLogoSize: 16,
  },
  md: {
    height: 'h-[95px]',
    padding: 'p-3',
    logoHeight: 'h-9',
    nameSize: { base: 13, medium: 12, small: 11 },
    contextSize: { base: 11, long: 9 },
    featureSize: 'text-[10px]',
    serialSize: 'text-[10px]',
    gradeSize: 'text-3xl',
    conditionSize: 'text-[0.65rem]',
    dividerWidth: 'w-8',
    qrSize: 55,
    qrLogoSize: 18,
  },
  lg: {
    height: 'h-[110px]',
    padding: 'p-3',
    logoHeight: 'h-14',
    nameSize: { base: 14, medium: 12, small: 11 },
    contextSize: { base: 12, long: 10 },
    featureSize: 'text-[11px]',
    serialSize: 'text-[11px]',
    gradeSize: 'text-4xl',
    conditionSize: 'text-[0.7rem]',
    dividerWidth: 'w-10',
    qrSize: 58,
    qrLogoSize: 20,
  },
}

/**
 * Get dynamic font size for primary name based on length
 */
function getNameFontSize(name: string, config: typeof sizeConfig.md): string {
  const length = name.length
  if (length > 35) return `${config.nameSize.small}px`
  if (length > 25) return `${config.nameSize.medium}px`
  return `${config.nameSize.base}px`
}

/**
 * Get dynamic font size for context line based on length
 */
function getContextFontSize(line: string, config: typeof sizeConfig.md): string {
  if (line.length > 40) return `${config.contextSize.long}px`
  return `${config.contextSize.base}px`
}

/**
 * Format grade for display
 */
function formatGradeDisplay(grade: number | null, isAlteredAuthentic: boolean): string {
  if (grade === null) return isAlteredAuthentic ? 'A' : 'N/A'
  return grade % 1 === 0.5 ? grade.toFixed(1) : Math.round(grade).toString()
}

export function CardLabel({
  card,
  labelData: providedLabelData,
  size = 'md',
  variant = 'front',
  qrCodeUrl,
}: CardLabelProps) {
  // Get label data from props or extract from card
  const labelData = providedLabelData || (card ? getCardLabelData(card) : null)

  if (!labelData) {
    return (
      <div className={`bg-gradient-to-b from-gray-50 to-white ${sizeConfig[size].height} ${sizeConfig[size].padding} flex items-center justify-center`}>
        <span className="text-gray-400 text-sm">No label data</span>
      </div>
    )
  }

  const config = sizeConfig[size]

  // Back label variant - QR code centered
  if (variant === 'back') {
    return (
      <div className={`bg-gradient-to-b from-gray-50 to-white ${config.height} flex items-center justify-center ${config.padding}`}>
        {qrCodeUrl ? (
          <div className="bg-white p-1 rounded relative">
            <QRCodeCanvas
              value={qrCodeUrl}
              size={config.qrSize}
              level="H"
              includeMargin={false}
            />
            {/* DCM Logo Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="bg-white rounded-full p-0.5 flex items-center justify-center"
                style={{ width: `${config.qrLogoSize}px`, height: `${config.qrLogoSize}px` }}
              >
                <img
                  src="/DCM-logo.png"
                  alt="DCM"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="text-gray-400 text-sm">Back</div>
        )}
      </div>
    )
  }

  // Front label variant - full card info
  const gradeDisplay = formatGradeDisplay(labelData.grade, labelData.isAlteredAuthentic)
  const conditionDisplay = labelData.isAlteredAuthentic && labelData.grade === null
    ? 'Authentic'
    : labelData.condition

  return (
    <div className={`bg-gradient-to-b from-gray-50 to-white ${config.height} ${config.padding}`}>
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
        <div className="flex-1 min-w-0 mx-2 flex flex-col justify-center gap-0.5">
          {/* Line 1: Primary Name */}
          <div
            className="font-bold text-gray-900 leading-tight truncate"
            style={{ fontSize: getNameFontSize(labelData.primaryName, config) }}
            title={labelData.primaryName}
          >
            {labelData.primaryName}
          </div>

          {/* Line 2: Context (Set • Subset • #Number • Year) */}
          <div
            className="text-gray-700 leading-tight"
            style={{
              fontSize: getContextFontSize(labelData.contextLine, config),
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word'
            }}
            title={labelData.contextLine}
          >
            {labelData.contextLine}
          </div>

          {/* Line 3: Special Features (if any) */}
          {labelData.featuresLine && (
            <div className={`text-blue-600 font-semibold ${config.featureSize} leading-tight truncate`}>
              {labelData.featuresLine}
            </div>
          )}

          {/* Line 4: DCM Serial Number */}
          <div className={`text-gray-500 font-mono truncate ${config.serialSize} leading-tight`}>
            {labelData.serial}
          </div>
        </div>

        {/* Right: Grade Display */}
        <div className="text-center flex-shrink-0">
          <div className={`font-bold text-purple-700 ${config.gradeSize} leading-none`}>
            {gradeDisplay}
          </div>
          {conditionDisplay && (
            <>
              <div className={`border-t-2 border-purple-600 ${config.dividerWidth} mx-auto my-1`}></div>
              <div className={`font-semibold text-purple-600 ${config.conditionSize} leading-tight`}>
                {conditionDisplay}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default CardLabel
