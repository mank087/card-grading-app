'use client';

/**
 * Centering evidence — the `tour-centering` block.
 *
 * PORTED FROM `src/app/pokemon/[id]/CardDetailClient.tsx` 4392-4763
 * [sports 4299-4670, identical]. What legacy shows and this shows:
 *
 *   4541-4548 / 4610-4617   the per-face centering score
 *   4560-4599 / 4629-4668   L/R and T/B ratios, the quality tier with its
 *                           icon, and the DCM Optic prose, all through
 *                           `@/lib/centeringDisplay` exactly as legacy does
 *   4678-4708               card orientation, aspect ratio, primary and worst
 *                           axis
 *   4710-4760               the "How Centering Was Measured" disclosure:
 *                           front/back measurement analysis, the features the
 *                           grader used, and its closing note
 *
 * DROPPED, and only these: the two card images (4550-4557, 4619-4626) and the
 * unused `CenteringDial` SVG (4455-4522). The images now live once in the
 * inspection column instead of a second time here; the dial is declared inside
 * the legacy IIFE and never rendered, so it is dead code, not content.
 */

import {
  centeringQuality,
  centeringTierIcon,
  displayCenteringRatio,
} from '@/lib/centeringDisplay';
import {
  readCentering,
  readDvgGrading,
  readFaceCentering,
  type CardSideKey,
} from '@/lib/cardDetail/gradeDetails';
import { safeToFixed } from '@/lib/cardDetail/parsers';

export interface EvidenceCenteringProps {
  card: any;
}

function FaceCentering({ card, side }: { card: any; side: CardSideKey }) {
  const face = readFaceCentering(card, side);
  const quality = centeringQuality(face.lrText, face.tbText, face.qualityTier ?? undefined);

  return (
    <div className="cd-face">
      <div className="cd-panel-heading">
        <h4>{side === 'front' ? 'Front' : 'Back'}</h4>
        {face.score !== null && <span className="cd-face-score">{face.score}/10</span>}
      </div>
      <dl className="cd-ratios">
        <div>
          <dt>Horizontal (L/R)</dt>
          <dd>{displayCenteringRatio(face.lrText)}</dd>
        </div>
        <div>
          <dt>Vertical (T/B)</dt>
          <dd>{displayCenteringRatio(face.tbText)}</dd>
        </div>
        <div>
          <dt>Quality</dt>
          <dd>
            <span aria-hidden="true">{centeringTierIcon(quality.text)} </span>
            {quality.text}
          </dd>
        </div>
      </dl>
      {face.analysis && <p className="cd-finding-prose">{face.analysis}</p>}
    </div>
  );
}

export function EvidenceCentering({ card }: EvidenceCenteringProps) {
  const centering = readCentering(card);
  const dvg = readDvgGrading(card);
  const orientation = dvg.card_orientation;
  const hasMeasurementDisclosure = !!(
    centering.front_centering_analysis || centering.back_centering_analysis
  );
  const features: string[] = Array.isArray(centering.measurement_features)
    ? centering.measurement_features
    : [];

  return (
    <>
      <div className="cd-faces">
        <FaceCentering card={card} side="front" />
        <FaceCentering card={card} side="back" />
      </div>

      {orientation && (
        <div className="cd-callout">
          <p>
            <strong>Card orientation:</strong>{' '}
            {String(orientation.detected_orientation ?? '').toUpperCase()}
          </p>
          <p className="cd-caption">
            Aspect ratio: {safeToFixed(orientation.aspect_ratio, 2)}
            {orientation.detected_orientation === 'landscape' && ' (horizontal)'}
            {orientation.detected_orientation === 'portrait' && ' (vertical)'}
          </p>
          {centering.primary_axis && (
            <p className="cd-caption">
              <strong>Primary axis:</strong>{' '}
              {centering.primary_axis === 'horizontal' ? 'Left/Right' : 'Top/Bottom'}
            </p>
          )}
          {centering.worst_axis && centering.worst_ratio_value && (
            <p className="cd-caption">
              <strong>Worst:</strong> {centering.worst_axis === 'left_right' ? 'L/R' : 'T/B'} (
              {centering.worst_ratio_value})
            </p>
          )}
        </div>
      )}

      {hasMeasurementDisclosure && (
        <details className="cd-expander">
          <summary>How centering was measured</summary>
          <div className="cd-expander-body">
            {centering.front_centering_analysis && (
              <div>
                <p className="cd-eyebrow">Front analysis</p>
                <p className="cd-finding-prose">{centering.front_centering_analysis}</p>
              </div>
            )}
            {centering.back_centering_analysis && (
              <div>
                <p className="cd-eyebrow">Back analysis</p>
                <p className="cd-finding-prose">{centering.back_centering_analysis}</p>
              </div>
            )}
            {features.length > 0 && (
              <div>
                <p className="cd-eyebrow">Features used</p>
                <ul className="cd-chip-list">
                  {features.map((feature, idx) => (
                    <li key={`${feature}-${idx}`}>{feature}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="cd-caption">
              This analysis explains the specific visual elements and measurements used to
              determine centering ratios.
            </p>
          </div>
        </details>
      )}
    </>
  );
}

export default EvidenceCentering;
