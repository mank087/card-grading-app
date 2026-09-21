'use client';

/**
 * The DCM Optic&trade; version and graded date.
 *
 * PORTED FROM `src/app/pokemon/[id]/CardDetailClient.tsx` 6906-6916
 * [sports 6613-6623, identical]. Legacy prints these centred under the report;
 * V2 keeps them with the grade findings, which is the only place they mean
 * anything. Its own file so that importing it does not pull the full report
 * out of its dynamic chunk.
 */

import { formatGradedDate, getDCMOpticVersion } from '@/lib/cardDetail/parsers';

export function ReportProvenance({ card }: { card: any }) {
  const version = getDCMOpticVersion(card?.conversational_grading);
  return (
    <p className="cd-caption">
      {version && (
        <>
          DCM Optic&trade; version: <strong>{version}</strong>
          {' · '}
        </>
      )}
      Graded date: <strong>{formatGradedDate(card?.created_at)}</strong>
    </p>
  );
}

export default ReportProvenance;
