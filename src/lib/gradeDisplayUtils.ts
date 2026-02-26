/**
 * Shared grade display utility functions
 * Extracted from CardDetailClient patterns for reuse across components.
 */

/** Format a grade as a whole number string, or "N/A" */
export function formatGrade(grade: number | null | undefined): string {
  if (grade === null || grade === undefined || grade === 0) {
    return 'N/A'
  }
  return Math.round(grade).toString()
}

/** Map confidence letter (A/B/C/D) to uncertainty string */
export function getUncertaintyFromConfidence(confidence: string | null | undefined): string {
  if (!confidence) return '\u00B11' // ±1 default (B confidence)
  const conf = confidence.toUpperCase().trim()
  switch (conf) {
    case 'A': return '\u00B10'
    case 'B': return '\u00B11'
    case 'C': return '\u00B12'
    case 'D': return '\u00B13'
    default: return '\u00B11'
  }
}

/** Safely format a numeric value to a rounded whole number string */
export function safeToFixed(value: any, decimals: number = 0): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (typeof num !== 'number' || isNaN(num)) return '0'
  return Math.round(num).toString()
}

/** Get Tailwind classes for confidence badge color by letter grade */
export function getConfidenceBadgeColor(confidence: string | null | undefined): string {
  if (!confidence) return 'bg-white/20'
  switch (confidence.toUpperCase().trim()) {
    case 'A': return 'bg-green-500/30 border border-green-300'
    case 'B': return 'bg-blue-500/30 border border-blue-300'
    case 'C': return 'bg-yellow-500/30 border border-yellow-300'
    case 'D': return 'bg-red-500/30 border border-red-300'
    default: return 'bg-white/20'
  }
}
