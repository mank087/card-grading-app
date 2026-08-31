'use client'

import { UNVERIFIED_AUTOGRAPH_DESIGNATION } from '@/lib/grading/autographPolicy'

const DESIGNATION_TOOLTIP =
  'The card carries a hand-applied autograph with no manufacturer authentication. The numeric grade is unaffected.'

interface DesignationBadgeProps {
  /** The designation text. Defaults to "Altered - Unverified Autograph". */
  designation?: string | null
  /** 'onDark' for the coloured grade hero, 'light' for white/neutral surfaces. */
  tone?: 'onDark' | 'light'
  className?: string
}

/**
 * A quiet amber notation chip shown next to the grade. It is a notation, not an
 * alarm — deliberately subordinate to the score it sits beside.
 */
export function DesignationBadge({
  designation = UNVERIFIED_AUTOGRAPH_DESIGNATION,
  tone = 'onDark',
  className = '',
}: DesignationBadgeProps) {
  if (!designation) return null

  const toneClass =
    tone === 'onDark'
      ? 'bg-amber-400/20 border border-amber-200/60 text-amber-50'
      : 'bg-amber-50 border border-amber-300 text-amber-800'

  return (
    <span
      title={DESIGNATION_TOOLTIP}
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${toneClass} ${className}`}
    >
      <span aria-hidden="true">✎</span>
      {designation}
    </span>
  )
}

export default DesignationBadge
