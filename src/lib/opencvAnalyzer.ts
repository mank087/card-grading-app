/**
 * OpenCV Analysis Utilities
 *
 * Helper functions to analyze OpenCV metrics reliability and determine
 * whether to use objective measurements or fall back to LLM visual inspection.
 */

export interface OpenCVMetrics {
  version: string;
  run_id: string;
  front: SideMetrics | null;
  back: SideMetrics | null;
}

interface SideMetrics {
  side_label: string;
  width: number;
  height: number;
  centering: CenteringMetrics;
  edge_segments: EdgeSegments;
  corners: CornerMetric[];
  surface: SurfaceMetrics;
  sleeve_indicator: boolean;
  top_loader_indicator: boolean;
  slab_indicator: boolean;
  glare_mask_percent: number;
  obstructions: Obstruction[];
  debug_assets: any;
  detection_metadata?: DetectionMetadata;  // V2.0 Fusion detection metadata
}

interface DetectionMetadata {
  profile: string;              // Selected detection profile (raw_on_mat, sleeve, slab, etc.)
  method: string;               // Winning detection method (fused_edges, lab_chroma, lsd, etc.)
  score: number;                // Fusion score (0-115)
  confidence: string;           // Confidence level (high, medium, low, unreliable)
  candidates_tested: number;    // Number of valid candidates found
  area_ratio: number;           // Detected card area as percentage of image
}

interface CenteringMetrics {
  lr_ratio: [number, number];
  tb_ratio: [number, number];
  left_border_mean_px: number;
  right_border_mean_px: number;
  top_border_mean_px: number;
  bottom_border_mean_px: number;
  method_used?: string;  // "border-present", "design-anchor-required", "failed"
  confidence?: string;   // "high", "medium", "low", "unreliable"
  validation_notes?: string;  // Details about measurement
  fallback_mode?: boolean;  // True if measuring full image, not card boundaries
}

interface EdgeSegments {
  top: EdgeSegment[];
  right: EdgeSegment[];
  bottom: EdgeSegment[];
  left: EdgeSegment[];
}

interface EdgeSegment {
  segment_name: string;
  whitening_length_px: number;
  whitening_count: number;
  chips_count: number;
  white_dots_count: number;
}

interface CornerMetric {
  corner_name: string;
  rounding_radius_px: number;
  whitening_length_px: number;
  white_dots_count: number;
}

interface SurfaceMetrics {
  white_dots_count: number;
  scratch_count: number;
  crease_like_count: number;
  glare_coverage_percent: number;
  focus_variance: number;
  lighting_uniformity_score: number;
  color_bias_bgr: [number, number, number];
}

interface Obstruction {
  zone: string;
  type: string;
  action: string;
}

export interface OpenCVReliability {
  reliable: boolean;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  use_opencv_centering: boolean;
  use_opencv_edges: boolean;
  use_opencv_corners: boolean;
  use_opencv_surface: boolean;
  grade_cap?: number;
  grade_cap_reason?: string;
  measurements_summary: string;
}

/**
 * Analyze OpenCV metrics to determine reliability and usability
 */
