'use client';

/**
 * Grade highlights — the lead block of the Overview section.
 *
 * The hero says WHAT the grade is; this says WHY, without making the visitor
 * open the Grade details tab first. One card per subgrade: the score, the
 * front/back split, and the grader's own one-line finding for that category.
 * Every word comes from the saved assessment through the same readers the
 * Grade details tab uses (src/lib/cardDetail/gradeDetails.ts) — nothing is
 * written or inferred here, and a category with no saved finding simply shows
 * its score. Each card opens its full evidence.
 */

import type { CardDetailViewModel } from '@/lib/cardDetail/viewModel';
import {
  confidenceLevelFor,
  readConditionDetails,
  readFaceCentering,
  readImageGrade,
  hasCenteringData,
} from '@/lib/cardDetail/gradeDetails';
import { centeringFaceLine } from '@/lib/cardDetail/centeringLine';
import GradeChip from './GradeChip';
import { getUncertaintyFromConfidence } from '@/lib/cardDetail/parsers';

export interface GradeHighlightsProps {
  vm: CardDetailViewModel;
  card: any;
  /** The saved "why this grade" sentence, when the report has one. */
  conditionSummary: string | null;
  onJumpToGrade: (anchorId?: string) => void;
}

type ConditionKey = 'corners' | 'edges' | 'surface';

const CONDITION_CARDS: { key: ConditionKey; label: string; anchor: string }[] = [
  { key: 'corners', label: 'Corners', anchor: 'cd-evidence-corners' },
  { key: 'edges', label: 'Edges', anchor: 'cd-evidence-edges' },
  { key: 'surface', label: 'Surface', anchor: 'cd-evidence-surface' },
];

function scoreText(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return typeof num === 'number' && !isNaN(num) ? Math.round(num).toString() : '—';
}

/**
 * The saved finding, markdown stripped. It is shown whole and clamped by CSS
 * rather than cut to its first sentence: graders tend to open with what they
 * examined and only then say what they found.
 */
function findingText(text: string | null | undefined): string | null {
  if (!text || typeof text !== 'string') return null;
  const clean = text.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  return clean || null;
}

export function GradeHighlights({ vm, card, conditionSummary, onJumpToGrade }: GradeHighlightsProps) {
  // Only a graded card has category findings worth leading with; the hero
  // already explains every other status.
  if (vm.grade.status !== 'graded' && vm.grade.status !== 'altered-authentic') return null;

  const front = readConditionDetails(card, 'front');
  const back = readConditionDetails(card, 'back');
  const frontCentering = readFaceCentering(card, 'front');
  const backCentering = readFaceCentering(card, 'back');
  const showCenteringRatios = hasCenteringData(card);
  const confidenceScore = readImageGrade(card);
  const confidence = confidenceLevelFor(confidenceScore);
  const uncertainty = getUncertaintyFromConfidence(confidenceScore, card?.conversational_whole_grade);
  // Free text from the report ("Corners", "front edges"), so match by inclusion.
  const limiting = vm.grade.limitingFactor?.toLowerCase() ?? '';

  return (
    <section className="cd-panel cd-highlights" aria-labelledby="cd-highlights-heading">
      <div className="cd-highlights-head">
        <div className="cd-highlights-title">
          <GradeChip
            gradeFormatted={vm.grade.gradeFormatted}
            grade={vm.grade.grade}
            condition={vm.grade.condition}
            size="compact"
          />
          <div>
            <p className="cd-eyebrow">Why this grade</p>
            <h3 id="cd-highlights-heading">The findings behind each subgrade</h3>
          </div>
        </div>
        {/* The score itself (the A-D letter legacy prints beside the grade) and
            the grade uncertainty that follows from it. Opens the explanation. */}
        <button
          type="button"
          className={`cd-confidence-chip cd-tone-${confidence.tone}`}
          onClick={() => onJumpToGrade('tour-optic-score')}
          aria-label={`DCM Optic confidence score ${confidenceScore}, grade uncertainty ${uncertainty}. Open the explanation.`}
        >
          <span className="cd-confidence-label">Confidence score</span>
          <strong>{confidenceScore}</strong>
          <span className="cd-confidence-uncertainty">{uncertainty}</span>
        </button>
      </div>

      {conditionSummary && <p className="cd-highlights-summary">{conditionSummary}</p>}

      <div className="cd-highlights-grid">
        <button
          type="button"
          className={`cd-highlight-card${limiting.includes('centering') ? ' is-limiting' : ''}`}
          onClick={() => onJumpToGrade('tour-centering')}
        >
          <span className="cd-highlight-top">
            <span className="cd-highlight-label">Centering</span>
            <strong>{scoreText(vm.grade.subgrades.centering)}</strong>
          </span>
          {showCenteringRatios && (
            <span className="cd-highlight-split">
              {centeringFaceLine('Front', frontCentering)}
              <br />
              {centeringFaceLine('Back', backCentering)}
            </span>
          )}
          {findingText(frontCentering.analysis) && (
            <span className="cd-highlight-finding">{findingText(frontCentering.analysis)}</span>
          )}
          {limiting.includes('centering') && <span className="cd-highlight-flag">Limiting factor</span>}
          <span className="cd-highlight-more">See evidence →</span>
        </button>

        {CONDITION_CARDS.map(({ key, label, anchor }) => {
          const f = front[key];
          const b = back[key];
          const finding = findingText(f.summary) ?? findingText(b.summary);
          const hasSplit = (f.sub_score ?? '') !== '' || (b.sub_score ?? '') !== '';
          const defectCount = (f.defects?.length ?? 0) + (b.defects?.length ?? 0);
          const isLimiting = limiting.includes(key);
          return (
            <button
              key={key}
              type="button"
              className={`cd-highlight-card${isLimiting ? ' is-limiting' : ''}`}
              onClick={() => onJumpToGrade(anchor)}
            >
              <span className="cd-highlight-top">
                <span className="cd-highlight-label">{label}</span>
                <strong>{scoreText(vm.grade.subgrades[key])}</strong>
              </span>
              {hasSplit && (
                <span className="cd-highlight-split">
                  Front {scoreText(f.sub_score)} · Back {scoreText(b.sub_score)}
                  {defectCount > 0 && ` · ${defectCount} finding${defectCount === 1 ? '' : 's'}`}
                </span>
              )}
              {finding && <span className="cd-highlight-finding">{finding}</span>}
              {isLimiting && <span className="cd-highlight-flag">Limiting factor</span>}
              <span className="cd-highlight-more">See evidence →</span>
            </button>
          );
        })}
      </div>

      <div className="dcm-actions" style={{ marginTop: 18 }}>
        <button type="button" className="dcm-button dcm-button--secondary" onClick={() => onJumpToGrade()}>
          Open the full grade details
        </button>
      </div>
    </section>
  );
}

export default GradeHighlights;
