/**
 * One short result line per hero subgrade tile, for phones (Sept 23 mobile
 * review, S2 — "Why this grade" folded into the hero's tiles).
 *
 * EVERY LINE IS GROUNDED IN STORED DATA. Nothing here writes grading prose:
 *
 *  - corners / edges / surface COUNT the saved defects on both faces, read
 *    through `readConditionDetails` (the same reader Grade details uses).
 *      · one or more defects       → "2 findings" / "1 finding";
 *      · none, but the category has condition data on at least one face (a
 *        sub-score or a summary was saved) → "No corner defects detected";
 *      · no condition data at all  → null. Missing data is never reported as
 *        "no defects".
 *  - centering reuses the Phase 1 `centeringFaceLine` for the FRONT, which
 *    already handles an unmeasurable face and a full-art face with no border.
 *    Ratios are never re-derived here. A card with no centering data at all,
 *    or a front with nothing stored, gets no line.
 */

import {
  hasCenteringData,
  readConditionDetails,
  readFaceCentering,
} from './gradeDetails';
import { centeringFaceLine } from './centeringLine';

export type SubgradeKey = 'centering' | 'corners' | 'edges' | 'surface';

const NOUN: Record<Exclude<SubgradeKey, 'centering'>, string> = {
  corners: 'corner',
  edges: 'edge',
  surface: 'surface',
};

function present(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}

export function subgradeResultLine(card: any, key: SubgradeKey): string | null {
  if (key === 'centering') {
    if (!hasCenteringData(card)) return null;
    const front = readFaceCentering(card, 'front');
    // Nothing stored for the front face: say nothing rather than
    // "not measurable", which would claim a measurement was attempted.
    if (front.lrText === null && front.tbText === null && !front.qualityTier) return null;
    return centeringFaceLine('Front', front);
  }

  const faces = [readConditionDetails(card, 'front')[key], readConditionDetails(card, 'back')[key]];
  const count = faces.reduce(
    (n, face) => n + (Array.isArray(face.defects) ? face.defects.length : 0),
    0,
  );
  if (count > 0) return `${count} finding${count === 1 ? '' : 's'}`;

  const hasData = faces.some((face) => present(face.sub_score) || present(face.summary));
  return hasData ? `No ${NOUN[key]} defects detected` : null;
}

export default subgradeResultLine;
