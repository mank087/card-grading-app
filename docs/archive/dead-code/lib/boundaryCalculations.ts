// Legacy interfaces - preserved for API compatibility but no longer actively used
// These may be removed in future versions as we move to fully automated detection

export interface CornerPoint {
  x: number;
  y: number;
}

export interface CardBoundaries {
  corners: [CornerPoint, CornerPoint, CornerPoint, CornerPoint]; // top-left, top-right, bottom-right, bottom-left
  imageWidth: number;
  imageHeight: number;
  timestamp: string;
}

export interface CenteringMeasurements {
  measurements: {
    left_border: number;
    right_border: number;
    top_border: number;
    bottom_border: number;
  };
  ratio: string;
  score: number;
  geometric_center: { x: number; y: number };
  content_center: { x: number; y: number };
  normalized_dimensions: { width: number; height: number };
  border_measurements: {
    left_border: string;
    right_border: string;
    top_border: string;
    bottom_border: string;
  };
  centering_ratios: {
    horizontal: string;
    vertical: string;
  };
  centering_score: number;
  detection_confidence: string;
  success: boolean;
}

/**
 * @deprecated Calculate centering measurements from user-defined card boundaries
 * This function is preserved for API compatibility but is no longer used.
 * The system now uses enhanced OpenCV + AI collaboration for automatic detection.
 */
export function calculateCenteringFromBoundaries(
  boundaries: CardBoundaries
): CenteringMeasurements {
  const { corners, imageWidth, imageHeight } = boundaries;
  const [topLeft, topRight, bottomRight, bottomLeft] = corners;

  // Calculate card dimensions from corner points
  const cardWidth = Math.sqrt(
    Math.pow(topRight.x - topLeft.x, 2) + Math.pow(topRight.y - topLeft.y, 2)
  );
  const cardHeight = Math.sqrt(
    Math.pow(bottomLeft.x - topLeft.x, 2) + Math.pow(bottomLeft.y - topLeft.y, 2)
  );

  // Calculate card edge midpoints for more accurate measurements
  const leftEdgeX = (topLeft.x + bottomLeft.x) / 2;
  const rightEdgeX = (topRight.x + bottomRight.x) / 2;
  const topEdgeY = (topLeft.y + topRight.y) / 2;
  const bottomEdgeY = (bottomLeft.y + bottomRight.y) / 2;

  // Calculate the ideal center point (perfect centering)
  const idealCenterX = (leftEdgeX + rightEdgeX) / 2;
  const idealCenterY = (topEdgeY + bottomEdgeY) / 2;

  // For user-defined boundaries, analyze the shape to determine content centering
  // Check if the user's corner selection indicates off-center content

  // Calculate the center of the user-defined quadrilateral
  const userDefinedCenterX = (topLeft.x + topRight.x + bottomRight.x + bottomLeft.x) / 4;
  const userDefinedCenterY = (topLeft.y + topRight.y + bottomRight.y + bottomLeft.y) / 4;

  // The content center is where the user believes the card content is positioned
  // This is represented by their corner selection
  const contentCenterX = userDefinedCenterX;
  const contentCenterY = userDefinedCenterY;

  // Calculate total card dimensions
  const totalCardWidth = rightEdgeX - leftEdgeX;
  const totalCardHeight = bottomEdgeY - topEdgeY;

  // Calculate border distances based on content center position
  const leftBorderWidth = contentCenterX - leftEdgeX;
  const rightBorderWidth = rightEdgeX - contentCenterX;
  const topBorderHeight = contentCenterY - topEdgeY;
  const bottomBorderHeight = bottomEdgeY - contentCenterY;

  const leftBorderPct = (leftBorderWidth / totalCardWidth) * 100;
  const rightBorderPct = (rightBorderWidth / totalCardWidth) * 100;
  const topBorderPct = (topBorderHeight / totalCardHeight) * 100;
  const bottomBorderPct = (bottomBorderHeight / totalCardHeight) * 100;

  // Calculate centering ratios
  const horizontalRatio = `${Math.round(leftBorderPct)}/${Math.round(rightBorderPct)}`;
  const verticalRatio = `${Math.round(topBorderPct)}/${Math.round(bottomBorderPct)}`;

  // Calculate centering score (1-10 scale, 10 being perfect)
  const horizontalDeviation = Math.abs(leftBorderPct - 50);
  const verticalDeviation = Math.abs(topBorderPct - 50);
  const totalDeviation = horizontalDeviation + verticalDeviation;

  // Score calculation: perfect centering (0 deviation) = 10, maximum deviation (100) = 1
  const score = Math.max(1, 10 - (totalDeviation / 10));

  // Generate display ratio (horizontal)
  const displayRatio = horizontalRatio;

  return {
    measurements: {
      left_border: leftBorderPct,
      right_border: rightBorderPct,
      top_border: topBorderPct,
      bottom_border: bottomBorderPct,
    },
    ratio: displayRatio,
    score: parseFloat(score.toFixed(1)),
    geometric_center: { x: idealCenterX, y: idealCenterY },
    content_center: { x: contentCenterX, y: contentCenterY },
    normalized_dimensions: { width: cardWidth, height: cardHeight },
    border_measurements: {
      left_border: `${leftBorderPct.toFixed(1)}%`,
      right_border: `${rightBorderPct.toFixed(1)}%`,
      top_border: `${topBorderPct.toFixed(1)}%`,
      bottom_border: `${bottomBorderPct.toFixed(1)}%`,
    },
    centering_ratios: {
      horizontal: horizontalRatio,
      vertical: verticalRatio,
    },
    centering_score: parseFloat(score.toFixed(1)),
    detection_confidence: '100.0%', // User-defined boundaries are 100% confident
    success: true,
  };
}

