'use client';

/**
 * Estimated mail-away grades — the body of the `tour-pro-estimates` block.
 *
 * PORTED FROM `src/app/pokemon/[id]/CardDetailClient.tsx` 5619-5797
 * [sports 5526-5704, identical]. The source is `card.estimated_professional_grades`,
 * a separate column written by the two-stage system (2539) — nothing here
 * recomputes anything.
 *
 * Legacy's two legacy-data fallbacks are kept: SGC falls back to a TAG
 * estimate and CGC to a CSG one, each with the "regrade to get the current
 * one" note (5736-5740, 5777-5781). PSA and BGS have no fallback and are
 * rendered unconditionally once the column exists, so a column missing either
 * of them prints an empty card — legacy does the same.
 *
 * The whole block renders nothing when the column is null, exactly as legacy
 * (5625): the section heading stays, and the caller shows its own empty note.
 */

export interface ProEstimate {
  estimated_grade?: string | number;
  numeric_score?: string | number;
  confidence?: string;
  notes?: string;
}

export interface ProEstimates {
  PSA?: ProEstimate;
  BGS?: ProEstimate;
  SGC?: ProEstimate;
  TAG?: ProEstimate;
  CGC?: ProEstimate;
  CSG?: ProEstimate;
}

function EstimateCard({
  company,
  fullName,
  estimate,
  legacyNote,
}: {
  company: string;
  fullName: string;
  estimate: ProEstimate | undefined;
  legacyNote?: string;
}) {
  if (!estimate) return null;
  const confidence = estimate.confidence ? estimate.confidence.toUpperCase() : null;
  return (
    <article className="cd-estimate">
      <div className="cd-panel-heading">
        <h4>{company}</h4>
        {confidence && (
          <span className="cd-score-badge" data-confidence={estimate.confidence}>
            {confidence}
          </span>
        )}
      </div>
      <p className="cd-caption">{fullName}</p>
      <p className="cd-estimate-grade">{estimate.estimated_grade}</p>
      <p className="cd-caption">Numeric: {estimate.numeric_score}</p>
      {estimate.notes && <p className="cd-caption">{estimate.notes}</p>}
      {legacyNote && <p className="cd-caption">{legacyNote}</p>}
    </article>
  );
}

export function ProEstimatesPanel({ estimates }: { estimates: ProEstimates | null | undefined }) {
  if (!estimates) {
    return (
      <p className="cd-caption">
        No mail-away estimates were produced for this card.
      </p>
    );
  }

  const sgc = estimates.SGC || estimates.TAG;
  const cgc = estimates.CGC || estimates.CSG;

  return (
    <>
      <p className="cd-caption">
        Estimated grades from major grading companies based on measured DCM metrics. These
        are projections only and not official grades.
      </p>
      <div className="cd-estimate-grid">
        <EstimateCard
          company="PSA"
          fullName="Professional Sports Authenticator"
          estimate={estimates.PSA}
        />
        <EstimateCard company="BGS" fullName="Beckett Grading Services" estimate={estimates.BGS} />
        <EstimateCard
          company="SGC"
          fullName="Sportscard Guaranty"
          estimate={sgc}
          legacyNote={
            !estimates.SGC && estimates.TAG
              ? 'Showing a TAG estimate (legacy) — re-grade to get an SGC estimate.'
              : undefined
          }
        />
        <EstimateCard
          company="CGC"
          fullName="Certified Guaranty Company"
          estimate={cgc}
          legacyNote={
            !estimates.CGC && estimates.CSG
              ? 'Showing a CSG estimate (legacy) — re-grade to get a CGC estimate.'
              : undefined
          }
        />
      </div>
      <p className="cd-caption">
        <strong>Disclaimer:</strong> These are estimates based on visual analysis and
        published grading standards. Actual professional grades may vary. Only official
        grading by these companies provides authentic certification.
      </p>
    </>
  );
}

export default ProEstimatesPanel;