export function analyzeOpenCVReliability(metrics: OpenCVMetrics | null): OpenCVReliability {
  // If OpenCV failed entirely, fall back to LLM
  if (!metrics || !metrics.front) {
    return {
      reliable: false,
      confidence: 'low',
      reason: 'OpenCV analysis failed or returned no data',
      use_opencv_centering: false,
      use_opencv_edges: false,
      use_opencv_corners: false,
      use_opencv_surface: false,
      measurements_summary: 'OpenCV analysis unavailable. Using LLM visual inspection only.'
    };
  }

  const front = metrics.front;
  const back = metrics.back;

  // Check for obstructions
  const hasObstructions = front.obstructions && front.obstructions.length > 0;
  const noQuadDetected = front.obstructions?.some(obs => obs.type === 'no_quad_detected');

  // Check for protective cases
  const inCase = front.sleeve_indicator || front.top_loader_indicator || front.slab_indicator;

  // Check OpenCV's own centering validation (NEW - use OpenCV's assessment)
  const centeringMethod = front.centering.method_used || "unknown";
  const centeringConfidence = front.centering.confidence || "unknown";
  const centeringNotes = front.centering.validation_notes || "";
  const centeringFallbackMode = front.centering.fallback_mode || false;

  // Centering is unreliable if:
  // 1. OpenCV says it needs design-anchor method (borderless card)
  // 2. OpenCV confidence is low or unreliable
  // 3. OpenCV is in fallback mode (measuring full image, not card boundaries)
  // 4. Extreme centering values (old fallback check)
  const centeringNeedsDesignAnchor = centeringMethod === "design-anchor-required";
  const centeringLowConfidence = centeringConfidence === "low" || centeringConfidence === "unreliable";

  // Fallback: Check for extreme measurements (likely errors) if OpenCV didn't provide validation
  const extremeCentering = (!front.centering.method_used) && (
    front.centering.tb_ratio[0] > 85 || front.centering.tb_ratio[0] < 15 ||
    front.centering.lr_ratio[0] > 85 || front.centering.lr_ratio[0] < 15
  );

  const extremeBackCentering = back && (!back.centering.method_used) && (
    back.centering.tb_ratio[0] > 85 || back.centering.tb_ratio[0] < 15 ||
    back.centering.lr_ratio[0] > 85 || back.centering.lr_ratio[0] < 15
  );

  // Check image dimensions (extreme aspect ratios indicate detection failure)
  const aspectRatio = front.width / front.height;
  const backAspectRatio = back ? back.width / back.height : 0.7; // Default to normal if no back
  // Cards are typically ~0.7 ratio (2.5" × 3.5")
  // Use very lenient thresholds to avoid false positives: 0.2 to 5.0
  const abnormalAspectRatio = aspectRatio > 5 || aspectRatio < 0.2 || backAspectRatio > 5 || backAspectRatio < 0.2;

  // Determine reliability
  let reliable = true;
  let confidence: 'high' | 'medium' | 'low' = 'high';
  let reason = 'OpenCV card detection successful';
  let gradeCap: number | undefined = undefined;
  let gradeCapReason: string | undefined = undefined;

  // Case 1: Card in protective case
  if (inCase) {
    reliable = true; // OpenCV works, but we cap the grade
    confidence = 'medium';
    reason = 'Card detected in protective case (sleeve/top loader/slab)';
    gradeCap = 9.5;
    gradeCapReason = 'Card in protective case - cannot verify 10.0 grade through plastic. Microscopic defects may be obscured.';
  }

  // Case 2: No quadrilateral detected (holographic cards, borderless cards, detection failure)
  if (noQuadDetected) {
    reliable = false;
    confidence = 'low';
    reason = 'Card boundary detection failed (likely borderless/holographic card or in case)';

    // If also in a case, apply grade cap
    if (inCase || abnormalAspectRatio) {
      gradeCap = 9.5;
      gradeCapReason = 'Protective case or borderless card detected - cannot verify 10.0 grade. Using LLM visual inspection for centering.';
    }
  }

  // Case 3: Centering unreliable (borderless card or detection failed)
  if (centeringNeedsDesignAnchor || centeringLowConfidence || centeringFallbackMode || extremeCentering || extremeBackCentering) {
    reliable = false;
    confidence = 'low';

    if (centeringFallbackMode) {
      reason = `Card boundary detection failed - measuring full image instead of card boundaries`;
    } else if (centeringNeedsDesignAnchor) {
      reason = `Borderless/full-bleed card detected - ${centeringNotes}`;
    } else if (centeringLowConfidence) {
      reason = `Low confidence centering - ${centeringNotes}`;
    } else {
      reason = 'Extreme centering measurements detected (boundary detection failed)';
    }

    // Only apply grade cap if there's ACTUAL evidence of a protective case
    // Don't cap just because centering detection failed
    if (inCase || abnormalAspectRatio) {
      gradeCap = 9.5;
      gradeCapReason = 'Card boundary detection unreliable AND protective case indicators detected. Cannot verify 10.0 grade.';
    }
    // Otherwise, just use LLM for centering without capping the grade
  }

  // Case 4: Abnormal aspect ratio (detection failure)
  if (abnormalAspectRatio) {
    reliable = false;
    confidence = 'low';
    const frontInfo = `front ${front.width}x${front.height} (ratio ${aspectRatio.toFixed(2)})`;
    const backInfo = back ? `, back ${back.width}x${back.height} (ratio ${backAspectRatio.toFixed(2)})` : '';
    reason = `Abnormal card dimensions detected (${frontInfo}${backInfo}) - likely detection error`;
  }

  // Determine which measurements to use
  // IMPORTANT: Only reject CENTERING when boundaries unreliable
  // Edges, corners, and surface defects can still be detected even with boundary issues
  const use_opencv_centering =
    reliable &&
    !noQuadDetected &&
    !centeringNeedsDesignAnchor &&
    !centeringFallbackMode &&
    !extremeCentering &&
    centeringConfidence !== 'low' &&
    centeringConfidence !== 'unreliable';
  const use_opencv_edges = true; // Edge defects (whitening, chipping) visible regardless of boundary detection
  const use_opencv_corners = true; // Corner defects (whitening, damage) visible regardless of boundary detection
  const use_opencv_surface = true; // Surface defects (scratches, white dots) work independently of boundaries

  // Create measurements summary
  let measurementsSummary = '';

  if (use_opencv_centering) {
    // Full OpenCV data available (including centering)
    measurementsSummary = `OpenCV Measurements (Reliable - ${centeringConfidence} confidence):
- Front Centering: ${front.centering.lr_ratio[0].toFixed(1)}/${front.centering.lr_ratio[1].toFixed(1)} (L/R), ${front.centering.tb_ratio[0].toFixed(1)}/${front.centering.tb_ratio[1].toFixed(1)} (T/B)`;

    if (centeringMethod && centeringNotes) {
      measurementsSummary += `
- Method: ${centeringMethod} - ${centeringNotes}`;
    }

    if (back) {
      measurementsSummary += `
- Back Centering: ${back.centering.lr_ratio[0].toFixed(1)}/${back.centering.lr_ratio[1].toFixed(1)} (L/R), ${back.centering.tb_ratio[0].toFixed(1)}/${back.centering.tb_ratio[1].toFixed(1)} (T/B)`;
    }
  } else {
    // Centering unreliable, but we still have defect data
    measurementsSummary = `OpenCV Detection: ${reason}
⚠️ Centering: Use LLM visual inspection`;

    if (centeringNotes) {
      measurementsSummary += ` (${centeringNotes})`;
    }

    measurementsSummary += `
✅ Defects: Using OpenCV objective measurements`;
  }

  // Add edge defect summary (always available)
  const totalEdgeWhitening = Object.values(front.edge_segments)
    .flat()
    .reduce((sum, seg) => sum + seg.whitening_count, 0);
  measurementsSummary += `
- Edge Whitening: ${totalEdgeWhitening} pixels detected across all edges`;

  // Add corner summary (always available)
  const totalCornerWhitening = front.corners.reduce((sum, corner) => sum + corner.whitening_length_px, 0);
  measurementsSummary += `
- Corner Whitening: ${totalCornerWhitening.toFixed(0)} pixels total across 4 corners`;

  // Add surface summary (always available)
  measurementsSummary += `
- Surface: ${front.surface.white_dots_count} white dots, ${front.surface.scratch_count} scratches detected`;

  // Add grade cap warning if applicable
  if (gradeCap) {
    measurementsSummary += `
⚠️ Grade Cap Applied: Maximum ${gradeCap} - ${gradeCapReason}`;
  }

  return {
    reliable,
    confidence,
    reason,
    use_opencv_centering,
    use_opencv_edges,
    use_opencv_corners,
    use_opencv_surface,
    grade_cap: gradeCap,
    grade_cap_reason: gradeCapReason,
    measurements_summary: measurementsSummary
  };
}