/**
 * Transform corner coordinates between different image sizes
 */
export function transformCoordinates(
  corners: CornerPoint[],
  originalSize: { width: number; height: number },
  displaySize: { width: number; height: number }
): CornerPoint[] {
  const scaleX = displaySize.width / originalSize.width;
  const scaleY = displaySize.height / originalSize.height;

  return corners.map(corner => ({
    x: corner.x * scaleX,
    y: corner.y * scaleY,
  }));
}

/**
 * Calculate the area of a quadrilateral defined by 4 corner points
 */
export function calculateQuadrilateralArea(corners: CornerPoint[]): number {
  if (corners.length !== 4) return 0;

  // Using the shoelace formula for polygon area
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    area += corners[i].x * corners[j].y;
    area -= corners[j].x * corners[i].y;
  }
  return Math.abs(area) / 2;
}

/**
 * Validate that corner points form a reasonable card boundary
 */
export function validateCardBoundaries(corners: CornerPoint[]): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (corners.length !== 4) {
    errors.push('Must have exactly 4 corner points');
    return { isValid: false, errors };
  }

  // Check for duplicate points
  for (let i = 0; i < corners.length; i++) {
    for (let j = i + 1; j < corners.length; j++) {
      const distance = Math.sqrt(
        Math.pow(corners[i].x - corners[j].x, 2) +
        Math.pow(corners[i].y - corners[j].y, 2)
      );
      if (distance < 10) { // Points too close together
        errors.push(`Corner ${i + 1} and ${j + 1} are too close together`);
      }
    }
  }

  // Check for reasonable area (not too small)
  const area = calculateQuadrilateralArea(corners);
  if (area < 1000) { // Minimum area threshold
    errors.push('Card area appears too small - ensure corners are at card edges');
  }

  // Check aspect ratio is reasonable for a card
  const [topLeft, topRight, bottomRight, bottomLeft] = corners;
  const width = Math.sqrt(
    Math.pow(topRight.x - topLeft.x, 2) + Math.pow(topRight.y - topLeft.y, 2)
  );
  const height = Math.sqrt(
    Math.pow(bottomLeft.x - topLeft.x, 2) + Math.pow(bottomLeft.y - topLeft.y, 2)
  );

  const aspectRatio = width / height;
  if (aspectRatio < 0.5 || aspectRatio > 2.0) {
    errors.push('Card aspect ratio appears unusual - verify corner placement');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}