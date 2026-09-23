'use client';

/**
 * The DCM Optic confidence score chip: the A-D letter legacy prints beside the
 * grade, and the grade uncertainty that follows from it. Opens the
 * explanation in Grade details.
 *
 * Extracted from `GradeHighlights` unchanged (Sept 23 mobile review, S2) so
 * the hero grade panel can show the same chip on a phone, where the
 * highlights block is hidden. Same markup, same classes, same label.
 */

import { confidenceLevelFor, readImageGrade } from '@/lib/cardDetail/gradeDetails';
import { getUncertaintyFromConfidence } from '@/lib/cardDetail/parsers';

export interface ConfidenceChipProps {
  card: any;
  /** Opens the explanation (Grade details, `tour-optic-score`). */
  onOpen: () => void;
}

export function ConfidenceChip({ card, onOpen }: ConfidenceChipProps) {
  const confidenceScore = readImageGrade(card);
  const confidence = confidenceLevelFor(confidenceScore);
  const uncertainty = getUncertaintyFromConfidence(confidenceScore, card?.conversational_whole_grade);

  return (
    <button
      type="button"
      className={`cd-confidence-chip cd-tone-${confidence.tone}`}
      onClick={onOpen}
      aria-label={`DCM Optic confidence score ${confidenceScore}, grade uncertainty ${uncertainty}. Open the explanation.`}
    >
      <span className="cd-confidence-label">Confidence score</span>
      <strong>{confidenceScore}</strong>
      <span className="cd-confidence-uncertainty">{uncertainty}</span>
    </button>
  );
}

export default ConfidenceChip;