/**
 * Generate LLM-friendly summary of OpenCV metrics for prompt injection
 */
export function generateOpenCVSummaryForLLM(
  metrics: OpenCVMetrics | null,
  reliability: OpenCVReliability
): string {
  // If OpenCV completely failed, return simple fallback message
  if (!metrics || !metrics.front) {
    return `**OpenCV Stage 0 Analysis:**
${reliability.measurements_summary}

**Grading Instructions:**
- Use visual inspection to assess centering, corners, edges, and surface
- Follow standard grading rubric
${reliability.grade_cap ? `- ⚠️ IMPORTANT: Maximum grade ${reliability.grade_cap} - ${reliability.grade_cap_reason}` : ''}`;
  }

  const front = metrics.front!;
  const back = metrics.back;

  let summary = `**OpenCV Stage 0 Analysis (Objective Measurements):**

**CENTERING (Pixel-Perfect Measurements):**`;

  if (reliability.use_opencv_centering) {
    summary += `
- Front L/R: ${front.centering.lr_ratio[0].toFixed(1)}/${front.centering.lr_ratio[1].toFixed(1)}
- Front T/B: ${front.centering.tb_ratio[0].toFixed(1)}/${front.centering.tb_ratio[1].toFixed(1)}`;

    if (back) {
      summary += `
- Back L/R: ${back.centering.lr_ratio[0].toFixed(1)}/${back.centering.lr_ratio[1].toFixed(1)}
- Back T/B: ${back.centering.tb_ratio[0].toFixed(1)}/${back.centering.tb_ratio[1].toFixed(1)}`;
    }

    summary += `

**Centering Grading Instructions:**
- Grade 10.0 requires: 48/52 to 52/48 (both L/R and T/B, front AND back)
- Grade 9.5 requires: 53/47 to 57/43 (worst measurement)
- Apply rubric based on these OBJECTIVE measurements
`;
  } else {
    summary += `
- ⚠️ Detection unreliable (${reliability.reason})
- Use visual inspection for centering assessment
`;
  }

  if (reliability.use_opencv_edges) {
    const frontEdgeTotal = Object.values(front.edge_segments)
      .flat()
      .reduce((sum, seg) => sum + seg.whitening_count, 0);

    summary += `
**EDGE DEFECTS (Color ΔE Analysis):**
- Total edge whitening detected: ${frontEdgeTotal} pixels
- Bottom edge: ${front.edge_segments.bottom.reduce((sum, seg) => sum + seg.whitening_count, 0)} pixels
- Top edge: ${front.edge_segments.top.reduce((sum, seg) => sum + seg.whitening_count, 0)} pixels
- Left/Right edges: ${(front.edge_segments.left.reduce((sum, seg) => sum + seg.whitening_count, 0) + front.edge_segments.right.reduce((sum, seg) => sum + seg.whitening_count, 0))} pixels

**Edge Grading Instructions:**
- Grade 10.0 requires: 0 defects detected
- Grade 9.5 allows: 1-3 microscopic white dots only
- Apply rubric based on pixel counts above
`;
  }

  if (reliability.use_opencv_corners) {
    summary += `
**CORNER ANALYSIS:**`;
    front.corners.forEach(corner => {
      summary += `
- ${corner.corner_name.toUpperCase()}: ${corner.whitening_length_px.toFixed(0)}px whitening, rounding ${corner.rounding_radius_px.toFixed(1)}px`;
    });

    summary += `

**Corner Grading Instructions:**
- Grade 10.0 requires: 0 whitening on all 4 corners
- Grade 9.5 allows: 1-2 corners with microscopic whitening only
- High whitening values indicate defects
`;
  }

  if (reliability.grade_cap) {
    summary += `
⚠️ **GRADE CAP APPLIED:**
- Maximum Grade: ${reliability.grade_cap}
- Reason: ${reliability.grade_cap_reason}
`;
  }

  summary += `
**Final Instructions:**
- Use OpenCV measurements as PRIMARY evidence for grading
- Apply DCM grading rubric based on these objective metrics
- Visual inspection is SECONDARY for cards with reliable OpenCV data
`;

  return summary;
}

/**
 * Helper to check if a card should receive grade cap due to protective case
 */
export function shouldApplyGradeCap(metrics: OpenCVMetrics | null): {
  apply: boolean;
  maxGrade: number | null;
  reason: string | null
} {
  const reliability = analyzeOpenCVReliability(metrics);

  return {
    apply: reliability.grade_cap !== undefined,
    maxGrade: reliability.grade_cap || null,
    reason: reliability.grade_cap_reason || null
  };
}
