/**
 * Shared guide-frame geometry for the web camera.
 *
 * CameraGuideOverlay (what the user sees) and guideCrop (what actually gets
 * cropped) MUST derive the guide rectangle from this one function. They
 * previously used two independent calculations — overlay sized in viewport CSS
 * pixels, crop assuming a fixed 96% of the raw frame — so the white box on
 * screen and the cropped region did not coincide.
 */

export interface GuideSize {
  width: number;
  height: number;
}

/**
 * Compute the on-screen guide box size in CSS pixels for a given viewport.
 * The guide is centered in the full viewport (the overlay uses inset-0 +
 * flex centering), but its SIZE is fitted into the viewport minus the
 * header/controls chrome so it never sits underneath them.
 */
export function computeGuideSizePx(
  viewportWidth: number,
  viewportHeight: number,
  orientation: 'portrait' | 'landscape'
): GuideSize {
  // Card aspect ratio: 2.5" x 3.5" standard trading card
  const cardAspectRatio = orientation === 'portrait' ? 2.5 / 3.5 : 3.5 / 2.5;

  // Available space: full screen minus header (~48px) and bottom controls (~100px)
  const headerHeight = 48;
  const bottomControlsHeight = 100;
  const horizontalPadding = 4;

  const availableWidth = viewportWidth - horizontalPadding;
  const availableHeight = viewportHeight - headerHeight - bottomControlsHeight;

  // Width-constrained: use 98% of available width
  const widthBasedWidth = availableWidth * 0.98;
  const widthBasedHeight = widthBasedWidth / cardAspectRatio;

  // Height-constrained: use 98% of available height
  const heightBasedHeight = availableHeight * 0.98;
  const heightBasedWidth = heightBasedHeight * cardAspectRatio;

  // Use whichever constraint allows the LARGER guide
  if (widthBasedHeight <= availableHeight) {
    return { width: widthBasedWidth, height: widthBasedHeight };
  }
  return { width: heightBasedWidth, height: heightBasedHeight };
}
