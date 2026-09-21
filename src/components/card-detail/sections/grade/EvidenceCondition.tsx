'use client';

/**
 * Corners / edges / surface evidence.
 *
 * PORTED FROM `src/app/pokemon/[id]/CardDetailClient.tsx` 4814-5193
 * [sports 4721-5100, identical]:
 *
 *   4896-4939 / 5050-5093   corners: sub-score, the four named positions,
 *                           `SectionDefects`, and the DCM Optic summary
 *   4942-4985 / 5096-5139   edges: the same shape with top/bottom/left/right
 *   4988-5035 / 5142-5189   surface: sub-score, the analysis prose, the
 *                           per-defect cards (type, severity, location, size,
 *                           description and the magnified-evidence link), and
 *                           the summary
 *   4891-4893 / 5045-5047   `CornerZoomCrops` per face, told whether the card
 *                           was photographed in a holder
 *
 * A block with nothing in it renders nothing, which is legacy's effect — every
 * one of its fields is individually guarded, so an empty side collapsed to a
 * bordered box with one heading. Here the heading goes with it.
 */

import dynamic from 'next/dynamic';
import SectionDefects from '@/components/reports/SectionDefects';
import {
  isSlabbed,
  readConditionDetails,
  type CardSideKey,
  type CornersDetail,
  type EdgesDetail,
  type SurfaceDetail,
} from '@/lib/cardDetail/gradeDetails';

/** Below the fold and image-heavy: four canvas crops per face. */
const CornerZoomCrops = dynamic(
  () => import('@/components/grading/CornerZoomCrops').then((m) => m.CornerZoomCrops),
  { ssr: false, loading: () => <p className="cd-caption">Loading corner close-ups…</p> }
);

const SIDE_LABEL: Record<CardSideKey, string> = { front: 'Front', back: 'Back' };
const SIDE_ACCENT: Record<CardSideKey, 'blue' | 'purple'> = { front: 'blue', back: 'purple' };

function SideHeading({ side, score }: { side: CardSideKey; score?: number | string }) {
  return (
    <div className="cd-panel-heading">
      <h4>{SIDE_LABEL[side]}</h4>
      {score !== undefined && <span className="cd-face-score">{score}/10</span>}
    </div>
  );
}

function Summary({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p className="cd-finding-prose">
      <strong>DCM Optic&trade; analysis:</strong> {text}
    </p>
  );
}

function Findings({ entries }: { entries: Array<[string, string | undefined]> }) {
  const present = entries.filter(([, value]) => !!value);
  if (present.length === 0) return null;
  return (
    <dl className="cd-findings">
      {present.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function hasCornerContent(corners: CornersDetail): boolean {
  return !!(
    corners.top_left ||
    corners.top_right ||
    corners.bottom_left ||
    corners.bottom_right ||
    corners.summary ||
    corners.sub_score !== undefined ||
    (Array.isArray(corners.defects) && corners.defects.length > 0)
  );
}

function hasEdgeContent(edges: EdgesDetail): boolean {
  return !!(
    edges.top ||
    edges.bottom ||
    edges.left ||
    edges.right ||
    edges.summary ||
    edges.sub_score !== undefined ||
    (Array.isArray(edges.defects) && edges.defects.length > 0)
  );
}

function hasSurfaceContent(surface: SurfaceDetail): boolean {
  return !!(
    surface.analysis ||
    surface.summary ||
    surface.sub_score !== undefined ||
    (Array.isArray(surface.defects) && surface.defects.length > 0)
  );
}

export interface EvidenceConditionProps {
  card: any;
  frontUrl: string | null;
  backUrl: string | null;
}

/** Corners, both faces, with the magnified corner crops. */
export function EvidenceCorners({ card, frontUrl, backUrl }: EvidenceConditionProps) {
  const slabbed = isSlabbed(card);
  const urls: Record<CardSideKey, string | null> = { front: frontUrl, back: backUrl };

  return (
    <div className="cd-faces">
      {(['front', 'back'] as CardSideKey[]).map((side) => {
        const corners = readConditionDetails(card, side).corners;
        const url = urls[side];
        if (!hasCornerContent(corners) && !url) return null;
        return (
          <div className="cd-face" key={side}>
            <SideHeading side={side} score={corners.sub_score} />
            {url && <CornerZoomCrops imageUrl={url} side={side} slabDetected={slabbed} />}
            <Findings
              entries={[
                ['Top left', corners.top_left],
                ['Top right', corners.top_right],
                ['Bottom left', corners.bottom_left],
                ['Bottom right', corners.bottom_right],
              ]}
            />
            <SectionDefects defects={corners.defects} accent={SIDE_ACCENT[side]} />
            <Summary text={corners.summary} />
          </div>
        );
      })}
    </div>
  );
}

/** Edges, both faces. */
export function EvidenceEdges({ card }: { card: any }) {
  return (
    <div className="cd-faces">
      {(['front', 'back'] as CardSideKey[]).map((side) => {
        const edges = readConditionDetails(card, side).edges;
        if (!hasEdgeContent(edges)) return null;
        return (
          <div className="cd-face" key={side}>
            <SideHeading side={side} score={edges.sub_score} />
            <Findings
              entries={[
                ['Top', edges.top],
                ['Bottom', edges.bottom],
                ['Left', edges.left],
                ['Right', edges.right],
              ]}
            />
            <SectionDefects defects={edges.defects} accent={SIDE_ACCENT[side]} />
            <Summary text={edges.summary} />
          </div>
        );
      })}
    </div>
  );
}

/** One surface defect card: legacy 5006-5024 / 5160-5178. */
function SurfaceDefect({ defect }: { defect: any }) {
  return (
    <li className="cd-defect">
      <p className="cd-defect-title">
        {defect.type || 'Defect'} {defect.severity && `(${defect.severity})`}
      </p>
      {defect.location && (
        <p className="cd-caption">
          <strong>Location:</strong> {defect.location}
        </p>
      )}
      {defect.size && (
        <p className="cd-caption">
          <strong>Size:</strong> {defect.size}
        </p>
      )}
      {defect.description && <p className="cd-caption">{defect.description}</p>}
      {defect.evidence_url && (
        <a href={defect.evidence_url} target="_blank" rel="noreferrer">
          View magnified evidence photo
        </a>
      )}
    </li>
  );
}

/** Surface, both faces. */
export function EvidenceSurface({ card }: { card: any }) {
  return (
    <div className="cd-faces">
      {(['front', 'back'] as CardSideKey[]).map((side) => {
        const surface = readConditionDetails(card, side).surface;
        if (!hasSurfaceContent(surface)) return null;
        const defects = Array.isArray(surface.defects) ? surface.defects : [];
        return (
          <div className="cd-face" key={side}>
            <SideHeading side={side} score={surface.sub_score} />
            {surface.analysis && <p className="cd-finding-prose">{surface.analysis}</p>}
            {defects.length > 0 && (
              <>
                <p className="cd-eyebrow">Defects</p>
                <ul className="cd-defect-list">
                  {defects.map((defect: any, idx: number) => (
                    <SurfaceDefect key={idx} defect={defect} />
                  ))}
                </ul>
              </>
            )}
            <Summary text={surface.summary} />
          </div>
        );
      })}
    </div>
  );
}
