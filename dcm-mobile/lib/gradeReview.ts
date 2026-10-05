// API contract mirrored from src/lib/gradeReview/types.ts; verified by the parity tests.
export const GRADE_REVIEW_NOTE_MIN = 15
export const reviewStatusLabels = {
  queued: 'Review requested', processing: 'Review in progress', completed: 'Review complete',
  awaiting_owner: 'Grade change awaiting your approval', failed: 'Review delayed', superseded: 'A newer grade is available',
} as const
export const detailsFields = {
  card_name: 'Card name', set_name: 'Set', year: 'Year', card_number: 'Card number', serial_number: 'Serial number', other: 'Other details',
} as const
export type DetailsClaim = Partial<Record<keyof typeof detailsFields, string>>
export interface ReviewState {
  enabled: boolean; eligible: boolean; detailsEligible?: boolean; gradeRunId: string | null
  identificationConfidence?: string | null
  review: null | {
    id: string; status: keyof typeof reviewStatusLabels; requested_at: string; note: string
    customer_result: string | null; original_grade?: number | null; proposed_grade?: number | null
    details_claim?: DetailsClaim | null
    details_changes?: Array<{ field: string; from: string | null; to: string | null }> | null
    changes?: Array<{ category: string; side: string; from: number; to: number }>
  }
}
export function buildReviewRequest(state: ReviewState, grade: boolean, details: boolean, note: string, claim: DetailsClaim) {
  if (!state.enabled || !state.gradeRunId || state.review) throw Error('Refresh this card before requesting another review.')
  const reviewGrade = grade && state.eligible
  const filled: Record<string, string> = {}
  for (const key of Object.keys(detailsFields) as Array<keyof DetailsClaim>) {
    const value = claim[key]?.trim()
    if (value) filled[key] = value
  }
  if (reviewGrade && note.trim().length < GRADE_REVIEW_NOTE_MIN) throw Error(`Tell us what looks wrong in at least ${GRADE_REVIEW_NOTE_MIN} characters.`)
  if (note.length > 1000 || Object.values(filled).some(value => (value?.length ?? 0) > 200)) throw Error('Please shorten your note or correction.')
  if (details && !state.detailsEligible) throw Error('Card-detail corrections are unavailable for this grade.')
  if (!reviewGrade && !(details && Object.keys(filled).length)) throw Error('Choose the grade or enter the card details that need correcting.')
  return {
    gradeRunId: state.gradeRunId,
    concerns: ['centering', 'corners', 'edges', 'surface'].map(category => ({ category, side: 'both' })),
    note: note.trim(), reviewGrade,
    ...(details && Object.keys(filled).length ? { details: filled } : {}),
  }
}
