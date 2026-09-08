import { ratiosAgree, type compareCentering, type PreparedReview } from './centeringReview';

export type CenteringFinding = ReturnType<typeof compareCentering>;
export type ReviewOutcome = 'grade_confirmed' | 'report_corrected' | 'grade_corrected' | 'unable_to_verify';
export type UnableReason = 'unsupported_report' | 'unclear_photos' | 'invalid_observation' | 'disagreement' | 'verification_unavailable' | 'scoring_unavailable' | 'images_changed';
const reasons: Record<UnableReason, string> = {
  unsupported_report: 'The original report does not contain enough information to check this reliably.',
  unclear_photos: 'The photos are not clear enough to confirm a centering correction.',
  invalid_observation: 'We could not get a reliable centering measurement from these photos.',
  disagreement: 'The centering measurements varied too much to support a correction.',
  verification_unavailable: 'We could not confirm the proposed centering correction.',
  scoring_unavailable: 'We could not establish how the new measurement should affect the grade.',
  images_changed: 'The card photos changed during the review.',
};
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};

/** Explain known scores, not newly invented physical defects or unsupported prose. */
export function explainGradeLimit(report: unknown, grade: number): string {
  const source = record(report), rounded = record(record(source.grading_passes).averaged_rounded), weighted = record(source.weighted_scores);
  const scores = ['centering', 'corners', 'edges', 'surface'].map(category => ({ category, score: rounded[category] ?? weighted[`${category}_weighted`] }));
  if (!scores.every(item => typeof item.score === 'number' && item.score >= 1 && item.score <= 10)) return '';
  const lowest = Math.min(...scores.map(item => item.score as number));
  if (lowest > grade) return 'The original report includes a separate limit on the overall grade.';
  if (lowest !== grade) return '';
  if (grade === 10) return 'All four recorded category scores are 10.';
  const limited = scores.filter(item => item.score === lowest).map(item => item.category).join(' and ');
  return `The report records ${limited} at ${lowest}, which limits the overall grade.`;
}

/** Describe structured comparisons without repeating free-form model prose. */
export function describeCentering(review: CenteringFinding): string {
  return review.findings.map(finding => {
    const face = finding.side === 'front' ? 'Front' : 'Back';
    if (finding.verdict === 'confirmed') return `${face} centering is consistent with the original report.`;
    if (finding.verdict !== 'correction_proposed') return '';
    const changes = (['left_right', 'top_bottom'] as const).flatMap(axis => {
      const before = finding.original[axis], after = finding.observed[axis];
      if (!after || ratiosAgree(before, after)) return [];
      const label = axis === 'left_right' ? 'left/right' : 'top/bottom';
      return [before ? `${label} from ${before} to ${after}` : `${label} to ${after}`];
    });
    return changes.length ? `${face} centering was corrected: ${changes.join(' and ')}.`
      : `${face} centering was corrected to match the card's border layout and grading rules.`;
  }).filter(Boolean).join(' ');
}

export function retainedResult(prepared: PreparedReview | null, outcome: 'grade_confirmed' | 'unable_to_verify', reason?: UnableReason, findings?: CenteringFinding) {
  const grade = prepared?.saved.grade;
  const retained = grade ? `Your original grade remains ${grade}.` : 'Your original grade remains unchanged.';
  const lead = outcome === 'grade_confirmed' ? (findings ? describeCentering(findings) : 'The centering matches the original report.')
    : reasons[reason ?? 'unclear_photos'];
  return [lead, retained, prepared ? explainGradeLimit(prepared.report, prepared.saved.grade) : ''].filter(Boolean).join(' ');
}

/** Both blind inspections must support the same material correction. */
export function corroborates(first: CenteringFinding, confirmation: CenteringFinding): boolean {
  if (first.findings.length !== confirmation.findings.length) return false;
  return first.findings.every(a => {
    const b = confirmation.findings.find(finding => finding.side === a.side);
    return Boolean(b && a.candidate_score !== null && b.candidate_score !== null &&
      a.verdict !== 'unable_to_verify' && b.verdict === a.verdict && a.candidate_score === b.candidate_score &&
      a.observed.confidence === 'high' && b.observed.confidence === 'high' &&
      a.observed.layout === b.observed.layout && a.limitations.length === 0 && b.limitations.length === 0 &&
      ratiosAgree(a.observed.left_right, b.observed.left_right) && ratiosAgree(a.observed.top_bottom, b.observed.top_bottom));
  });
}
