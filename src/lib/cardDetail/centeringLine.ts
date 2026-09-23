/**
 * One face's centering as a short line, for the Overview grade tiles.
 *
 * This is where the page printed "NaN/NaN" (review, Sept 23). It now goes
 * through `displayCenteringRatio`, the same helper the Grade details panel
 * uses, so an unmeasured axis is an em dash. A face with no measurement at all
 * says why: R0 marks a full-art face "Centered" because there is no border.
 */

import { displayCenteringRatio } from '@/lib/centeringDisplay';
import { R0_QUALITY_TIER } from '@/lib/grading/centeringPolicy';
import type { FaceCentering } from './gradeDetails';

export function centeringFaceLine(
  label: string,
  face: Pick<FaceCentering, 'lrText' | 'tbText' | 'measurable' | 'qualityTier'>,
): string {
  if (!face.measurable) {
    return face.qualityTier === R0_QUALITY_TIER
      ? `${label}: no border to measure`
      : `${label}: not measurable`;
  }
  return `${label} ${displayCenteringRatio(face.lrText)} · ${displayCenteringRatio(face.tbText)}`;
}
