'use client'

import { formatGrade, getUncertaintyFromConfidence, getConfidenceBadgeColor } from '@/lib/gradeDisplayUtils'

interface GradeHeroBannerProps {
  grade: number | null
  conditionLabel: string
  imageConfidence?: string | null
  isAlteredAuthentic?: boolean
  compact?: boolean
}

export function GradeHeroBanner({
  grade,
  conditionLabel,
  imageConfidence,
  isAlteredAuthentic = false,
  compact = false,
}: GradeHeroBannerProps) {
  const hasGrade = grade !== null && grade !== undefined && grade !== 0
  const gradientClass = hasGrade
    ? 'bg-gradient-to-r from-indigo-600 to-purple-600'
    : 'bg-gradient-to-r from-red-600 to-orange-600'

  const gradeText = hasGrade
    ? formatGrade(grade)
    : isAlteredAuthentic
      ? 'A'
      : 'N/A'

  const conditionText = isAlteredAuthentic && !hasGrade ? 'Authentic' : conditionLabel

  return (
    <div className={`${gradientClass} text-white ${compact ? 'rounded-xl p-4' : 'rounded-2xl p-8'} shadow-lg text-center`}>
      <h2 className={`${compact ? 'text-5xl' : 'text-7xl'} font-extrabold tracking-tight mb-1`}>
        {gradeText}
      </h2>
      <p className={`${compact ? 'text-sm' : 'text-lg'} font-medium`}>
        {conditionText}
      </p>
      <div className={`${compact ? 'mt-2' : 'mt-4'} flex justify-center space-x-3 flex-wrap gap-1`}>
        <span className="text-xs bg-white/20 px-3 py-1 rounded-full">
          Uncertainty: {getUncertaintyFromConfidence(imageConfidence)}
        </span>
        <span className={`text-xs px-3 py-1 rounded-full font-semibold ${getConfidenceBadgeColor(imageConfidence)}`}>
          Confidence: {imageConfidence?.toUpperCase() || 'B'}
        </span>
      </div>
    </div>
  )
}
