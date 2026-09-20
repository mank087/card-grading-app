const GUIDE_MAX_W_FRACTION = 0.88
const GUIDE_MAX_H_FRACTION = 0.78
const GUIDE_FALLBACK_FRACTION = 0.7

export function computeGuideWidthFraction(
  containerW: number,
  containerH: number,
  orientation: 'portrait' | 'landscape' = 'portrait',
): number {
  if (!(containerW > 0) || !(containerH > 0)) return GUIDE_FALLBACK_FRACTION

  const cardAspect = orientation === 'portrait' ? 2.5 / 3.5 : 3.5 / 2.5
  const maxW = containerW * GUIDE_MAX_W_FRACTION
  const widthIfHeightBound = containerH * GUIDE_MAX_H_FRACTION * cardAspect

  const guideW = Math.min(maxW, widthIfHeightBound)
  const fraction = guideW / containerW

  // Clamp so an unexpected layout measurement can never produce a guide that
  // pushes the padded crop outside the frame.
  return Math.min(GUIDE_MAX_W_FRACTION, fraction)
}

