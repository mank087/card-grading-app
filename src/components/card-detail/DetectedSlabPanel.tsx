'use client';

/**
 * "Professional Grade Detected" — the holder read off the photos.
 *
 * PORTED FROM `src/app/pokemon/[id]/CardDetailClient.tsx` 3689-3814
 * [sports 3596-3721, identical]: the professional grade beside the DCM grade,
 * the holder's own subgrades, the grade comparison, the extra holder metadata
 * and the closing note about which grade is the certified one.
 *
 * The gate is legacy's: `slab_detected && slab_company`. The hero's
 * `GradeSummary` shows a one-line version of the same fact; this is the full
 * panel, in the Card Information block where legacy puts it.
 */

import { formatGrade } from '@/lib/cardDetail/parsers';

export interface DetectedSlabPanelProps {
  card: any;
}

export function DetectedSlabPanel({ card }: DetectedSlabPanelProps) {
  if (!card?.slab_detected || !card?.slab_company) return null;

  const subgrades = card.slab_subgrades;
  const metadata = card.slab_metadata;
  const hasMetadata = metadata && Object.keys(metadata).length > 0;
  // Legacy prints the conversational whole grade here; V2 reads the same
  // column through the same formatter.
  const dcmGrade = formatGrade(card.conversational_decimal_grade);

  return (
    <section className="cd-panel">
      <div className="cd-panel-heading">
        <h3>Professional grade detected</h3>
        <span className="cd-tag">{card.slab_company}</span>
      </div>

      <dl className="cd-findings">
        <div>
          <dt>Professional grade</dt>
          <dd>
            <strong>{card.slab_grade}</strong> — {card.slab_company} certified
          </dd>
        </div>
        <div>
          <dt>DCM grade</dt>
          <dd>
            <strong>{dcmGrade}</strong> — independent verification, based on the visible card
            through the slab
          </dd>
        </div>
        {card.slab_cert_number && (
          <div>
            <dt>Cert #</dt>
            <dd>{card.slab_cert_number}</dd>
          </div>
        )}
        {card.slab_serial && (
          <div>
            <dt>Serial</dt>
            <dd>{card.slab_serial}</dd>
          </div>
        )}
      </dl>

      {subgrades && (
        <>
          <p className="cd-eyebrow">Professional subgrades</p>
          <dl className="cd-findings">
            {(['centering', 'corners', 'edges', 'surface'] as const).map((key) =>
              subgrades[key] !== undefined ? (
                <div key={key}>
                  <dt style={{ textTransform: 'capitalize' }}>{key}</dt>
                  <dd>{subgrades[key]}</dd>
                </div>
              ) : null
            )}
          </dl>
        </>
      )}

      {card.ai_vs_slab_comparison && (
        <>
          <p className="cd-eyebrow">Grade comparison</p>
          <p className="cd-finding-prose">{card.ai_vs_slab_comparison}</p>
        </>
      )}

      {hasMetadata && (
        <>
          <p className="cd-eyebrow">Additional information</p>
          <dl className="cd-findings">
            {metadata.grade_date && (
              <div>
                <dt>Grade date</dt>
                <dd>{metadata.grade_date}</dd>
              </div>
            )}
            {metadata.population && (
              <div>
                <dt>Population</dt>
                <dd>{metadata.population}</dd>
              </div>
            )}
            {metadata.label_type && (
              <div>
                <dt>Label type</dt>
                <dd>{metadata.label_type}</dd>
              </div>
            )}
            {metadata.label_color && (
              <div>
                <dt>Label colour</dt>
                <dd>{metadata.label_color}</dd>
              </div>
            )}
          </dl>
        </>
      )}

      <p className="cd-caption">
        <strong>Note:</strong> The professional grade from {card.slab_company} is the
        certified grade for this card. The DCM analysis grade is provided as independent
        verification and may differ due to limited visibility through the slab holder.
      </p>
    </section>
  );
}

export default DetectedSlabPanel;
