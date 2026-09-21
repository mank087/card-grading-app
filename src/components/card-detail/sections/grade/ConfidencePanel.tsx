'use client';

/**
 * DCM Optic&trade; confidence — the `tour-optic-score` block.
 *
 * PORTED FROM `src/app/pokemon/[id]/CardDetailClient.tsx` 5196-5444
 * [sports 5103-5351, identical]:
 *
 *   5257-5271   the confidence bar, its level, and the grade uncertainty
 *   5273-5286   the image-quality grade callout
 *   5288-5312   the "new photos recommended" block for a C or D letter
 *   5314-5354   the JSON-mode professional slab detection
 *   5356-5416   protective case detection
 *   5418-5435   the raw-card notice
 *   5437-5440   the closing note about what confidence is based on
 *
 * ALSO RELOCATED HERE from the legacy hero (3295-3339), because it is the same
 * subject and V2's hero is the grade, not the photography:
 *   3297-3315   the uncertainty and confidence-letter badges
 *   3318-3334   the retake CTA shown for a C or D letter
 *   3335-3339   the `dvg_reshoot_required` notice
 */

import Link from 'next/link';
import {
  confidenceLevelFor,
  imageQualityInfoFor,
  readCaseDetection,
  readImageGrade,
  readSlabDetection,
} from '@/lib/cardDetail/gradeDetails';
import { getUncertaintyFromConfidence } from '@/lib/cardDetail/parsers';

export interface ConfidencePanelProps {
  card: any;
  /** The category's upload route — legacy's "Upload New Photos" target. */
  uploadHref: string;
  /** The category's retake route. Legacy uses `/upload?category=Pokemon`. */
  retakeHref: string;
}

export function ConfidencePanel({ card, uploadHref, retakeHref }: ConfidencePanelProps) {
  const imageGrade = readImageGrade(card);
  const confidence = confidenceLevelFor(imageGrade);
  const gradeInfo = imageQualityInfoFor(imageGrade);
  const slab = readSlabDetection(card);
  const caseDetection = readCaseDetection(card);
  const caseType = caseDetection?.case_type || 'none';
  const caseVisible = !!caseDetection && caseType !== 'none';
  const letter = card?.conversational_image_confidence;

  return (
    <>
      <div
        className="cd-meter"
        role="img"
        aria-label={`Confidence level: ${confidence.level}`}
        data-tone={confidence.tone}
      >
        <span className="cd-meter-fill" style={{ width: confidence.width }}>
          {confidence.level}
        </span>
      </div>
      <div className="cd-meter-legend">
        <span>Confidence level: {confidence.level}</span>
        <span>
          Grade uncertainty:{' '}
          {getUncertaintyFromConfidence(imageGrade, card?.conversational_whole_grade)}
        </span>
      </div>

      {/* The two badges the legacy hero prints beside the grade. */}
      <p className="cd-caption">
        Confidence score: {letter || imageGrade}
      </p>

      <div className="cd-callout" data-tone={confidence.tone}>
        <p>
          <span aria-hidden="true">{gradeInfo.icon} </span>
          <strong>{gradeInfo.name}</strong>
        </p>
        <p className="cd-caption">{gradeInfo.description}</p>
      </div>

      {gradeInfo.recommendNewPhotos && (
        <div className="cd-callout">
          <p>
            <span aria-hidden="true">📷 </span>
            <strong>New photos recommended</strong>
          </p>
          <p className="cd-caption">
            The image quality affects grading accuracy. For the most reliable results,
            consider uploading clearer photos with better lighting and no obstructions.
          </p>
          <Link className="cd-quiet" href={uploadHref}>
            Upload new photos
          </Link>
        </div>
      )}

      {(letter === 'C' || letter === 'D') && (
        <div className="cd-callout">
          <p>
            <strong>
              Image quality limited this grade — retake your photos for a more accurate
              result
            </strong>
          </p>
          <Link className="cd-quiet" href={retakeHref}>
            Retake photos
          </Link>
        </div>
      )}

      {card?.dvg_reshoot_required && (
        <p className="cd-callout">
          <strong>Reshoot recommended</strong>
        </p>
      )}

      {slab && (
        <div className="cd-callout">
          <p>
            <strong>
              Professional slab detected: {slab.company?.toUpperCase() || 'Unknown Company'}
            </strong>
          </p>
          <dl className="cd-findings">
            {slab.grade && (
              <div>
                <dt>Slab grade</dt>
                <dd>
                  {slab.grade}
                  {slab.grade_description ? ` — ${slab.grade_description}` : ''}
                </dd>
              </div>
            )}
            {slab.cert_number && (
              <div>
                <dt>Cert number</dt>
                <dd>{slab.cert_number}</dd>
              </div>
            )}
            {slab.subgrades && (
              <div>
                <dt>Sub-grades</dt>
                <dd>{JSON.stringify(slab.subgrades.raw)}</dd>
              </div>
            )}
          </dl>
          <p className="cd-caption">
            Note: DCM provides independent analysis. The slab grade shown is for reference
            only.
          </p>
        </div>
      )}

      {caseDetection && (
        <div className="cd-callout">
          <p>
            <strong>
              {caseVisible
                ? `Protective case detected: ${String(caseType).replace(/_/g, ' ').toUpperCase()}`
                : 'Protective case detection'}
            </strong>
          </p>
          <dl className="cd-findings">
            <div>
              <dt>Case type</dt>
              <dd>{caseType === 'none' ? 'No case' : String(caseType).replace(/_/g, ' ')}</dd>
            </div>
            {caseDetection.case_visibility && (
              <div>
                <dt>Visibility</dt>
                <dd>{caseDetection.case_visibility}</dd>
              </div>
            )}
            {caseDetection.impact_level && (
              <div>
                <dt>Impact level</dt>
                <dd>{caseDetection.impact_level}</dd>
              </div>
            )}
            {caseDetection.adjusted_uncertainty && (
              <div>
                <dt>Uncertainty adjustment</dt>
                <dd>{caseDetection.adjusted_uncertainty}</dd>
              </div>
            )}
          </dl>
          {caseDetection.notes && <p className="cd-caption">{caseDetection.notes}</p>}
          {caseVisible && (
            <p className="cd-caption">
              Note: protective cases may limit visibility of minor defects and can increase
              grade uncertainty.
            </p>
          )}
        </div>
      )}

      {caseDetection && caseType === 'none' && (
        <div className="cd-callout">
          <p>
            <strong>Raw card — no protective case</strong>
          </p>
          <p className="cd-caption">
            Card photographed without protective covering. All features and defects fully
            visible for optimal assessment accuracy.
          </p>
        </div>
      )}

      <p className="cd-caption">
        Confidence based on image clarity, protective case impact, defect detection
        certainty, and grade uncertainty.
      </p>
    </>
  );
}

export default ConfidencePanel;
