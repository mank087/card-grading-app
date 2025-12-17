/**
 * Camera Configuration Types
 */
export interface CameraConfig {
  facingMode: 'user' | 'environment';
  aspectRatio?: number;
  width: { ideal: number; min?: number };
  height: { ideal: number; min?: number };
}

/**
 * Captured Image Data
 */
export interface CapturedImage {
  dataUrl: string;
  blob: Blob;
  file: File;
  timestamp: number;
}

/**
 * Camera Guide Overlay Configuration
 */
export interface CameraGuideOverlay {
  cornerPositions: { x: number; y: number }[];
  cardAspectRatio: number;
  showGrid: boolean;
}

/**
 * Image Quality Validation Result
 */
export interface QualityCheckResult {
  passed: boolean;
  score: number;
  message: string;
}

export interface ImageQualityValidation {
  isValid: boolean;
  overallScore: number;
  confidenceLetter: 'A' | 'B' | 'C' | 'D';
  gradeUncertainty: string;
  checks: {
    blur: QualityCheckResult;
    brightness: QualityCheckResult;
  };
  suggestions: string[];
}

/**
 * Upload Method Types
 */
export type UploadMethod = 'camera' | 'gallery' | 'desktop';

/**
 * Camera Permission State
 */
export type CameraPermissionState = 'prompt' | 'granted' | 'denied' | null;

// ============================================
// NEW TYPES FOR ENHANCED CAMERA MODULE
// ============================================

/**
 * 2D Point coordinate
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Card boundary corners
 */
export interface CardBounds {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
  confidence: number;
}

/**
 * Card orientation - portrait (vertical) or landscape (horizontal)
 */
export type CardOrientation = 'portrait' | 'landscape' | 'unknown';

/**
 * Guide frame orientation for the overlay
 */
export type GuideOrientation = 'portrait' | 'landscape';

/**
 * Standard card aspect ratios
 */
export const CARD_ASPECT_RATIOS = {
  portrait: 2.5 / 3.5,   // 0.714 (width/height when portrait)
  landscape: 3.5 / 2.5,  // 1.4 (width/height when landscape)
} as const;

/**
 * Card alignment information
 */
export interface CardAlignment {
  isCentered: boolean;        // Card center within 10% of frame center
  isParallel: boolean;        // Card edges parallel to frame edges (< 5° rotation)
  rotationAngle: number;      // Degrees of rotation (-45 to 45)
  fillPercent: number;        // How much of guide frame is filled (0-100)
  isWithinGuide: boolean;     // All corners inside guide area
}

/**
 * Warnings about card capture quality
 */
export type CardWarning =
  | 'card_too_small'      // Move closer
  | 'card_too_large'      // Move back
  | 'card_rotated'        // Straighten card
  | 'card_off_center'     // Center the card
  | 'corners_cut_off'     // All 4 corners not visible
  | 'glare_detected'      // Bright spot detected
  | 'shadow_detected'     // Dark region on card
  | 'blur_detected';      // Motion or focus blur

/**
 * Lighting information for the scene
 */
export interface LightingInfo {
  level: 'too_dark' | 'dim' | 'good' | 'bright' | 'too_bright';
  brightness: number; // 0-255
  message: string;
  hasGlare: boolean;
  hasShadow: boolean;
}

/**
 * Complete card detection result
 */
export interface CardDetectionResult {
  // Card found?
  detected: boolean;
  confidence: number;  // 0-100

  // Card boundaries (if detected)
  bounds: CardBounds | null;
  orientation: CardOrientation;

  // Alignment quality
  alignment: CardAlignment;

  // Lighting conditions
  lighting: LightingInfo;

  // Quality warnings
  warnings: CardWarning[];

  // Computed readiness
  readyForCapture: boolean;
}

/**
 * Stabilization state for motion detection
 */
export interface StabilizationState {
  isStable: boolean;
  motionScore: number;        // 0-100, lower is more stable
  stableFrameCount: number;
}

/**
 * Capture readiness state for auto-capture
 */
export interface CaptureReadinessState {
  // Individual checks
  isCardDetected: boolean;
  isStable: boolean;
  isAligned: boolean;
  isQualityGood: boolean;

  // Overall
  readyForCapture: boolean;
  readyFrameCount: number;

  // Auto-capture
  autoCaptureCountdown: number | null;  // null = not counting, 3/2/1/0 = seconds
  autoCaptureEnabled: boolean;
}

/**
 * Live quality feedback state
 */
export interface LiveQualityState {
  blur: {
    score: number;
    isAcceptable: boolean;
  };
  lighting: {
    brightness: number;
    isAcceptable: boolean;
    hasGlare: boolean;
    hasShadow: boolean;
  };
  overall: {
    score: number;
    isAcceptable: boolean;
  };
}

/**
 * Edge map from Sobel edge detection
 */
export interface EdgeMap {
  edges: Float32Array;
  width: number;
  height: number;
}
