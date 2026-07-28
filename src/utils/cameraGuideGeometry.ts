/**
 * Shared guide-frame geometry for the web camera.
 *
 * CameraGuideOverlay (what the user sees) and guideCrop (what actually gets
 * cropped) MUST derive the guide rectangle from this one module. They
 * previously used two independent calculations — overlay sized in viewport CSS
 * pixels, crop assuming a fixed 96% of the raw frame — so the white box on
 * screen and the cropped region did not coincide.
 */

/**
 * Overlay chrome the guide must clear. The guide was previously SIZED against
 * this chrome but CENTERED in the full viewport — with asymmetric chrome
 * (header ≈ 48px, bottom controls ≈ 130px with the tips row) that parked the
 * guide's bottom edge inside the control stack. Both the sizing and the
 * vertical offset now come from the same constants.
 */
// Top: 48px translucent header + ~40px band for the FRONT/BACK label that
// renders just above the guide (keeping it off the card AND out of the header).
export const GUIDE_CHROME_TOP = 88;
export const GUIDE_CHROME_BOTTOM = 130;

export interface GuideLayout {
  width: number;
  height: number;
  /**
   * Vertical offset (CSS px) to apply to the guide's center relative to the
   * VIEWPORT center, so the guide is centered in the available region between
   * the header and the bottom controls. Negative = shift up.
   */
  centerOffsetY: number;
}

/**
 * Compute the on-screen guide box for a given viewport. The guide is centered
 * horizontally; vertically it is centered within the available region
 * (viewport minus top/bottom chrome), expressed as centerOffsetY from the
 * viewport center because the overlay positions it with flex centering.
 */
export function computeGuideLayoutPx(
  viewportWidth: number,
  viewportHeight: number,
  orientation: 'portrait' | 'landscape'
): GuideLayout {
  // Card aspect ratio: 2.5" x 3.5" standard trading card
  const cardAspectRatio = orientation === 'portrait' ? 2.5 / 3.5 : 3.5 / 2.5;

  const horizontalPadding = 4;
  const availableWidth = viewportWidth - horizontalPadding;
  const availableHeight = viewportHeight - GUIDE_CHROME_TOP - GUIDE_CHROME_BOTTOM;

  // Center of the available region vs center of the viewport
  const centerOffsetY =
    GUIDE_CHROME_TOP + availableHeight / 2 - viewportHeight / 2;

  // Width-constrained: use 98% of available width
  const widthBasedWidth = availableWidth * 0.98;
  const widthBasedHeight = widthBasedWidth / cardAspectRatio;

  // Height-constrained: use 98% of available height
  const heightBasedHeight = availableHeight * 0.98;
  const heightBasedWidth = heightBasedHeight * cardAspectRatio;

  // Use whichever constraint allows the LARGER guide
  if (widthBasedHeight <= availableHeight) {
    return { width: widthBasedWidth, height: widthBasedHeight, centerOffsetY };
  }
  return { width: heightBasedWidth, height: heightBasedHeight, centerOffsetY };
}
