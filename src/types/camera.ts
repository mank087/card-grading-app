/**
 * Camera Configuration Types
 */
export interface CameraConfig {
  facingMode: 'user' | 'environment';
  aspectRatio?: number;
  width: { ideal: number };
  height: { ideal: number };
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
