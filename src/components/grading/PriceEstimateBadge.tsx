'use client'

interface PriceEstimateBadgeProps {
  estimatedValue: number | null
  matchConfidence?: 'high' | 'medium' | 'low' | 'none' | null
  compact?: boolean
  detailPageUrl?: string
}

export function PriceEstimateBadge({
  estimatedValue,
  matchConfidence,
  compact = false,
  detailPageUrl,
}: PriceEstimateBadgeProps) {
  if (!estimatedValue) return null

  const formattedValue = estimatedValue.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  const confidenceLabel =
    matchConfidence === 'high' ? 'Best Match' :
    matchConfidence === 'medium' ? 'Good Match' :
    matchConfidence === 'low' ? 'Partial Match' : null

  const confidenceColor =
    matchConfidence === 'high' ? 'bg-green-100 text-green-700' :
    matchConfidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
    'bg-orange-100 text-orange-700'

  if (compact) {
    return (
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg px-3 py-2 border border-emerald-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-emerald-700">Est. Value:</span>
          <span className="text-base font-bold text-emerald-800">${formattedValue}</span>
        </div>
        {confidenceLabel && (
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${confidenceColor}`}>
            {confidenceLabel}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl shadow-lg p-5 border-2 border-emerald-200">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-emerald-700">DCM Estimated Value</span>
          </div>
          <p className="text-2xl font-bold text-emerald-800">${formattedValue}</p>
        </div>
        {confidenceLabel && (
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${confidenceColor}`}>
            {confidenceLabel}
          </span>
        )}
      </div>
      {detailPageUrl && (
        <p className="text-xs text-gray-600 mt-3">
          View full pricing details on the{' '}
          <a href={detailPageUrl} className="text-emerald-700 font-medium hover:text-emerald-800 underline">
            card detail page
          </a>.
        </p>
      )}
    </div>
  )
}
