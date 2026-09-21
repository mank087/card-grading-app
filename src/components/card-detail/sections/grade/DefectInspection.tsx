'use client';

/**
 * The inspection photo column: both faces with their defect markers.
 *
 * PORTED FROM `src/app/pokemon/[id]/CardDetailClient.tsx` 4769-4812
 * [sports 4676-4719, identical], plus the defect extraction at 1885-1890.
 *
 * Legacy behaviour kept exactly:
 *   - One `showOverlays` flag drives BOTH faces, but only the front renders
 *     the toggle, and only when the front has defects. A back-only card
 *     therefore cannot turn its markers off. That is legacy's, not a
 *     simplification here — see the report.
 *   - The front legend renders whenever markers are on; the back legend only
 *     when it has defects AND markers are on.
 *   - Hovering a marker highlights the matching legend row, and the
 *     `hoveredDefect.side` check keeps the two faces from highlighting each
 *     other's rows.
 *
 * The images themselves are plain `<img>`, as legacy has them: these are
 * signed Supabase URLs with no known intrinsic size.
 */

import { useMemo, useState } from 'react';
import { DefectOverlay } from '@/components/grading/DefectOverlay';
import { DefectLegend } from '@/components/grading/DefectLegend';
import { extractOverlayDefects, type OverlayDefect } from '@/lib/defectOverlayData';

export interface DefectInspectionProps {
  card: any;
  frontUrl: string | null;
  backUrl: string | null;
  /** Opens the full-size image, same modal the hero uses. */
  onZoom?: (imageUrl: string, alt: string, title: string) => void;
}

export function DefectInspection({ card, frontUrl, backUrl, onZoom }: DefectInspectionProps) {
  const [showOverlays, setShowOverlays] = useState(true);
  const [hoveredDefect, setHoveredDefect] = useState<OverlayDefect | null>(null);

  const report = card?.conversational_grading ?? null;
  const frontDefects = useMemo(() => extractOverlayDefects(report, 'front'), [report]);
  const backDefects = useMemo(() => extractOverlayDefects(report, 'back'), [report]);

  return (
    <div className="cd-inspection">
      <p className="cd-eyebrow">Inspection photos</p>

      {frontUrl && (
        <figure className="cd-inspection-face">
          <figcaption className="cd-caption">Front</figcaption>
          <div className="cd-inspection-frame">
            <img src={frontUrl} alt="Card front, with defect markers" />
            <DefectOverlay
              defects={frontDefects}
              visible={showOverlays}
              onDefectHover={setHoveredDefect}
            />
          </div>
          {onZoom && (
            <button
              type="button"
              className="cd-quiet"
              onClick={() => onZoom(frontUrl, 'Card front', 'Front')}
            >
              Open the original image
            </button>
          )}
          {frontDefects.length > 0 && (
            <div>
              <button
                type="button"
                className="cd-quiet"
                aria-pressed={showOverlays}
                onClick={() => setShowOverlays((v) => !v)}
              >
                <span className="cd-status-dot" data-private={!showOverlays} aria-hidden="true" />
                {showOverlays ? 'Hide' : 'Show'} defect markers
              </button>
              {showOverlays && (
                <DefectLegend
                  defects={frontDefects}
                  activeDefectId={hoveredDefect?.side === 'front' ? hoveredDefect.id : null}
                  onDefectHover={setHoveredDefect}
                />
              )}
            </div>
          )}
        </figure>
      )}

      {backUrl && (
        <figure className="cd-inspection-face">
          <figcaption className="cd-caption">Back</figcaption>
          <div className="cd-inspection-frame">
            <img src={backUrl} alt="Card back, with defect markers" />
            <DefectOverlay
              defects={backDefects}
              visible={showOverlays}
              onDefectHover={setHoveredDefect}
            />
          </div>
          {onZoom && (
            <button
              type="button"
              className="cd-quiet"
              onClick={() => onZoom(backUrl, 'Card back', 'Back')}
            >
              Open the original image
            </button>
          )}
          {backDefects.length > 0 && showOverlays && (
            <DefectLegend
              defects={backDefects}
              activeDefectId={hoveredDefect?.side === 'back' ? hoveredDefect.id : null}
              onDefectHover={setHoveredDefect}
            />
          )}
        </figure>
      )}

      <p className="cd-caption">
        Image-based assessment. The original front and back photos stay available beside
        the findings.
      </p>
    </div>
  );
}

export default DefectInspection;
