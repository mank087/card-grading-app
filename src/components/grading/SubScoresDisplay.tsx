'use client'

import { safeToFixed } from '@/lib/gradeDisplayUtils'

interface SubScoresDisplayProps {
  subScores: any // conversational_sub_scores shape
  weightedScores?: { centering?: number; corners?: number; edges?: number; surface?: number } | null
  limitingFactor?: string | null
  compact?: boolean
}

const categories = [
  { key: 'centering', label: 'Centering', gradient: 'from-blue-500 to-blue-600', textColor: 'text-blue-700', strongColor: 'text-blue-800' },
  { key: 'corners', label: 'Corners', gradient: 'from-green-500 to-green-600', textColor: 'text-green-700', strongColor: 'text-green-800' },
  { key: 'edges', label: 'Edges', gradient: 'from-purple-500 to-purple-600', textColor: 'text-purple-700', strongColor: 'text-purple-800' },
  { key: 'surface', label: 'Surface', gradient: 'from-amber-500 to-amber-600', textColor: 'text-amber-700', strongColor: 'text-amber-800' },
] as const

export function SubScoresDisplay({
  subScores,
  weightedScores,
  limitingFactor,
  compact = false,
}: SubScoresDisplayProps) {
  if (!subScores) return null

  // Support all three subgrade storage shapes that have shipped:
  //   1. Current flat:  weightedScores.centering_weighted (etc.)
  //   2. Older flat:    weightedScores.centering
  //   3. Legacy nested: subScores.centering.weighted / weighted_score
  const getScore = (key: string) => {
    const ws = weightedScores as any
    const ss = subScores[key]
    return ws?.[`${key}_weighted`] ?? ws?.[key] ?? ss?.weighted ?? ss?.weighted_score ?? 0
  }

  // For the per-side (Front / Back) breakdown shown in non-compact mode,
  // also support the current `raw` shape: subScores.raw.centering_front / _back
  const getSide = (key: string, side: 'front' | 'back') => {
    const ss = subScores[key]
    const raw = (subScores as any)?.raw
    return ss?.[`${side}_score`] ?? ss?.[side] ?? raw?.[`${key}_${side}`]
  }

  return (
    <div className={`bg-white rounded-xl shadow-lg ${compact ? 'p-3' : 'p-6'} border-2 border-purple-200`}>
      <div className="grid grid-cols-4 gap-3">
        {categories.map(({ key, label, gradient, textColor, strongColor }) => (
          <div key={key} className="text-center">
            <div className={`${compact ? 'w-12 h-12 text-base' : 'w-16 h-16 text-xl'} mx-auto rounded-full flex items-center justify-center font-bold text-white bg-gradient-to-br ${gradient} shadow-lg mb-1`}>
              {safeToFixed(getScore(key))}
            </div>
            <h3 className={`font-semibold ${compact ? 'text-xs' : 'text-sm'} text-gray-800`}>{label}</h3>
            {!compact && (subScores[key] || (subScores as any)?.raw) && (
              <div className="text-xs text-gray-600 mt-0.5">
                <p>F: <span className={`font-semibold ${textColor}`}>{safeToFixed(getSide(key, 'front'))}</span> | B: <span className={`font-semibold ${textColor}`}>{safeToFixed(getSide(key, 'back'))}</span></p>
                <p className={`font-semibold ${strongColor} mt-0.5`}>Score: {safeToFixed(getScore(key))}</p>
              </div>
            )}
          </div>
        ))}
      </div>
      {limitingFactor && !compact && (
        <p className="text-xs text-gray-500 mt-3 text-center">
          Limiting Factor: <span className="font-semibold text-gray-700 capitalize">{limitingFactor}</span>
        </p>
      )}
    </div>
  )
}
