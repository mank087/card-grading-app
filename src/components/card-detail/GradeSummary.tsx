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

import GradeChip from './GradeChip';
import ConfidenceChip from './ConfidenceChip';
import type { CardDetailViewModel, GradeStatus } from '@/lib/cardDetail/viewModel';
import { subgradeResultLine } from '@/lib/cardDetail/subgradeResultLine';

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
  /**
   * PHONES ONLY (Sept 23 mobile review, S2). The Overview's "Why this grade"
   * block is hidden below 760px, so its content folds in here: each tile gains
   * one stored-data result line (`subgradeResultLine`) and a "View evidence"
   * affordance, the limiting subgrade is highlighted, and the confidence score
   * chip moves up into this panel. Absent or false — every desktop render —
   * the panel is exactly what it was.
   */
  phoneDetail?: boolean;
  /** The raw row, read by the result lines and the chip. Needed with `phoneDetail`. */
  card?: any;
}

/**
 * Each subgrade jumps to its own evidence block in the grade section. The
 * anchor ids are `EVIDENCE_TABS` in `sections/GradeDetailsSection`; centering
 * keeps the legacy `tour-centering` id, the other three are V2-native and are
 * registered in `anchorMap.ts` so a hash naming one still resolves.
 */
const SUBGRADE_ORDER = [
  { key: 'centering', label: 'Centering', anchor: 'tour-centering' },
  { key: 'corners', label: 'Corners', anchor: 'cd-evidence-corners' },
  { key: 'edges', label: 'Edges', anchor: 'cd-evidence-edges' },
  { key: 'surface', label: 'Surface', anchor: 'cd-evidence-surface' },
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
      return 'Please retake your photos';
    case 'ungraded':
      return 'Not yet graded';
  }
}

export function GradeSummary({
  vm,
  conditionSummary,
  onJumpToGrade,
  phoneDetail = false,
  card,
}: GradeSummaryProps) {
  const { grade, detectedSlabGrade } = vm;
  const showsSubgrades = grade.status === 'graded' || grade.status === 'altered-authentic';
  // The folded-in "Why this grade" detail, for a graded card on a phone only.
  const detail = phoneDetail && showsSubgrades && card != null;
  // Free text from the report ("Corners", "front edges"), matched by inclusion
  // exactly as GradeHighlights does.
  const limiting = detail ? grade.limitingFactor?.toLowerCase() ?? '' : '';

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
        {grade.status === 'graded' || grade.status === 'altered-authentic' ? (
          <GradeChip
            gradeFormatted={grade.gradeFormatted}
            grade={grade.grade}
            condition={grade.condition}
          />
        ) : (
          <div className="cd-grade-number" data-status={grade.status}>
            {grade.gradeFormatted}
          </div>
        )}
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>
            {/* The chip already carries the condition label; say the scale instead. */}
            {grade.status === 'graded' && grade.grade !== null
              ? `Grade ${grade.gradeFormatted} of 10`
              : statusHeadline(grade.status, grade.condition)}
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

      {detail && (
        <div className="cd-grade-confidence">
          <ConfidenceChip card={card} onOpen={() => onJumpToGrade('tour-optic-score')} />
        </div>
      )}

      {/* The tour highlights this block whether or not it has numbers in it. */}
      <div id="tour-subgrades" className="cd-subgrades">
        {SUBGRADE_ORDER.map(({ key, label, anchor }) => {
          const value = vm.grade.subgrades[key];
          const scoreText = value === null ? 'not scored' : value;
          if (!detail) {
            return (
              <button
                key={key}
                type="button"
                className="cd-subgrade"
                onClick={() => onJumpToGrade(anchor)}
                aria-label={`${label}: ${scoreText}. Open the grade details.`}
              >
                <span className="cd-subgrade-label">{label}</span>
                {/* null is "never scored", not zero. */}
                <b>{value === null ? '—' : value}</b>
              </button>
            );
          }
          // Phone form: one stored-data line, the limiting flag, and the
          // affordance. The tile was already the jump to its evidence.
          const line = subgradeResultLine(card, key);
          const isLimiting = limiting.includes(key);
          return (
            <button
              key={key}
              type="button"
              className={`cd-subgrade cd-subgrade--detail${isLimiting ? ' is-limiting' : ''}`}
              onClick={() => onJumpToGrade(anchor)}
              aria-label={
                `${label}: ${scoreText}.` +
                (isLimiting ? ' Limiting factor.' : '') +
                (line ? ` ${line}.` : '') +
                ' View evidence.'
              }
            >
              <span className="cd-subgrade-label">{label}</span>
              <b>{value === null ? '—' : value}</b>
              {line && <span className="cd-subgrade-result">{line}</span>}
              {isLimiting && <span className="cd-subgrade-flag">Limiting factor</span>}
              <span className="cd-subgrade-more" aria-hidden="true">
                View evidence &rarr;
              </span>
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
