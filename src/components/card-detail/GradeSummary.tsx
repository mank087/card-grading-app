'use client';

/**
 * The hero's grade panel.
 *
 * Category-agnostic: everything it prints comes from the view model, so the
 * seven remaining categories reuse it unchanged.
 *
 * Three rules it exists to enforce, all of which the legacy page gets wrong or
 * gets right only by accident:
 *
 *  1. A null subgrade prints an em dash. Legacy renders `safeToFixed(x ?? 0)`,
 *     which prints a 0 nobody measured. The view model keeps null distinct
 *     (see viewModel.ts `readSubgrade`) and this component honours it.
 *  2. The short "why this grade" line is quoted from saved findings via
 *     `extractConditionSummary`. When there is none, the line is omitted.
 *     Nothing here writes grading prose.
 *  3. A detected PSA/BGS/SGC grade is shown as a separate, labelled block. It
 *     is never mixed into the DCM number.
 */

import type { CardDetailViewModel, GradeStatus } from '@/lib/cardDetail/viewModel';

export interface GradeSummaryProps {
  vm: CardDetailViewModel;
  /**
   * The one-line condition summary pulled out of the saved findings by
   * `extractConditionSummary`. Null when the report has none — the line is
   * then omitted rather than filled in.
   */
  conditionSummary: string | null;
  /** Activate the Grade details section, optionally scrolling to an anchor. */
  onJumpToGrade: (anchorId?: string) => void;
}

const SUBGRADE_ORDER = [
  { key: 'centering', label: 'Centering', anchor: 'tour-centering' },
  { key: 'corners', label: 'Corners', anchor: undefined },
  { key: 'edges', label: 'Edges', anchor: undefined },
  { key: 'surface', label: 'Surface', anchor: undefined },
] as const;

/** The headline under the number, per status. Never invents a grade. */
function statusHeadline(status: GradeStatus, condition: string | null): string {
  switch (status) {
    case 'graded':
      return condition ?? 'Graded';
    case 'altered-authentic':
      return 'Authentic';
    case 'not-gradable':
      return 'Not gradable';
    case 'in-progress':
      return 'Grading in progress';
    case 'incomplete-inspection':
      return 'Inspection incomplete';
    case 'ungraded':
      return 'Not yet graded';
  }
}

export function GradeSummary({ vm, conditionSummary, onJumpToGrade }: GradeSummaryProps) {
  const { grade, detectedSlabGrade } = vm;
  const showsSubgrades = grade.status === 'graded' || grade.status === 'altered-authentic';

  return (
    <section className="cd-panel cd-grade-panel" aria-labelledby="cd-grade-heading">
      <div className="cd-panel-heading">
        <p className="cd-eyebrow" id="cd-grade-heading">
          DCM Optic&trade; grade
        </p>
        <button type="button" className="cd-quiet" onClick={() => onJumpToGrade()}>
          View full analysis
        </button>
      </div>

      <div id="tour-grade-score" className="cd-grade-main" data-report-grade={grade.gradeFormatted}>
        <div className="cd-grade-number" data-status={grade.status}>
          {grade.gradeFormatted}
          {grade.status === 'graded' && <span>/ 10</span>}
        </div>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>
            {statusHeadline(grade.status, grade.condition)}
          </h2>
          {grade.designation && (
            <p className="cd-caption" style={{ marginTop: 4, fontWeight: 650 }}>
              {grade.designation}
            </p>
          )}
          {grade.limitingFactor && grade.status === 'graded' && (
            <p className="cd-caption" style={{ marginTop: 4 }}>
              Limiting factor: {grade.limitingFactor}
            </p>
          )}
        </div>
      </div>

      {/* The tour highlights this block whether or not it has numbers in it. */}
      <div id="tour-subgrades" className="cd-subgrades">
        {SUBGRADE_ORDER.map(({ key, label, anchor }) => {
          const value = vm.grade.subgrades[key];
          return (
            <button
              key={key}
              type="button"
              className="cd-subgrade"
              onClick={() => onJumpToGrade(anchor)}
              aria-label={`${label}: ${value === null ? 'not scored' : value}. Open the grade details.`}
            >
              <span className="cd-subgrade-label">{label}</span>
              {/* null is "never scored", not zero. */}
              <b>{value === null ? '—' : value}</b>
            </button>
          );
        })}
      </div>
      {!showsSubgrades && (
        <p className="cd-caption" style={{ marginTop: 8 }}>
          Subgrades are only issued with a numeric grade.
        </p>
      )}

      {grade.status === 'not-gradable' && grade.notGradableReason && (
        <p className="cd-callout">{grade.notGradableReason}</p>
      )}
      {grade.status === 'incomplete-inspection' && grade.incompleteInspectionMessage && (
        <p className="cd-callout">{grade.incompleteInspectionMessage}</p>
      )}
      {grade.status === 'in-progress' && (
        <p className="cd-callout">
          This card is still being graded. The grade and subgrades appear here when the
          inspection finishes.
        </p>
      )}

      {/* Quoted from the saved findings. No summary, no line. */}
      {conditionSummary && (
        <p className="cd-note">
          {conditionSummary}{' '}
          <button type="button" className="dcm-button dcm-button--text" onClick={() => onJumpToGrade()}>
            See the evidence
          </button>
        </p>
      )}

      {detectedSlabGrade && (
        <div className="cd-callout">
          <p className="cd-eyebrow" style={{ marginBottom: 4 }}>
            Third-party grade detected
          </p>
          <p>
            <strong>
              {detectedSlabGrade.company}
              {detectedSlabGrade.grade ? ` ${detectedSlabGrade.grade}` : ''}
            </strong>
            {detectedSlabGrade.description ? ` (${detectedSlabGrade.description})` : ''}
            {detectedSlabGrade.certNumber ? ` · Cert #${detectedSlabGrade.certNumber}` : ''}
          </p>
          <p className="cd-caption" style={{ marginTop: 4 }}>
            Read off the holder. It is not the DCM grade above.
          </p>
        </div>
      )}
    </section>
  );
}

export default GradeSummary;
